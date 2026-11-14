// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { validateProcedureForm, sanitizeProcedureForm } from '../../../shared/procedure-forms'
import { citizenTx } from '../../utils/database'
import { applicationSchema,validate } from '../../utils/validation'
export default defineEventHandler(async(event)=>{
  const body=validate(applicationSchema,await readBody(event))
  const valid=(await citizenTx(event,async(client,actor)=>{
    if (body.receivingTenantId && body.receivingTenantId !== actor.tenantId)
      throw createError({ statusCode: 422, statusMessage: 'Địa phương khác tài khoản chưa được hỗ trợ tiếp nhận; cần hệ thống định tuyến liên địa phương của nhóm' })
    const procedure=(await client.query('SELECT id FROM procedures WHERE id=$1 AND published=true',[body.procedureId])).rows[0]
    if(!procedure)throw createError({statusCode:400,statusMessage:'Thủ tục không tồn tại'})
    // Client's form content stays in the draft; final submission requires mandatory documents.
    const issues = validateProcedureForm(body.procedureId, body.formData)
    if (issues.length) throw createError({statusCode: 422, statusMessage: issues[0].message})
    const num=Number((await client.query("SELECT nextval('citizen_case_number') AS number")).rows[0].number)
    const id=`HS-${new Date().getFullYear()}-${String(num).padStart(6,'0')}`
    await client.query(`INSERT INTO applications(id,citizen_id,tenant_id,procedure_id,status,applicant_name,
      applicant_phone,description,form_data,submitted_at,due_at) VALUES($1,$2,$3,$4,'draft',$5,$6,$7,$8::jsonb,NULL,NULL)`,
      [id,actor.id,actor.tenantId,body.procedureId,body.applicantName,body.phone,body.description,JSON.stringify(sanitizeProcedureForm(body.procedureId, body.formData))])
    return {id,status:'draft'}
  }))
  setResponseStatus(event,201)
  return valid
})
