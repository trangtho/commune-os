// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Thêm giấy tờ hoặc phiên bản mới vào kho: kiểm tra và lưu tệp vào kho đối tượng của lõi, rồi ghi siêu dữ liệu
// qua API của lõi (api.citizen_vault_add). Lõi từ chối thì xóa tệp vừa lưu.
import { z } from 'zod'
import { putObject,deleteObject } from '../../../utils/object-store'
import { citizenRpc } from '../../../utils/identity'
import { requireCitizen } from '../../../utils/session'
import { documentSchema,expirySchema,uploadPart,partText } from '../../../utils/vault'
import { validate } from '../../../utils/validation'
const versionSchema=z.object({documentId:z.string().uuid().optional(),expiresOn:expirySchema.optional()})
export default defineEventHandler(async event=>{
 requireCitizen(event)
 const parts=await readMultipartFormData(event)
 if(!parts)throw createError({statusCode:400,statusMessage:'Thiếu dữ liệu tải lên'})
 const file=uploadPart(parts)
 const options=validate(versionSchema,{documentId:partText(parts,'documentId')||undefined,expiresOn:partText(parts,'expiresOn')||null})
 const meta=options.documentId?null:validate(documentSchema,{title:partText(parts,'title'),category:partText(parts,'category')})
 const {key,sha256}=await putObject(file.bytes,file.mime)
 try{
  const result=await citizenRpc(event,'citizen_vault_add',{
   p_document_id:options.documentId??null, p_title:meta?.title??null, p_category:meta?.category??null,
   p_original_name:file.name, p_storage_key:key, p_mime_type:file.mime, p_size_bytes:file.bytes.length,
   p_sha256:sha256, p_expires_on:options.expiresOn??null,
  })
  setResponseStatus(event,201)
  return result
 }catch(error){await deleteObject(key);throw error}
})
