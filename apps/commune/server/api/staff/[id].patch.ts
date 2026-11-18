// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Lãnh đạo sửa họ tên, email tài khoản của cán bộ xử lý (Keycloak, qua dịch vụ tài khoản của lõi).
import { coreAccounts } from '../../utils/core-accounts'

export default defineEventHandler(async (event) => {
  const id = encodeURIComponent(getRouterParam(event, 'id') || '')
  const b = await readBody<{ firstName?: string; lastName?: string; email?: string }>(event)
  return coreAccounts(event, `/staff/${id}`, {
    method: 'PATCH',
    body: { firstName: String(b?.firstName || ''), lastName: String(b?.lastName || ''), email: String(b?.email || '') },
  })
})
