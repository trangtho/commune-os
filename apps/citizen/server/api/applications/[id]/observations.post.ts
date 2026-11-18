// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {citizenTx} from '../../../utils/database'
import {getProcedureFormFields} from '../../../../shared/procedure-forms'
import {recordPersonalDataUse} from '../../../utils/privacy-events'
export default defineEventHandler(event=>citizenTx(event,async(client,actor)=>{
 const id=String(getRouterParam(event,'id')||'')
 const body=await readBody(event)
 if(body?.confirmed!==true || typeof body?.documentId!=='string' || !/^[a-f0-9-]{36}$/i.test(body.documentId))
  throw createError({statusCode:400,statusMessage:'Cần xác nhận và mã giấy tờ đã tải lên'})
 const application=(await client.query("SELECT procedure_id FROM applications WHERE id=$1 AND status IN ('draft','supplement')",[id])).rows[0]
 if(!application)throw createError({statusCode:404,statusMessage:'Hồ sơ không còn cho phép lưu đối chiếu'})
 const allowed=new Set(getProcedureFormFields(application.procedure_id).map(x=>x.key))
 const values=body.fields
 if(!values||typeof values!=='object'||Array.isArray(values)||Object.keys(values).length>25)
  throw createError({statusCode:400,statusMessage:'Dữ liệu đối chiếu không hợp lệ'})
 const fields:Record<string,string>={}
 for(const [key,value] of Object.entries(values)){
  if(!allowed.has(key)||typeof value!=='string'||value.length>200)throw createError({statusCode:422,statusMessage:'Trường gợi ý không thuộc biểu mẫu hoặc quá dài'})
  if(value.trim())fields[key]=value.trim()
 }
 if(!Object.keys(fields).length)throw createError({statusCode:422,statusMessage:'Chưa có dữ liệu để đối chiếu'})
 const document=await client.query('SELECT id FROM application_documents WHERE id=$1 AND application_id=$2',[body.documentId,id])
 if(!document.rowCount)throw createError({statusCode:404,statusMessage:'Giấy tờ không thuộc hồ sơ của bạn'})
 await client.query(`INSERT INTO citizen_document_observations
 (citizen_id,tenant_id,application_id,document_id,fields)
 VALUES($1,$2,$3,$4,$5::jsonb)
 ON CONFLICT(document_id) DO UPDATE SET fields=EXCLUDED.fields,confirmed_at=now()`,
 [actor.id,actor.tenantId,id,body.documentId,JSON.stringify(fields)])
 await recordPersonalDataUse(client,actor,{action:'view_case',purpose:'Công dân xác nhận thông tin nhận dạng để đối chiếu giấy tờ',resourceKind:'application',resourceReference:id})
 return {saved:true,notice:'Đã lưu dữ liệu do bạn xác nhận để rà soát mâu thuẫn. Không tự đánh giá giấy tờ hợp lệ hay không.'}
}))
