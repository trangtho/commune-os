// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Lãnh đạo hủy một việc đang mở.
import { coreRpc } from '../../../utils/core-api'

export default defineEventHandler(async (event) => {
  return coreRpc(event, 'cancel_staff_task', { task_id: getRouterParam(event, 'id') })
})
