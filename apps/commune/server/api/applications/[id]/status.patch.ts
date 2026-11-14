// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Đổi trạng thái hồ sơ qua API lõi (hàm set_dossier_status).
// Lõi tự kiểm tra quyền, xã, bước chuyển hợp lệ; tự ghi lịch sử và báo cho người dân.
import { coreRpc } from '../../../utils/core-api'
import { statusSchema, validate } from '../../../utils/validation'

export default defineEventHandler(async (event) => {
  const body = validate(statusSchema, await readBody(event))
  return await coreRpc(event, 'set_dossier_status', {
    dossier_id: getRouterParam(event, 'id'),
    status: body.status,
    note: body.note || null,
  })
})