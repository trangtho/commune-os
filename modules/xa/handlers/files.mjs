// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Existing routes and RPC contracts remain unchanged; only this module owns the business adapter.
export function createHandler({ HttpError, UUID_RE, storeObject, readBody, rpc, json, s3, readObject, sha256hex, sendFile }) {
  return async ({ req, res, url, parts, auth }) => {
    // --- Giấy tờ riêng của gói xã ---
    // POST /files/dossiers/:id/documents
    if (req.method === 'POST' && parts.length === 4 && parts[1] === 'dossiers' && parts[3] === 'documents') {
      const code = String(url.searchParams.get('code') || '')
      const name = String(url.searchParams.get('name') || 'tep-dinh-kem').slice(0, 180)
      if (!/^[a-z0-9-]{1,100}$/.test(code)) throw new HttpError(400, 'Thiếu hoặc sai loại giấy tờ (code)')
      const type = String(req.headers['content-type'] || '').split(';')[0].trim()
      const stored = await storeObject(type, await readBody(req))
      try {
        const doc = await rpc('register_document', {
          dossier_id: decodeURIComponent(parts[2]), document_code: code, original_name: name,
          mime_type: type, size_bytes: stored.size, sha256: stored.sha256, storage_key: stored.key,
        }, auth)
        return json(res, 201, doc)
      } catch (e) {
        await s3('DELETE', stored.key).catch(() => {})   // không để lại tệp mồ côi
        throw e
      }
    }

    // GET /files/documents/:id
    if (req.method === 'GET' && parts.length === 3 && parts[1] === 'documents') {
      if (!UUID_RE.test(parts[2])) throw new HttpError(404, 'Không tìm thấy giấy tờ')
      const [meta] = await rpc('document_object', { document_id: parts[2] }, auth)
      if (!meta) throw new HttpError(404, 'Không tìm thấy giấy tờ hoặc không có quyền xem')
      const data = await readObject(meta.storage_key)
      if (meta.sha256 && sha256hex(data) !== meta.sha256) {
        throw new HttpError(409, 'Tệp trong kho không khớp mã băm đã ghi: có thể đã bị thay đổi')
      }
      return sendFile(res, data, meta)
    }
    // POST /files/staff-documents?doc_type=&title= — cán bộ nộp giấy tờ cá nhân, chờ lãnh đạo duyệt
    if (req.method === 'POST' && parts.length === 2 && parts[1] === 'staff-documents') {
      const docType = String(url.searchParams.get('doc_type') || '')
      const title = String(url.searchParams.get('title') || '').slice(0, 160)
      const note = url.searchParams.get('note')
      if (!/^[a-z-]{2,30}$/.test(docType)) throw new HttpError(400, 'Thiếu hoặc sai loại giấy tờ (doc_type)')
      const type = String(req.headers['content-type'] || '').split(';')[0].trim()
      const stored = await storeObject(type, await readBody(req))
      try {
        const r = await rpc('request_document_add', {
          doc_type: docType, title, storage_key: stored.key, mime_type: type,
          size_bytes: stored.size, sha256: stored.sha256, note: note ? note.slice(0, 1000) : null,
        }, auth)
        return json(res, 201, { ...r, sha256: stored.sha256 })
      } catch (e) {
        await s3('DELETE', stored.key).catch(() => {})
        throw e
      }
    }

    // GET /files/staff-documents/:id — chủ giấy tờ hoặc lãnh đạo cùng xã
    if (req.method === 'GET' && parts.length === 3 && parts[1] === 'staff-documents') {
      if (!UUID_RE.test(parts[2])) throw new HttpError(404, 'Không tìm thấy giấy tờ')
      const [meta] = await rpc('staff_document_object', { document_id: parts[2] }, auth)
      if (!meta) throw new HttpError(404, 'Không tìm thấy giấy tờ hoặc không có quyền xem')
      const data = await readObject(meta.storage_key)
      if (sha256hex(data) !== meta.sha256) {
        throw new HttpError(409, 'Tệp trong kho không khớp mã băm đã ghi: có thể đã bị thay đổi')
      }
      const ext = meta.storage_key.split('.').pop()
      return sendFile(res, data, { ...meta, original_name: `${meta.title}.${ext}` })
    }
    // GET /files/handoffs/:handoffId/documents/:documentId — cán bộ xã tiếp nhận tải giấy tờ trong mã chuyển hồ sơ
    // tại quầy đã dùng (api.redeem_citizen_handoff); PostgreSQL kiểm tra xã, hạn và người dùng mã.
    if (req.method === 'GET' && parts.length === 5 && parts[1] === 'handoffs' && parts[3] === 'documents') {
      if (!UUID_RE.test(parts[2]) || !UUID_RE.test(parts[4])) throw new HttpError(404, 'Không tìm thấy giấy tờ')
      const [meta] = await rpc('citizen_handoff_document', { p_handoff_id: parts[2], p_document_id: parts[4] }, auth)
      if (!meta) throw new HttpError(404, 'Không có quyền truy cập tài liệu này')
      return sendFile(res, await readObject(meta.storage_key), meta)
    }
  }
}
