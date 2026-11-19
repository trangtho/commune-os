// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Cán bộ cập nhật tiến độ việc được giao: todo → doing → done (kèm ghi chú kết quả).
import { coreRpc } from '../../../utils/core-api'

export default defineEventHandler(async (event) => {
  const b = await readBody<{ status?: string; resultNote?: string }>(event)
  if (!['todo', 'doing', 'done'].includes(String(b?.status))) throw createError({ statusCode: 400, statusMessage: 'Trạng thái không hợp lệ' })
  return coreRpc(event, 'update_my_task', {
    task_id: getRouterParam(event, 'id'), status: b.status, result_note: b.resultNote?.trim() || null,
  })
})
