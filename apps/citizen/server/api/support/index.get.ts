// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenTx } from '../../utils/database'
export default defineEventHandler(async event => citizenTx(event, async client => {
  const applicationId = getQuery(event).applicationId
  if (applicationId !== undefined && (typeof applicationId !== 'string' || applicationId.length > 50))
    throw createError({ statusCode: 400, statusMessage: 'Mã hồ sơ không hợp lệ' })
  // The join is inside the same citizenTx; both tables enforce owner RLS.
  return (await client.query(`SELECT s.id, s.application_id, s.message, s.created_at
    FROM citizen_support_messages s WHERE ($1::text IS NULL OR s.application_id = $1)
    ORDER BY s.created_at DESC, s.id DESC LIMIT 50`, [applicationId || null])).rows.map(row => ({...row,status:'received',reply:null}))
}))
