// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenTx } from '../../utils/database'
import { normalizeSearch } from '../../../utils/search'
const validStatuses = new Set(['draft', 'submitted', 'processing', 'supplement', 'completed', 'rejected'])
export default defineEventHandler(async event => citizenTx(event, async client => {
  const query = getQuery(event)
  const status = typeof query.status === 'string' && validStatuses.has(query.status) ? query.status : ''
  const q = typeof query.q === 'string' ? query.q.trim().slice(0, 100) : ''
  // PostgreSQL translate() enables accent-insensitive search without adding a DB extension.
  const groups = [
    ['a', 'àáạảãâầấậẩẫăằắặẳẵ'], ['e', 'èéẹẻẽêềếệểễ'],
    ['i', 'ìíịỉĩ'], ['o', 'òóọỏõôồốộổỗơờớợởỡ'],
    ['u', 'ùúụủũưừứựửữ'], ['y', 'ỳýỵỷỹ'], ['d', 'đ']
  ]
  const from = groups.map(([, chars]) => chars).join('')
  const to = groups.map(([letter, chars]) => letter.repeat(chars.length)).join('')
  const term = normalizeSearch(q)
  // POSITION matches literal text. % and _ are not LIKE wildcards.
  const condition = `WHERE ($1 = '' OR a.status = $1)
    AND ($2 = '' OR POSITION($2 IN translate(lower(a.id), $3, $4)) > 0
      OR POSITION($2 IN translate(lower(p.title), $3, $4)) > 0
      OR POSITION($2 IN translate(lower(a.applicant_name), $3, $4)) > 0)`
  const columns = `a.id, a.procedure_id, p.title AS procedure_title, p.category,
    a.status, a.applicant_name, a.applicant_phone, a.description, a.form_data,
    a.submitted_at, a.due_at, a.result_note, a.updated_at`
  // Keep the existing array response for homepage and other consumer code.
  if (query.paged !== '1') {
    return (await client.query(`SELECT ${columns} FROM applications a JOIN procedures p ON a.procedure_id = p.id
      ${condition} ORDER BY a.updated_at DESC, a.id DESC LIMIT 100`, [status, term, from, to])).rows
  }
  const pageSize = 10
  const requested = Number(query.page)
  const page = Number.isSafeInteger(requested) && requested >= 1 ? Math.min(requested, 100_000) : 1
  const params = [status, term, from, to]
  const count = Number((await client.query(`SELECT count(*)::int AS count FROM applications a
    JOIN procedures p ON a.procedure_id = p.id ${condition}`, params)).rows[0].count)
  const maxPage = Math.max(1, Math.ceil(count / pageSize))
  const currentPage = Math.min(page, maxPage)
  const items = (await client.query(`SELECT ${columns} FROM applications a JOIN procedures p ON a.procedure_id = p.id
    ${condition} ORDER BY a.updated_at DESC, a.id DESC LIMIT $5 OFFSET $6`, [...params, pageSize, (currentPage - 1) * pageSize])).rows
  const grouped = (await client.query('SELECT status, count(*)::int AS count FROM applications GROUP BY status')).rows
  const counts: Record<string, number> = { draft: 0, submitted: 0, processing: 0, supplement: 0, completed: 0, rejected: 0 }
  for (const row of grouped) if (row.status in counts) counts[row.status] = Number(row.count)
  return { items, total: count, page: currentPage, pageSize, counts }
}))
