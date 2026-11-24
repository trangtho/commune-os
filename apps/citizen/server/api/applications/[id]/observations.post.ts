// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Lưu thông tin công dân xác nhận đọc từ giấy tờ để rà soát mâu thuẫn: chỉ nhận trường thuộc biểu mẫu của thủ tục
// (getProcedureFormFields); lõi kiểm tra hồ sơ, giấy tờ và ghi nhật ký (api.citizen_case_observation_save).
import {citizenRpc} from '../../../utils/identity'
import {getProcedureFormFields} from '../../../../shared/procedure-forms'
export default defineEventHandler(async event=>{
 const id=String(getRouterParam(event,'id')||'')
 const body=await readBody(event)
 if(body?.confirmed!==true || typeof body?.documentId!=='string' || !/^[a-f0-9-]{36}$/i.test(body.documentId))
  throw createError({statusCode:400,statusMessage:'Cần xác nhận và mã giấy tờ đã tải lên'})
 const draft=await citizenRpc<{procedure_id:string}>(event,'citizen_application_draft',{p_application_id:id})
 const allowed=new Set(getProcedureFormFields(draft.procedure_id).map(x=>x.key))
 const values=body.fields
 if(!values||typeof values!=='object'||Array.isArray(values)||Object.keys(values).length>25)
  throw createError({statusCode:400,statusMessage:'Dữ liệu đối chiếu không hợp lệ'})
 const fields:Record<string,string>={}
 for(const [key,value] of Object.entries(values)){
  if(!allowed.has(key)||typeof value!=='string'||value.length>200)throw createError({statusCode:422,statusMessage:'Trường gợi ý không thuộc biểu mẫu hoặc quá dài'})
  if(value.trim())fields[key]=value.trim()
 }
 if(!Object.keys(fields).length)throw createError({statusCode:422,statusMessage:'Chưa có dữ liệu để đối chiếu'})
 return citizenRpc(event,'citizen_case_observation_save',{p_application_id:id,p_document_id:body.documentId,p_fields:fields})
})
