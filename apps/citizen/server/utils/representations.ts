// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import type { PoolClient } from 'pg'
import { z } from 'zod'
export const representationSchema = z.object({
  representedName: z.string().trim().min(2).max(120),
  relationship: z.enum(['parent', 'child', 'spouse', 'guardian', 'other']),
  legalBasis: z.enum(['authorization', 'legal_representative']),
  authorizationReference: z.string().trim().max(120).default(''),
  procedureId: z.string().regex(/^[a-z0-9-]{2,80}$/),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
})
export async function requireOwnApplicant(client: PoolClient, citizenId: string, applicantName: string) {
  const profile = (await client.query('SELECT display_name FROM citizens WHERE id=$1', [citizenId])).rows[0]
  if (!profile || String(profile.display_name).normalize('NFC').trim().toLocaleLowerCase('vi') !== applicantName.normalize('NFC').trim().toLocaleLowerCase('vi')) {
    throw createError({statusCode:422,statusMessage:'Họ tên người kê khai không khớp hồ sơ cá nhân; để làm thay người khác, vui lòng đăng ký đại diện'})
  }
}
export async function requireApprovedRepresentation(client: PoolClient, representationId: string, procedureId: string, applicantName: string) {
  const result = await client.query(`SELECT id, represented_name, procedure_id FROM citizen_representations
     WHERE id=$1 AND procedure_id=$2 AND status='verified' AND evidence_key IS NOT NULL
       AND valid_until >= CURRENT_DATE AND verified_at IS NOT NULL AND verified_by IS NOT NULL FOR UPDATE`, [representationId, procedureId])
  const row = result.rows[0]
  if (!row) throw createError({ statusCode: 403, statusMessage: 'Quyền đại diện chưa được xác minh, đã hết hạn hoặc không đúng thủ tục' })
  if (String(row.represented_name).normalize('NFC').trim().toLocaleLowerCase('vi') !== applicantName.normalize('NFC').trim().toLocaleLowerCase('vi')) {
    throw createError({ statusCode: 422, statusMessage: 'Tên người được đại diện không khớp thông tin đã được xác minh' })
  }
  return row
}
export async function auditRepresentativeAction(client: PoolClient, representationId: string, actor: {id:string;tenantId:string;name:string}, action: 'application_created'|'application_submitted'|'evidence_uploaded'|'requested', applicationId?: string) {
  await client.query(`INSERT INTO citizen_representation_audit
    (representation_id,citizen_id,tenant_id,action,application_id,actor_name)
    VALUES($1,$2,$3,$4,$5,$6)`,[representationId,actor.id,actor.tenantId,action,applicationId || null,actor.name])
}
