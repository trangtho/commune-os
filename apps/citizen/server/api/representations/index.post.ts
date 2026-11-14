// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenTx } from '../../utils/database'
import { representationSchema, auditRepresentativeAction } from '../../utils/representations'
import { validate } from '../../utils/validation'
export default defineEventHandler(async event => {
  const body = validate(representationSchema, await readBody(event))
  const now = new Date().toISOString().slice(0,10)
  const parsedDate = new Date(`${body.validUntil}T00:00:00Z`)
  if (!Number.isFinite(parsedDate.valueOf()) || parsedDate.toISOString().slice(0,10) !== body.validUntil || body.validUntil < now) {
    throw createError({statusCode:422, statusMessage:'Ngày hết hạn không hợp lệ hoặc đã qua'})
  }
  const item = await citizenTx(event, async(client, actor) => {
    const active = (await client.query('SELECT 1 FROM procedures WHERE id=$1 AND published=true',[body.procedureId])).rowCount
    if (!active) throw createError({statusCode:404,statusMessage:'Không tìm thấy thủ tục được công bố'})
    const result = await client.query(`INSERT INTO citizen_representations
      (citizen_id,tenant_id,represented_name,relationship,legal_basis,authorization_reference,procedure_id,valid_until)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,status`,
      [actor.id,actor.tenantId,body.representedName,body.relationship,body.legalBasis,body.authorizationReference,body.procedureId,body.validUntil])
    await auditRepresentativeAction(client,result.rows[0].id,actor,'requested')
    return result.rows[0]
  })
  setResponseStatus(event,201)
  return item
})
