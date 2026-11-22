// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Đính kèm giấy tờ: kiểm tra định dạng, lưu tệp vào kho đối tượng của lõi (dịch vụ files),
// rồi lõi ghi siêu dữ liệu sau khi kiểm tra trạng thái hồ sơ và loại giấy tờ (api.citizen_document_add).
import { putObject, deleteObject } from '../../../utils/object-store'
import { citizenRpc } from '../../../utils/identity'
import { requireCitizen } from '../../../utils/session'
const accepted:Record<string,string>={'application/pdf':'.pdf','image/png':'.png','image/jpeg':'.jpg'}
export default defineEventHandler(async(event)=>{
  requireCitizen(event)
  const parts=await readMultipartFormData(event)
  const file=parts?.find(p=>p.name==='file'&&p.filename)
  const code=parts?.find(p=>p.name==='documentCode')?.data.toString('utf8')
  if(!file||!file.data||!code||code.length>100)throw createError({statusCode:400,statusMessage:'Chưa chọn giấy tờ hoặc loại giấy tờ'})
  const suffix=accepted[file.type||'']
  if(!suffix)throw createError({statusCode:415,statusMessage:'Chỉ cho phép PDF, PNG hoặc JPG'})
  if(file.data.length<1||file.data.length>5*1024*1024)throw createError({statusCode:413,statusMessage:'Tệp không được vượt quá 5 MB'})
  const buffer=file.data
  const actual=suffix==='.pdf'?buffer.subarray(0,5).toString()==='%PDF-':suffix==='.png'?buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff
  if(!actual)throw createError({statusCode:415,statusMessage:'Nội dung tệp không khớp định dạng'})
  const { key: storageKey, sha256 } = await putObject(buffer, file.type || '')
  try {
    return await citizenRpc(event,'citizen_document_add',{
      p_application_id:String(getRouterParam(event,'id')||''), p_document_code:code,
      p_original_name:(file.filename||'tai-lieu').replace(/[\\/\r\n\x00-\x1f]/g,'').slice(0,180),
      p_storage_key:storageKey, p_mime_type:file.type, p_size_bytes:buffer.length, p_sha256:sha256,
    })
  } catch(error) { await deleteObject(storageKey);throw error }
})
