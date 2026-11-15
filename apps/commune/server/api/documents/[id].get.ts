// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Tải một giấy tờ của hồ sơ từ kho lưu trữ của lõi. Lõi kiểm tra quyền theo xã
// và so mã băm SHA-256; tệp bị sửa trong kho sẽ bị từ chối (409).
import { coreFiles } from '../../utils/core-files'

export default defineEventHandler(async (event) => {
  const id = encodeURIComponent(getRouterParam(event, 'id') || '')
  const res = await coreFiles(event, `/documents/${id}`)
  for (const name of ['content-type', 'content-disposition', 'x-content-sha256']) {
    const value = res.headers.get(name)
    if (value) setResponseHeader(event, name, value)
  }
  setResponseHeader(event, 'cache-control', 'private, no-store')
  setResponseHeader(event, 'x-content-type-options', 'nosniff')
  return Buffer.from(await res.arrayBuffer())
})
