// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { validateProcedureForm, sanitizeProcedureForm } from '../../../shared/procedure-forms'
import { citizenTx } from '../../utils/database'
import { permittedReceivingTenant } from '../../utils/citizen-preferences'
import { applicationSchema,validate } from '../../utils/validation'
import {requireApprovedRepresentation,requireOwnApplicant,auditRepresentativeAction} from '../../utils/representations'
export default defineEventHandler(async(event)=>{
  const body=validate(applicationSchema,await readBody(event))
  const valid=(await citizenTx(event,async(client,actor)=>{
    const receivingTenantId = body.receivingTenantId || actor.tenantId
    if (!(await permittedReceivingTenant(client, { procedureId: body.procedureId, sourceTenantId: actor.tenantId, receivingTenantId })))
      throw createError({ statusCode: 422, statusMessage: 'Địa phương tiếp nhận chưa được cho phép đối với thủ tục này' })
    const procedure=(await client.query('SELECT id FROM procedures WHERE id=$1 AND published=true',[body.procedureId])).rows[0]
    if(!procedure)throw createError({statusCode:400,statusMessage:'Thủ tục không tồn tại'})
    if (body.representationId) {
      await requireApprovedRepresentation(client,body.representationId,body.procedureId,body.applicantName)
    } else {
      await requireOwnApplicant(client,actor.id,body.applicantName)
    }
    // Client's form content stays in the draft; final submission requires mandatory documents.
    const issues = validateProcedureForm(body.procedureId, body.formData)
    if (issues.length) throw createError({statusCode: 422, statusMessage: issues[0].message})
    const num=Number((await client.query("SELECT nextval('citizen_case_number') AS number")).rows[0].number)
    const id=`HS-${new Date().getFullYear()}-${String(num).padStart(6,'0')}`
    await client.query(`INSERT INTO applications(id,citizen_id,tenant_id,procedure_id,status,applicant_name,
      applicant_phone,description,form_data,submitted_at,due_at,receiving_tenant_id,representation_id) VALUES($1,$2,$3,$4,'draft',$5,$6,$7,$8::jsonb,NULL,NULL,$9,$10)`,
      [id,actor.id,actor.tenantId,body.procedureId,body.applicantName,body.phone,body.description,JSON.stringify(sanitizeProcedureForm(body.procedureId, body.formData)),receivingTenantId,body.representationId || null])
    if(body.representationId)await auditRepresentativeAction(client,body.representationId,actor,'application_created',id)
    return {id,status:'draft'}
  }))
  setResponseStatus(event,201)
  return valid
})
