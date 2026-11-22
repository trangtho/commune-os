// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenRpc } from '../../../utils/identity'
import { requireCitizen } from '../../../utils/session'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export default defineEventHandler(async (event) => {
  requireCitizen(event)
  const id = String(getRouterParam(event, 'id') || '')
  if (!uuid.test(id)) throw createError({ statusCode: 400, statusMessage: 'Mã thông báo không hợp lệ' })
  return citizenRpc(event, 'citizen_notification_read', { p_notification_id: id })
})
