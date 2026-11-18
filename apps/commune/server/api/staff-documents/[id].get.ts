// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Tải giấy tờ cá nhân của cán bộ. Lõi chỉ cho chủ giấy tờ hoặc lãnh đạo cùng xã, và kiểm tra mã băm.
import { coreFiles } from '../../utils/core-files'

export default defineEventHandler(async (event) => {
  const id = encodeURIComponent(getRouterParam(event, 'id') || '')
  const res = await coreFiles(event, `/staff-documents/${id}`)
  for (const h of ['content-type', 'content-disposition', 'x-content-sha256']) {
    const v = res.headers.get(h)
    if (v) setResponseHeader(event, h, v)
  }
  setResponseHeader(event, 'cache-control', 'private, no-store')
  return new Uint8Array(await res.arrayBuffer())
})
