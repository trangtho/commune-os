// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Cấp mật khẩu tạm mới cho cán bộ xử lý (cán bộ phải đổi ở lần đăng nhập sau).
import { coreAccounts } from '../../../utils/core-accounts'

export default defineEventHandler((event) => {
  const id = encodeURIComponent(getRouterParam(event, 'id') || '')
  return coreAccounts(event, `/staff/${id}/reset-password`, { method: 'POST' })
})
