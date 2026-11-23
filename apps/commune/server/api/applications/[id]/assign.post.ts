// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Lãnh đạo phân công hồ sơ cho một cán bộ; lõi ghi vào nhật ký hồ sơ.
import { coreRpc } from '../../../utils/core-api'

export default defineEventHandler(async (event) => {
  const b = await readBody<{ staffId?: string; staffName?: string }>(event)
  if (!b?.staffId || !b?.staffName) throw createError({ statusCode: 400, statusMessage: 'Chọn cán bộ' })
  return coreRpc(event, 'assign_dossier', { dossier_id: getRouterParam(event, 'id'), staff_id: b.staffId, staff_name: b.staffName })
})
