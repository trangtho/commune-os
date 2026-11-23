// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Sửa bản nháp: kiểm tra biểu mẫu ở đây, lõi kiểm tra trạng thái, tuyến tiếp nhận, người kê khai rồi ghi.
import { validateProcedureForm, sanitizeProcedureForm } from '../../../shared/procedure-forms'
import { citizenRpc } from '../../utils/identity'
import { requireCitizen } from '../../utils/session'
import { applicationSchema, validate } from '../../utils/validation'
export default defineEventHandler(async (event) => {
  requireCitizen(event)
  const body = validate(applicationSchema, await readBody(event))
  const issues = validateProcedureForm(body.procedureId, body.formData)
  if (issues.length) throw createError({ statusCode: 422, statusMessage: issues[0].message })
  return citizenRpc(event, 'citizen_application_update', {
    p_application_id: String(getRouterParam(event, 'id') || ''), p_procedure_id: body.procedureId,
    p_applicant_name: body.applicantName, p_phone: body.phone, p_description: body.description,
    p_form_data: sanitizeProcedureForm(body.procedureId, body.formData),
    p_receiving_tenant_id: body.receivingTenantId || null, p_representation_id: body.representationId || null,
  })
})
