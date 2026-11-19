// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Lãnh đạo duyệt hoặc không duyệt một yêu cầu của cán bộ. Không duyệt thì phải ghi lý do (lõi kiểm tra).
import { coreRpc } from '../../../utils/core-api'

export default defineEventHandler(async (event) => {
  const b = await readBody<{ approve?: unknown; note?: string }>(event)
  if (typeof b?.approve !== 'boolean') throw createError({ statusCode: 400, statusMessage: 'Thiếu quyết định duyệt' })
  return coreRpc(event, 'decide_staff_request', {
    request_id: getRouterParam(event, 'id'), approve: b.approve, note: b.note?.trim() || null,
  })
})
