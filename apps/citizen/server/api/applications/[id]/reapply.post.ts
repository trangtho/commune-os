// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenTx } from '../../../utils/database'
import { sanitizeProcedureForm } from '../../../../shared/procedure-forms'
import { permittedReceivingTenant } from '../../../utils/citizen-preferences'
import { requireOwnApplicant,requireApprovedRepresentation } from '../../../utils/representations'
export default defineEventHandler(async event=>{
  if((await readBody(event))?.confirmed!==true)
    throw createError({statusCode:400,statusMessage:'Bạn phải xác nhận trước khi tạo bản nháp mới'})
  const id=String(getRouterParam(event,'id')||'')
  const result=await citizenTx(event,async(client,actor)=>{
    const original=(await client.query('SELECT * FROM applications WHERE id=$1',[id])).rows[0]
    if(!original)throw createError({statusCode:404,statusMessage:'Không tìm thấy hồ sơ'})
    if(!['rejected','completed','withdrawn'].includes(original.status))
      throw createError({statusCode:409,statusMessage:'Chỉ tạo lại từ hồ sơ đã kết thúc hoặc được rút'})
    if(!(await client.query('SELECT 1 FROM procedures WHERE id=$1 AND published',[original.procedure_id])).rowCount)
      throw createError({statusCode:409,statusMessage:'Thủ tục không còn được công bố'})
    if(original.representation_id)await requireApprovedRepresentation(client,original.representation_id,original.procedure_id,original.applicant_name)
    else await requireOwnApplicant(client,actor.id,original.applicant_name)
    const target=original.receiving_tenant_id||actor.tenantId
    const receiver=await permittedReceivingTenant(client,{procedureId:original.procedure_id,sourceTenantId:actor.tenantId,receivingTenantId:target})
    const receivingTenantId=receiver?target:actor.tenantId
    const num=Number((await client.query("SELECT nextval('citizen_case_number') AS number")).rows[0].number)
    const newId=`HS-${new Date().getFullYear()}-${String(num).padStart(6,'0')}`
    await client.query(`INSERT INTO applications(id,citizen_id,tenant_id,procedure_id,status,applicant_name,applicant_phone,
      description,form_data,submitted_at,due_at,receiving_tenant_id,representation_id)
      VALUES($1,$2,$3,$4,'draft',$5,$6,$7,$8::jsonb,NULL,NULL,$9,$10)`,
      [newId,actor.id,actor.tenantId,original.procedure_id,original.applicant_name,original.applicant_phone,
        original.description,JSON.stringify(sanitizeProcedureForm(original.procedure_id,original.form_data||{})),receivingTenantId,original.representation_id||null])
    await client.query(`INSERT INTO application_events(application_id,event_type,note,actor_name)
      VALUES($1,'reapplied_from',$2,$3)`,[newId,'Tạo nháp mới từ hồ sơ '+id+'. Giấy tờ cần đính kèm lại và hồ sơ phải kiểm tra trước nộp.',actor.name])
    return {id:newId,procedureId:original.procedure_id,status:'draft',documentsCopied:false}
  })
  setResponseStatus(event,201)
  return result
})
