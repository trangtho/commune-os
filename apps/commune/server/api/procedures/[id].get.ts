// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Chi tiết một thủ tục và giấy tờ cần nộp, từ API lõi. Thủ tục xã chưa mở → 404.
import { coreGet } from '../../utils/core-api'

export default defineEventHandler(async (event) => {
  const slug = encodeURIComponent(getRouterParam(event, 'id') || '')
  const rows = await coreGet<any[]>(event, `/procedures?id=eq.${slug}&select=id,title,category,summary,icon,sla_days,fee_note,instructions,published,version`)
  if (!rows[0]) throw createError({ statusCode: 404, statusMessage: 'Thủ tục không tồn tại hoặc xã chưa mở thủ tục này' })
  const documents = await coreGet<any[]>(event, `/procedure_documents?procedure_id=eq.${slug}&order=document_code`)
  return { ...rows[0], documents }
})
