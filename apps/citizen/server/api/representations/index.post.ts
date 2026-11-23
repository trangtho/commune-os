// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Đăng ký đại diện nộp thay (api.citizen_representation_create của lõi, ghi nhật ký đại diện).
import { citizenRpc } from '../../utils/identity'
import { representationSchema } from '../../utils/representations'
import { validate } from '../../utils/validation'
export default defineEventHandler(async event => {
  const body = validate(representationSchema, await readBody(event))
  const parsedDate = new Date(`${body.validUntil}T00:00:00Z`)
  if (!Number.isFinite(parsedDate.valueOf()) || parsedDate.toISOString().slice(0,10) !== body.validUntil) {
    throw createError({statusCode:422, statusMessage:'Ngày hết hạn không hợp lệ hoặc đã qua'})
  }
  const item = await citizenRpc(event,'citizen_representation_create',{p_represented_name:body.representedName,
    p_relationship:body.relationship,p_legal_basis:body.legalBasis,p_authorization_reference:body.authorizationReference,
    p_procedure_id:body.procedureId,p_valid_until:body.validUntil})
  setResponseStatus(event,201)
  return item
})
