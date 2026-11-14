// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenTx } from '../../../utils/database'
import type { CitizenChatThreadPage } from '../../../../shared/chat-history'

export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  const q = getQuery(event)
  const page = Number(q.page ?? 1)
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000)
    throw createError({ statusCode: 400, statusMessage: 'Số trang không hợp lệ' })
  const pageSize = 20
  return citizenTx(event, async client => {
    const count = await client.query<{ total: string }>(
      'SELECT count(*)::text AS total FROM citizen_ai_conversations'
    )
    const result = await client.query(
      `SELECT id, title, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM citizen_ai_conversations
       ORDER BY updated_at DESC, id DESC LIMIT $1 OFFSET $2`,
      [pageSize, (page - 1) * pageSize]
    )
    return { items: result.rows, total: Number(count.rows[0]?.total ?? 0), page, pageSize } as CitizenChatThreadPage
  })
})
