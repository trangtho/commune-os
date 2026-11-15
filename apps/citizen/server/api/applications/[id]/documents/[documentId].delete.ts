// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { deleteObject } from '../../../../utils/object-store'
import { citizenTx } from '../../../../utils/database'
/** Only draft / supplement documents may be removed, and only by the case owner (RLS). */
export default defineEventHandler(async event => {
  const applicationId = getRouterParam(event, 'id')
  const docId = getRouterParam(event, 'documentId')
  let storageKey = ''
  try {
    storageKey = await citizenTx(event, async client => {
      const app = (await client.query('SELECT id,status FROM applications WHERE id=$1 FOR UPDATE', [applicationId])).rows[0]
      if (!app) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy hồ sơ' })
      if (!['draft', 'supplement'].includes(app.status)) throw createError({ statusCode: 409, statusMessage: 'Không được xóa tài liệu của hồ sơ đã nộp' })
      const doc = (await client.query('SELECT storage_key FROM application_documents WHERE id=$1 AND application_id=$2', [docId, applicationId])).rows[0]
      if (!doc) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy tài liệu của hồ sơ' })
      await client.query('DELETE FROM application_documents WHERE id=$1 AND application_id=$2', [docId, applicationId])
      return String(doc.storage_key)
    })
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '42501')
      throw createError({ statusCode: 503, statusMessage: 'Cơ sở dữ liệu chưa cấp quyền xóa tài liệu cho tài khoản ứng dụng. Cần quản trị viên cấp quyền DELETE theo RLS.' })
    throw error
  }
  // Cơ sở dữ liệu là nguồn sự thật; xóa tệp hỏng thì chỉ ghi nhật ký để dọn sau.
  await deleteObject(storageKey)
  return { ok: true }
})
