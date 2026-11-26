// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { coreGet, coreWorkflow } from '../../../utils/core-api'

export default defineEventHandler(async event => {
  const id = getRouterParam(event, 'id') || ''
  const rows = await coreGet<{status: string}[]>(event, `/dossiers?id=eq.${encodeURIComponent(id)}&select=status`)
  if (!rows[0]) throw createError({statusCode: 404, statusMessage: 'Hồ sơ không tồn tại'})
  if (rows[0].status !== 'supplement') throw createError({statusCode: 409, statusMessage: 'Chỉ xác nhận bổ sung khi hồ sơ ở trạng thái cần bổ sung'})
  return coreWorkflow(event, id, 'processing', 'Đã nhận hồ sơ bổ sung từ công dân', 'supplement')
})
