// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Khóa hoặc mở tài khoản cán bộ xử lý.
import { coreAccounts } from '../../../utils/core-accounts'

export default defineEventHandler(async (event) => {
  const id = encodeURIComponent(getRouterParam(event, 'id') || '')
  const body = await readBody<{ enabled?: unknown }>(event)
  if (typeof body?.enabled !== 'boolean') throw createError({ statusCode: 400, statusMessage: 'Thiếu trạng thái khóa/mở' })
  return coreAccounts(event, `/staff/${id}/status`, { method: 'PATCH', body: { enabled: body.enabled } })
})
