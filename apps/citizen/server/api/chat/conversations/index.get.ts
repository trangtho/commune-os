// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Danh sách cuộc trò chuyện với trợ lý (api.citizen_chat_conversations của lõi).
import { citizenRpc } from '../../../utils/identity'
import type { CitizenChatThreadPage } from '../../../../shared/chat-history'
export default defineEventHandler(event => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  const page = Number(getQuery(event).page ?? 1)
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000)
    throw createError({ statusCode: 400, statusMessage: 'Số trang không hợp lệ' })
  return citizenRpc<CitizenChatThreadPage>(event, 'citizen_chat_conversations', { p_page: page })
})
