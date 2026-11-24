// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Xóa một cuộc trò chuyện của chính mình (api.citizen_chat_conversation_delete của lõi).
import { citizenRpc } from '../../../utils/identity'
export default defineEventHandler(event => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  const id = getRouterParam(event, 'id')
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    throw createError({ statusCode: 400, statusMessage: 'Mã hội thoại không hợp lệ' })
  return citizenRpc(event, 'citizen_chat_conversation_delete', { p_conversation_id: id })
})
