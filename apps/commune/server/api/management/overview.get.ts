// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Dữ liệu cho khu Quản lý nhân viên (chỉ lãnh đạo): hồ sơ cán bộ, giấy tờ, yêu cầu, việc giao, khối lượng.
// Với người không phải lãnh đạo, các view của lõi trả rỗng, nên ở đây chặn sớm cho rõ ràng.
import { coreGet } from '../../utils/core-api'
import { requireStaff } from '../../utils/session'

export default defineEventHandler(async (event) => {
  if (requireStaff(event).role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Chỉ lãnh đạo xã được dùng chức năng này' })
  const [profiles, documents, requests, tasks, workload] = await Promise.all([
    coreGet<any[]>(event, '/staff_profiles?order=full_name'),
    coreGet<any[]>(event, '/staff_documents?order=created_at.desc'),
    coreGet<any[]>(event, '/staff_requests?order=created_at.desc&limit=200'),
    coreGet<any[]>(event, '/staff_tasks?order=created_at.desc&limit=200'),
    coreGet<any[]>(event, '/staff_workload?order=staff_name'),
  ])
  return { profiles, documents, requests, tasks, workload }
})
