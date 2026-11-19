// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Cán bộ rút lại yêu cầu đang chờ duyệt của mình.
import { coreRpc } from '../../../utils/core-api'

export default defineEventHandler(async (event) => {
  return coreRpc(event, 'cancel_my_request', { request_id: getRouterParam(event, 'id') })
})
