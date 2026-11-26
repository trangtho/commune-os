// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Lãnh đạo xã tự cập nhật hồ sơ công vụ của mình (không ai duyệt thay được, nên lưu thẳng).
// Cán bộ xử lý dùng POST /api/me/requests (đề nghị, chờ lãnh đạo duyệt).
import { coreRpc } from '../../utils/core-api'
import { requireStaff } from '../../utils/session'

const FIELDS = ['full_name', 'gender', 'birth_date', 'staff_code', 'position', 'department', 'start_date',
  'education', 'phone', 'work_email', 'duties', 'address'] as const

export default defineEventHandler(async (event) => {
  const actor = await requireStaff(event)
  if (actor.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Cán bộ xử lý gửi đề nghị sửa hồ sơ để lãnh đạo duyệt' })
  const b = await readBody<Record<string, unknown>>(event)
  const data: Record<string, unknown> = { active: true }
  for (const f of FIELDS) data[f] = typeof b?.[f] === 'string' ? String(b[f]).trim().slice(0, 500) : ''
  return coreRpc(event, 'leader_save_staff_profile', { staff_id: actor.id, data })
})
