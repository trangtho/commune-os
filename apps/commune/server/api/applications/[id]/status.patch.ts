// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Đổi trạng thái hồ sơ qua động cơ quy trình của lõi (/workflow).
// Sơ đồ BPMN quyết định bước hợp lệ; cơ sở dữ liệu kiểm tra quyền, xã và ghi lịch sử.
import { coreWorkflow } from '../../../utils/core-api'
import { statusSchema, validate } from '../../../utils/validation'

export default defineEventHandler(async (event) => {
  const body = validate(statusSchema, await readBody(event))
  return await coreWorkflow(event, getRouterParam(event, 'id') || '', body.status, body.note || null)
})