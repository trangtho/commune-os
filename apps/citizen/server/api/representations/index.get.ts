// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenTx } from '../../utils/database'
export default defineEventHandler(event => citizenTx(event, async client => {
  const items = (await client.query(`SELECT r.id,r.represented_name,r.relationship,r.legal_basis,
    r.authorization_reference,r.procedure_id,p.title AS procedure_title,r.valid_until,
    r.status,r.verified_at,r.evidence_name,r.created_at,r.updated_at
    FROM citizen_representations r JOIN procedures p ON p.id=r.procedure_id
    ORDER BY r.updated_at DESC LIMIT 100`)).rows
  return {items}
}))
