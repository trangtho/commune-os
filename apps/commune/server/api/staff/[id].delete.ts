// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Lãnh đạo xóa hẳn tài khoản cán bộ xử lý (phải khóa trước). Hồ sơ cá nhân và nhật ký vẫn được giữ.
import { coreAccounts } from '../../utils/core-accounts'

export default defineEventHandler(async (event) => {
  const id = encodeURIComponent(getRouterParam(event, 'id') || '')
  return coreAccounts(event, `/staff/${id}`, { method: 'DELETE' })
})
