// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenTx } from '../../../utils/database'
import type { CitizenChatThreadDetail } from '../../../../shared/chat-history'

export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  const id = getRouterParam(event, 'id')
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    throw createError({ statusCode: 400, statusMessage: 'Mã hội thoại không hợp lệ' })
  const before = getQuery(event).before
  if (before !== undefined && (typeof before !== 'string' || !/^[1-9][0-9]{0,18}$/.test(before)))
    throw createError({ statusCode: 400, statusMessage: 'Mốc tin nhắn không hợp lệ' })
  return citizenTx(event, async client => {
    const found = await client.query(
      `SELECT id, title, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM citizen_ai_conversations WHERE id = $1`, [id]
    )
    if (!found.rowCount) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy cuộc trò chuyện thuộc tài khoản này' })
    const result = await client.query(
      `SELECT id::text AS id, role, content, mode, sources, suggestions, notice, revision,
              created_at AS "createdAt"
       FROM citizen_ai_messages WHERE conversation_id = $1
         AND ($2::bigint IS NULL OR id < $2::bigint)
       ORDER BY id DESC LIMIT 61`, [id, before ?? null]
    )
    const more = result.rows.length > 60
    const page = result.rows.slice(0, 60).reverse()
    return {
      conversation: found.rows[0],
      messages: page,
      nextBefore: more ? page[0]?.id ?? null : null
    } as CitizenChatThreadDetail
  })
})
