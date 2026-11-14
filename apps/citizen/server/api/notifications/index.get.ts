// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenTx } from '../../utils/database'
export default defineEventHandler(async event => citizenTx(event, async client => {
  const q = getQuery(event)
  if (q.paged !== '1') return (await client.query('SELECT * FROM citizen_notifications ORDER BY created_at DESC LIMIT 100')).rows
  const term = typeof q.q === 'string' ? q.q.trim().slice(0, 100) : ''
  const category = typeof q.category === 'string' && /^[a-z0-9_-]{1,30}$/.test(q.category) ? q.category : ''
  const unread = q.unread === '1'
  const requested = Number(q.page)
  const page = Number.isSafeInteger(requested) && requested >= 1 ? Math.min(requested, 100000) : 1
  const where = `WHERE ($1 = '' OR position(lower($1) IN lower(title)) > 0 OR position(lower($1) IN lower(body)) > 0)
    AND ($2 = '' OR category=$2) AND (NOT $3::boolean OR NOT is_read)`
  const count = Number((await client.query(`SELECT count(*)::int AS count FROM citizen_notifications ${where}`, [term, category, unread])).rows[0].count)
  const pageSize = 15
  const currentPage = Math.min(page, Math.max(1, Math.ceil(count / pageSize)))
  const items = (await client.query(`SELECT * FROM citizen_notifications ${where} ORDER BY created_at DESC,id DESC LIMIT $4 OFFSET $5`, [term, category, unread, pageSize, (currentPage - 1) * pageSize])).rows
  const categories = (await client.query(`SELECT category, count(*)::int AS count FROM citizen_notifications GROUP BY category ORDER BY category`)).rows
  const unreadCount = Number((await client.query('SELECT count(*)::int AS count FROM citizen_notifications WHERE NOT is_read')).rows[0].count)
  return { items, page: currentPage, pageSize, total: count, unreadCount, categories }
}))
