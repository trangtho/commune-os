// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { z } from 'zod'
import { validateProcedureForm, sanitizeProcedureForm } from '../../../shared/procedure-forms'
import { citizenTx } from '../../utils/database'
import {latestProcedureVersion} from '../../utils/procedure-version'
import { permittedReceivingTenant } from '../../utils/citizen-preferences'
import { applicationSchema,validate } from '../../utils/validation'
import {requireApprovedRepresentation,requireOwnApplicant,auditRepresentativeAction} from '../../utils/representations'
const createSchema=applicationSchema.extend({batchId:z.string().uuid().optional()})
export default defineEventHandler(async(event)=>{
  const body=validate(createSchema,await readBody(event))
  const valid=(await citizenTx(event,async(client,actor)=>{
    const receivingTenantId = body.receivingTenantId || actor.tenantId
    if (!(await permittedReceivingTenant(client, { procedureId: body.procedureId, sourceTenantId: actor.tenantId, receivingTenantId })))
      throw createError({ statusCode: 422, statusMessage: 'Địa phương tiếp nhận chưa được cho phép đối với thủ tục này' })
    const procedure=(await client.query('SELECT id FROM procedures WHERE id=$1 AND published=true',[body.procedureId])).rows[0]
    if(!procedure)throw createError({statusCode:400,statusMessage:'Thủ tục không tồn tại'})
    // Giữ kiểm tra xã tiếp nhận có mở thủ tục từ nhánh hiện tại.
    const enabled=(await client.query('SELECT public.procedure_enabled_for($1::uuid,$2) AS ok',[receivingTenantId,body.procedureId])).rows[0]?.ok
    if(!enabled)throw createError({statusCode:422,statusMessage:'Xã tiếp nhận chưa mở thủ tục này. Vui lòng chọn thủ tục khác hoặc liên hệ UBND xã.'})
    // Gắn bản nháp với phiên bản thủ tục đang hiệu lực tại thời điểm tạo.
    const procedureVersion=await latestProcedureVersion(client,body.procedureId)
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
      applicant_phone,description,form_data,submitted_at,due_at,receiving_tenant_id,representation_id,
      procedure_version_id,acknowledged_procedure_version_id) VALUES($1,$2,$3,$4,'draft',$5,$6,$7,$8::jsonb,NULL,NULL,$9,$10,$11,$11)`,
      [id,actor.id,actor.tenantId,body.procedureId,body.applicantName,body.phone,body.description,JSON.stringify(sanitizeProcedureForm(body.procedureId, body.formData)),receivingTenantId,body.representationId || null,procedureVersion.id])
    if (body.batchId) {
      // Validate the owner, tenant, and selected procedure before linking the new draft.
      const linked=await client.query(`UPDATE citizen_service_batch_items i SET application_id=$1
        FROM citizen_service_batches b WHERE i.batch_id=b.id AND b.id=$2 AND
        b.citizen_id=$3 AND b.tenant_id=$4 AND i.procedure_id=$5 AND i.application_id IS NULL
        RETURNING i.procedure_id`,[id,body.batchId,actor.id,actor.tenantId,body.procedureId])
      if(!linked.rowCount)throw createError({statusCode:409,statusMessage:'Nhóm thủ tục không hợp lệ hoặc đã có hồ sơ cho thủ tục này'})
    }
    if(body.representationId)await auditRepresentativeAction(client,body.representationId,actor,'application_created',id)
    return {id,status:'draft'}
  }))
  setResponseStatus(event,201)
  return valid
})
