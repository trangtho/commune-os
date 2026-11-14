// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Yêu cầu người dân bổ sung giấy tờ = chuyển hồ sơ sang trạng thái "supplement".
// Lõi bắt buộc có lý do, nên thiếu ghi chú sẽ bị từ chối (400).
import { coreRpc } from '../../../utils/core-api'
import { supplementSchema, validate } from '../../../utils/validation'

export default defineEventHandler(async (event) => {
  const body = validate(supplementSchema, await readBody(event))
  return await coreRpc(event, 'set_dossier_status', {
    dossier_id: getRouterParam(event, 'id'),
    status: 'supplement',
    note: body.note || null,
  })
})