// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenTx } from '../../utils/database'
export default defineEventHandler(event => citizenTx(event, async client => {
  const category = String(getQuery(event).category || '').trim().slice(0,80)
  // Staff publishes slots separately. No fake/generated availability.
  const rows = (await client.query(`SELECT s.id,s.category,s.starts_at,s.ends_at,
    citizen_slot_remaining(s.id) AS remaining
    FROM citizen_consultation_slots s WHERE s.is_published
      AND s.starts_at>now()+interval '1 hour' AND s.starts_at<now()+interval '31 days'
      AND ($1='' OR s.category=$1)
    ORDER BY s.starts_at LIMIT 60`,[category])).rows
  return {items: rows.filter(r => Number(r.remaining)>0), officiallyPublished:true}
}))
