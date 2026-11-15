// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Yêu cầu người dân bổ sung giấy tờ = đi nhánh "supplement" của sơ đồ quy trình.
// Lõi bắt buộc có lý do, nên thiếu ghi chú sẽ bị từ chối (400).
import { coreWorkflow } from '../../../utils/core-api'
import { supplementSchema, validate } from '../../../utils/validation'

export default defineEventHandler(async (event) => {
  const body = validate(supplementSchema, await readBody(event))
  return await coreWorkflow(event, getRouterParam(event, 'id') || '', 'supplement', body.note || null)
})