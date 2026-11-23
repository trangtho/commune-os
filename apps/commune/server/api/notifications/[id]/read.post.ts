// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { coreRpc } from '../../../utils/core-api'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export default defineEventHandler((event) => {
  const id = String(getRouterParam(event, 'id') || '')
  if (!uuid.test(id)) throw createError({ statusCode: 400, statusMessage: 'Mã thông báo không hợp lệ' })
  return coreRpc(event, 'read_staff_notification', { notification_id: id })
})
