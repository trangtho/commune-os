// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Một cuộc trò chuyện, 60 tin nhắn mỗi trang (api.citizen_chat_conversation của lõi).
import { citizenRpc } from '../../../utils/identity'
import type { CitizenChatThreadDetail } from '../../../../shared/chat-history'
export default defineEventHandler(event => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  const id = getRouterParam(event, 'id')
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    throw createError({ statusCode: 400, statusMessage: 'Mã hội thoại không hợp lệ' })
  const before = getQuery(event).before
  if (before !== undefined && (typeof before !== 'string' || !/^[1-9][0-9]{0,18}$/.test(before)))
    throw createError({ statusCode: 400, statusMessage: 'Mốc tin nhắn không hợp lệ' })
  return citizenRpc<CitizenChatThreadDetail>(event, 'citizen_chat_conversation', { p_conversation_id: id, p_before: before ?? null })
})
