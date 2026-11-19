// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Cán bộ nộp giấy tờ cá nhân (PDF/PNG/JPG, tối đa 5 MB). Tệp chuyển nguyên vẹn sang dịch vụ tệp của lõi:
// lõi kiểm tra định dạng, lưu kho đối tượng, ghi mã băm, tạo yêu cầu chờ lãnh đạo duyệt.
import { coreFiles } from '../../utils/core-files'

const TYPES = ['so-yeu-ly-lich', 'bang-cap', 'chung-chi', 'quyet-dinh', 'khac']

export default defineEventHandler(async (event) => {
  const parts = await readMultipartFormData(event)
  const file = parts?.find((p) => p.name === 'file' && p.filename)
  const field = (n: string) => parts?.find((p) => p.name === n)?.data.toString('utf8').trim() || ''
  const docType = field('docType'); const title = field('title'); const note = field('note')
  if (!file?.data?.length) throw createError({ statusCode: 400, statusMessage: 'Chưa chọn tệp' })
  if (!TYPES.includes(docType)) throw createError({ statusCode: 400, statusMessage: 'Chọn loại giấy tờ' })
  if (title.length < 2 || title.length > 160) throw createError({ statusCode: 400, statusMessage: 'Tên giấy tờ 2–160 ký tự' })
  const query = new URLSearchParams({ doc_type: docType, title, ...(note ? { note } : {}) })
  const res = await coreFiles(event, `/staff-documents?${query}`, {
    method: 'POST', body: new Uint8Array(file.data), contentType: file.type || 'application/octet-stream',
  })
  return await res.json()
})
