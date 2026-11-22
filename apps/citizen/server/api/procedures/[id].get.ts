// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Chi tiết thủ tục; available_in_my_commune: xã của công dân có mở thủ tục này không (null nếu là khách).
import { catalogRpc } from '../../utils/identity'
export default defineEventHandler(async (event) => {
  const id = String(getRouterParam(event, 'id') || '')
  if (!/^[a-z0-9-]{2,80}$/.test(id)) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy thủ tục' })
  return catalogRpc(event, 'procedure_detail', { p_procedure_id: id })
})
