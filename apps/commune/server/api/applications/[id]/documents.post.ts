// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Cán bộ đính kèm giấy tờ (ví dụ kết quả giải quyết) vào hồ sơ.
// Tệp chuyển nguyên vẹn sang dịch vụ tệp của lõi; lõi kiểm tra định dạng, lưu vào kho đối tượng,
// ghi mã băm vào cơ sở dữ liệu và sổ ghi nhận.
import { coreFiles } from '../../../utils/core-files'

export default defineEventHandler(async (event) => {
  const id = encodeURIComponent(getRouterParam(event, 'id') || '')
  const parts = await readMultipartFormData(event)
  const file = parts?.find((p) => p.name === 'file' && p.filename)
  const code = parts?.find((p) => p.name === 'documentCode')?.data.toString('utf8') || ''
  if (!file?.data?.length || !code) throw createError({ statusCode: 400, statusMessage: 'Thiếu tệp hoặc loại giấy tờ' })
  const query = new URLSearchParams({ code, name: file.filename || 'tep-dinh-kem' })
  const res = await coreFiles(event, `/dossiers/${id}/documents?${query}`, {
    method: 'POST',
    body: new Uint8Array(file.data),
    contentType: file.type || 'application/octet-stream',
  })
  return await res.json()
})
