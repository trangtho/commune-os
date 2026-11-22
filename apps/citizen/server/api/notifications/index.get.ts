// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenRpc } from '../../utils/identity'
import { requireCitizen } from '../../utils/session'
export default defineEventHandler(async (event) => {
  requireCitizen(event)
  const q = getQuery(event)
  const page = Number(q.page)
  return citizenRpc(event, 'citizen_notifications', {
    p_paged: q.paged === '1',
    p_q: typeof q.q === 'string' ? q.q.slice(0, 100) : '',
    p_category: typeof q.category === 'string' ? q.category.slice(0, 30) : '',
    p_unread: q.unread === '1',
    p_page: Number.isSafeInteger(page) && page >= 1 ? Math.min(page, 100000) : 1,
  })
})
