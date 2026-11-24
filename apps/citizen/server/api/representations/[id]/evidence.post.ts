// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Bổ sung minh chứng đại diện: kiểm tra và lưu tệp vào kho của lõi, lõi gắn vào yêu cầu đang chờ xác minh
// (api.citizen_representation_evidence_set). Lõi từ chối thì xóa tệp mới; thành công thì xóa tệp cũ.
import { putObject,deleteObject } from '../../../utils/object-store'
import { citizenRpc } from '../../../utils/identity'
const formats:Record<string,string>={'application/pdf':'.pdf','image/png':'.png','image/jpeg':'.jpg'}
export default defineEventHandler(async event => {
  const id=getRouterParam(event,'id')
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))throw createError({statusCode:400,statusMessage:'Mã đăng ký không hợp lệ'})
  const parts=await readMultipartFormData(event)
  const file=parts?.find(part=>part.name==='file'&&part.filename)
  const suffix=formats[file?.type || '']
  if(!file?.data||!suffix)throw createError({statusCode:415,statusMessage:'Minh chứng chỉ hỗ trợ PDF, PNG, JPG'})
  const binary=file.data
  if(binary.length<1||binary.length>5*1024*1024)throw createError({statusCode:413,statusMessage:'Minh chứng không được vượt quá 5 MB'})
  const valid=suffix==='.pdf'?binary.subarray(0,5).toString()==='%PDF-':suffix==='.png'?binary.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):binary[0]===255&&binary[1]===216&&binary[2]===255
  if(!valid)throw createError({statusCode:415,statusMessage:'Tệp không khớp định dạng khai báo'})
  const safeFilename=String(file.filename || 'minh-chung').replace(/[\/\r\n\x00-\x1f]/g,'').slice(0,160)
  const { key: name } = await putObject(binary, file.type || '')
  try {
    const {old_key:old}=await citizenRpc<{old_key:string|null}>(event,'citizen_representation_evidence_set',
      {p_representation_id:id,p_evidence_key:name,p_evidence_name:safeFilename,p_evidence_type:file.type})
    if(old)await deleteObject(old)
    return {uploaded:true,name:safeFilename}
  }catch(error){await deleteObject(name);throw error}
})
