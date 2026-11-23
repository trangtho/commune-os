// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Tạo bản nháp: Kênh người dân kiểm tra biểu mẫu; lõi kiểm tra tuyến tiếp nhận, xã có mở thủ tục,
// phiên bản thủ tục, người kê khai hoặc quyền đại diện, rồi ghi (api.citizen_application_create).
import { z } from 'zod'
import { validateProcedureForm, sanitizeProcedureForm } from '../../../shared/procedure-forms'
import { citizenRpc } from '../../utils/identity'
import { requireCitizen } from '../../utils/session'
import { applicationSchema, validate } from '../../utils/validation'
const createSchema = applicationSchema.extend({ batchId: z.string().uuid().optional() })
export default defineEventHandler(async (event) => {
  requireCitizen(event)
  const body = validate(createSchema, await readBody(event))
  const issues = validateProcedureForm(body.procedureId, body.formData)
  if (issues.length) throw createError({ statusCode: 422, statusMessage: issues[0].message })
  const created = await citizenRpc(event, 'citizen_application_create', {
    p_procedure_id: body.procedureId, p_applicant_name: body.applicantName, p_phone: body.phone,
    p_description: body.description, p_form_data: sanitizeProcedureForm(body.procedureId, body.formData),
    p_receiving_tenant_id: body.receivingTenantId || null, p_representation_id: body.representationId || null,
    p_batch_id: body.batchId || null,
  })
  setResponseStatus(event, 201)
  return created
})
