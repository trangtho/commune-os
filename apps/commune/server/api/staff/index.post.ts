// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Lãnh đạo tạo tài khoản cán bộ xử lý. Vai trò và xã do lõi tự gán, không nhận từ trình duyệt.
import { staffSchema, validate } from '../../utils/validation'
import { coreAccounts } from '../../utils/core-accounts'

export default defineEventHandler(async (event) => {
  const body = validate(staffSchema, await readBody(event))
  return coreAccounts(event, '/staff', {
    method: 'POST',
    body: { username: body.username, firstName: body.firstName, lastName: body.lastName, email: body.email || undefined },
  })
})
