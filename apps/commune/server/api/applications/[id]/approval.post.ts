// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Cán bộ xử lý trình lãnh đạo duyệt kết quả hồ sơ (hoàn thành hoặc từ chối).
import { coreRpc } from '../../../utils/core-api'

export default defineEventHandler(async (event) => {
  const b = await readBody<{ proposal?: string; note?: string }>(event)
  if (!['completed', 'rejected'].includes(String(b?.proposal))) throw createError({ statusCode: 400, statusMessage: 'Chọn đề nghị hoàn thành hoặc từ chối' })
  return coreRpc(event, 'request_dossier_approval', { dossier_id: getRouterParam(event, 'id'), proposal: b.proposal, note: b.note?.trim() || '' })
})
