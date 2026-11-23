// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Hồ sơ cá nhân của cán bộ đang đăng nhập: thông tin, giấy tờ, yêu cầu đã gửi, việc được giao.
// Lõi tự lọc theo người gọi (sub trong token), nên không cần truyền mã cán bộ.
import { coreGet } from '../../utils/core-api'

export default defineEventHandler(async (event) => {
  const [profile, documents, requests, tasks] = await Promise.all([
    coreGet<any[]>(event, '/my_profile'),
    coreGet<any[]>(event, '/my_documents?order=created_at.desc'),
    coreGet<any[]>(event, '/my_requests?order=created_at.desc&limit=50'),
    coreGet<any[]>(event, '/my_tasks?order=due_date.asc.nullslast'),
  ])
  return { profile: profile[0] || null, documents, requests, tasks }
})
