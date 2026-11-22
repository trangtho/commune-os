// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Lãnh đạo xã gửi thông báo tới từng công dân của xã mình (lõi kiểm tra vai trò lãnh đạo).
import { broadcastSchema, validate } from '../../utils/validation'
import { coreRpc } from '../../utils/core-api'
export default defineEventHandler(async (event) => {
  const body = validate(broadcastSchema, await readBody(event))
  return coreRpc(event, 'broadcast_citizen_notice', { title: body.title, body: body.body })
})
