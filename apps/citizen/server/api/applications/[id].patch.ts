// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { validateProcedureForm, sanitizeProcedureForm } from '../../../shared/procedure-forms'
import { citizenTx } from '../../utils/database'
import { permittedReceivingTenant } from '../../utils/citizen-preferences'
import { applicationSchema,validate } from '../../utils/validation'
import {requireApprovedRepresentation,requireOwnApplicant} from '../../utils/representations'
export default defineEventHandler(async(event)=>{
  const body=validate(applicationSchema,await readBody(event))
  const id=getRouterParam(event,'id')
  return citizenTx(event,async(client,actor)=>{
    const receivingTenantId = body.receivingTenantId || actor.tenantId
    if (!(await permittedReceivingTenant(client,{procedureId:body.procedureId,sourceTenantId:actor.tenantId,receivingTenantId})))
      throw createError({statusCode:422,statusMessage:'Địa phương tiếp nhận chưa được cho phép đối với thủ tục này'})
    const row=(await client.query('SELECT id,status,procedure_id FROM applications WHERE id=$1 FOR UPDATE',[id])).rows[0]
    if(!row||row.status!=='draft'||row.procedure_id!==body.procedureId)
      throw createError({statusCode:409,statusMessage:'Không thể sửa hồ sơ đã nộp hoặc khác thủ tục'})
    if (body.representationId) {
      await requireApprovedRepresentation(client,body.representationId,body.procedureId,body.applicantName)
    } else {
      await requireOwnApplicant(client,actor.id,body.applicantName)
    }
    const issues = validateProcedureForm(body.procedureId, body.formData)
    if (issues.length) throw createError({statusCode: 422, statusMessage: issues[0].message})
    await client.query(`UPDATE applications SET applicant_name=$1,applicant_phone=$2,description=$3,
       form_data=$4::jsonb,receiving_tenant_id=$6,representation_id=$7,updated_at=now() WHERE id=$5`,
       [body.applicantName,body.phone,body.description,JSON.stringify(sanitizeProcedureForm(body.procedureId, body.formData)),id,receivingTenantId,body.representationId || null])
    return {id,status:'draft'}
  })
})
