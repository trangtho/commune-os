// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Lãnh đạo sửa thẳng hồ sơ nghiệp vụ của một cán bộ (chức vụ, bộ phận, liên hệ...), không cần duyệt.
import { coreRpc } from '../../../utils/core-api'

const FIELDS = ['full_name', 'gender', 'birth_date', 'staff_code', 'position', 'department', 'start_date',
  'education', 'phone', 'work_email', 'duties', 'address'] as const

export default defineEventHandler(async (event) => {
  const b = await readBody<Record<string, unknown>>(event)
  const data: Record<string, unknown> = {}
  for (const f of FIELDS) data[f] = typeof b?.[f] === 'string' ? String(b[f]).trim().slice(0, 500) : ''
  data.active = b?.active !== false
  return coreRpc(event, 'leader_save_staff_profile', { staff_id: getRouterParam(event, 'id'), data })
})
