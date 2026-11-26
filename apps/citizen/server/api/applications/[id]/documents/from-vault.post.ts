// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Đính kèm giấy tờ trong kho vào hồ sơ:
//   1. lõi kiểm tra quyền tái sử dụng (vault_case_reuse), quyết định lưu trữ, hạn dùng (api.citizen_vault_source);
//   2. đọc tệp nguồn, kiểm tra định dạng và mã băm, lưu một bản sao riêng cho hồ sơ;
//   3. lõi kiểm tra lại mọi điều kiện và gắn bản sao trong cùng giao dịch (api.citizen_vault_attach).
// Lõi từ chối ở bước 3 thì xóa bản sao.
import { z } from 'zod'
import { createHash } from 'node:crypto'
import { citizenRpc } from '../../../../utils/identity'
import { getObject,putObject,deleteObject } from '../../../../utils/object-store'
import { validate } from '../../../../utils/validation'
import { validVaultContent } from '../../../../../shared/citizen-vault'
const schema=z.object({versionId:z.string().uuid(),documentCode:z.string().min(1).max(100),confirmed:z.literal(true)}).strict()
type Source={storage_key:string;original_name:string;mime_type:string;sha256:string}
export default defineEventHandler(async event=>{
 const id=String(getRouterParam(event,'id')||'')
 const body=validate(schema,await readBody(event))
 const source=await citizenRpc<Source>(event,'citizen_vault_source',{p_version_id:body.versionId})
 const bytes=await getObject(source.storage_key)
 if(!bytes||!validVaultContent(bytes,source.mime_type)||createHash('sha256').update(bytes).digest('hex')!==source.sha256)
  throw createError({statusCode:422,statusMessage:'Tệp nguồn bị thiếu hoặc không bảo đảm tính toàn vẹn'})
 const {key,sha256}=await putObject(bytes,source.mime_type)
 try {
  const result=await citizenRpc(event,'citizen_vault_attach',{
   p_application_id:id, p_version_id:body.versionId, p_document_code:body.documentCode, p_original_name:source.original_name,
   p_storage_key:key, p_mime_type:source.mime_type, p_size_bytes:bytes.length, p_sha256:sha256,
  })
  setResponseStatus(event,201)
  return result
 }catch(error){await deleteObject(key);throw error}
})
