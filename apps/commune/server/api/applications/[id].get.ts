// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Chi tiết 1 hồ sơ: thông tin + lịch sử + giấy tờ đã nộp + giấy tờ yêu cầu, đều từ API lõi.
// Hồ sơ của xã khác → API trả rỗng → báo 404 (không lộ là hồ sơ có tồn tại).
import { coreGet } from '../../utils/core-api'

export default defineEventHandler(async (event) => {
  const id = encodeURIComponent(getRouterParam(event, 'id') || '')
  const rows = await coreGet<any[]>(event, `/dossiers?id=eq.${id}`)
  const row = rows[0]
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Hồ sơ không tồn tại' })

  const [events, documents, requirements] = await Promise.all([
    coreGet<any[]>(event, `/dossier_events?dossier_id=eq.${id}&order=created_at`),
    coreGet<any[]>(event, `/dossier_documents?dossier_id=eq.${id}&order=uploaded_at.desc`),
    coreGet<any[]>(event, `/procedure_documents?procedure_id=eq.${encodeURIComponent(row.procedure_id)}&order=document_code`),
  ])
  return { ...row, events: events.map((e, i) => ({ id: i + 1, ...e })), documents, requirements }
})