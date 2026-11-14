// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Danh sách hồ sơ của xã cán bộ đang đăng nhập, lấy từ API lõi GET /rest/dossiers.
import { coreGet } from '../../utils/core-api'

export default defineEventHandler(async (event) => {
  const status = String(getQuery(event).status || '')
  const filter = /^[a-z]+$/.test(status) ? `&status=eq.${status}` : ''
  return await coreGet(event, `/dossiers?order=updated_at.desc&limit=200${filter}`)
})