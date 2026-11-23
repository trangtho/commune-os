// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Xóa giấy tờ của bản nháp hoặc hồ sơ đang bổ sung; lõi kiểm tra trạng thái và chủ hồ sơ (RLS).
import { deleteObject } from '../../../../utils/object-store'
import { citizenRpc } from '../../../../utils/identity'
import { requireCitizen } from '../../../../utils/session'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export default defineEventHandler(async event => {
  requireCitizen(event)
  const documentId = String(getRouterParam(event, 'documentId') || '')
  if (!uuid.test(documentId)) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy tài liệu của hồ sơ' })
  const removed = await citizenRpc<{ storage_key: string }>(event, 'citizen_document_remove', {
    p_application_id: String(getRouterParam(event, 'id') || ''), p_document_id: documentId,
  })
  // Cơ sở dữ liệu là nguồn sự thật; xóa tệp trong kho lỗi thì chỉ ghi nhật ký để dọn sau.
  await deleteObject(removed.storage_key)
  return { ok: true }
})
