// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Tự lưu bản nháp: chỉ nhận trường thuộc biểu mẫu của thủ tục; lõi kiểm tra trạng thái và số phiên bản nháp.
import { z } from 'zod'
import { getProcedureFormFields, sanitizeProcedureForm } from '../../../../shared/procedure-forms'
import { citizenRpc } from '../../../utils/identity'
import { requireCitizen } from '../../../utils/session'
import { validate } from '../../../utils/validation'
const schema = z.object({ formData: z.record(z.string().max(500)), expectedRevision: z.number().int().min(0) }).strict()
export default defineEventHandler(async (event) => {
  requireCitizen(event)
  const body = validate(schema, await readBody(event))
  const id = String(getRouterParam(event, 'id') || '')
  const draft = await citizenRpc<{ procedure_id: string; status: string }>(event, 'citizen_application_draft', { p_application_id: id })
  if (draft.status !== 'draft') throw createError({ statusCode: 409, statusMessage: 'Bản nháp không còn có thể lưu' })
  const fields = getProcedureFormFields(draft.procedure_id)
  if (Object.keys(body.formData).length > fields.length || Object.keys(body.formData).some(key => !fields.some(f => f.key === key)))
    throw createError({ statusCode: 422, statusMessage: 'Trường kê khai không thuộc biểu mẫu' })
  return citizenRpc(event, 'citizen_application_autosave', {
    p_application_id: id, p_form_data: sanitizeProcedureForm(draft.procedure_id, body.formData), p_expected_revision: body.expectedRevision,
  })
})
