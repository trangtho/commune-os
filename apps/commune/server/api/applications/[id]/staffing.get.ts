// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Ai đang được phân công hồ sơ, và đề nghị duyệt gần nhất của cán bộ đang đăng nhập cho hồ sơ này.
import { coreGet } from '../../../utils/core-api'

export default defineEventHandler(async (event) => {
  const id = encodeURIComponent(getRouterParam(event, 'id') || '')
  const [assign, mine] = await Promise.all([
    coreGet<any[]>(event, `/dossier_assignments?dossier_id=eq.${id}`),
    coreGet<any[]>(event, `/my_requests?dossier_id=eq.${id}&kind=eq.dossier_approval&order=created_at.desc&limit=1`),
  ])
  return { assignment: assign[0] || null, approval: mine[0] || null }
})
