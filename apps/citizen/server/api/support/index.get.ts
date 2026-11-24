// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Tin nhắn hỗ trợ theo hồ sơ (api.citizen_support_messages của lõi; RLS theo công dân).
import { citizenRpc } from '../../utils/identity'
export default defineEventHandler(event => {
  const applicationId = getQuery(event).applicationId
  if (applicationId !== undefined && (typeof applicationId !== 'string' || applicationId.length > 50))
    throw createError({ statusCode: 400, statusMessage: 'Mã hồ sơ không hợp lệ' })
  return citizenRpc(event,'citizen_support_messages',{p_application_id:applicationId || null})
})
