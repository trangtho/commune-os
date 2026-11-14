// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { validateProcedureForm } from '../../../../shared/procedure-forms'
import { citizenTx } from '../../../utils/database'
import { permittedReceivingTenant } from '../../../utils/citizen-preferences'
import { requireApprovedRepresentation,requireOwnApplicant,auditRepresentativeAction } from '../../../utils/representations'
export default defineEventHandler(async(event)=>citizenTx(event,async(client,actor)=>{
  const id=getRouterParam(event,'id')
  const body=await readBody(event)
  if(body?.confirmed!==true)throw createError({statusCode:400,statusMessage:'Bạn phải xác nhận thông tin trước khi nộp'})
  const row=(await client.query('SELECT * FROM applications WHERE id=$1 FOR UPDATE',[id])).rows[0]
  if(!row||row.status!=='draft')throw createError({statusCode:409,statusMessage:'Hồ sơ không ở trạng thái bản nháp'})
  // A published procedure might have been withdrawn while the user edited the draft.
  const active=(await client.query('SELECT 1 FROM procedures WHERE id=$1 AND published',[row.procedure_id])).rowCount
  if(!active)throw createError({statusCode:409,statusMessage:'Thủ tục không còn được công bố; vui lòng chọn thủ tục khác'})
  if (!(await permittedReceivingTenant(client,{procedureId:row.procedure_id,sourceTenantId:actor.tenantId,receivingTenantId:row.receiving_tenant_id || actor.tenantId})))
    throw createError({statusCode:409,statusMessage:'Tuyến tiếp nhận không còn hiệu lực; vui lòng chỉnh sửa bản nháp và chọn lại địa phương'})
  if (row.representation_id) {
    // Recheck approval, scope and expiry under lock at final submission.
    await requireApprovedRepresentation(client,row.representation_id,row.procedure_id,row.applicant_name)
  } else {
    await requireOwnApplicant(client,actor.id,row.applicant_name)
  }
  const issues = validateProcedureForm(row.procedure_id, row.form_data || {})
  if (issues.length) throw createError({statusCode:422,statusMessage:issues[0].message})
  const missing=(await client.query(`SELECT d.document_name FROM procedure_documents d
    WHERE d.procedure_id=$1 AND d.is_required AND NOT EXISTS
      (SELECT 1 FROM application_documents f WHERE f.application_id=$2 AND f.document_code=d.document_code)`,[row.procedure_id,id])).rows
  if(missing.length)throw createError({statusCode:422,statusMessage:'Thiếu giấy tờ: '+missing.map(d=>d.document_name).join(', ')})
  await client.query("UPDATE applications SET status='submitted',submitted_at=now(),updated_at=now(),due_at=CURRENT_DATE+(SELECT sla_days FROM procedures WHERE id=$2) WHERE id=$1",[id,row.procedure_id])
  await client.query("INSERT INTO application_events(application_id,event_type,note,actor_name) VALUES($1,'submitted','Công dân đã nộp hồ sơ và xác nhận đầy đủ giấy tờ.',$2)",[id,actor.name])
  if(row.representation_id)await auditRepresentativeAction(client,row.representation_id,actor,'application_submitted',id)
  await client.query("INSERT INTO citizen_notifications(citizen_id,tenant_id,application_id,title,body) VALUES($1,$2,$3,'Nộp hồ sơ thành công','Hồ sơ '||$3||' đã được ghi nhận.')",[actor.id,actor.tenantId,id])
  return {id,status:'submitted'}
}))
