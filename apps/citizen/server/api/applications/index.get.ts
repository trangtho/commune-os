// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Hồ sơ của tôi qua cổng API của lõi; tìm kiếm không dấu theo mã hồ sơ, tên thủ tục, người kê khai.
import { normalizeSearch } from '../../../utils/search'
import { citizenRpc } from '../../utils/identity'
import { requireCitizen } from '../../utils/session'
export default defineEventHandler(async (event) => {
  requireCitizen(event)
  const query = getQuery(event)
  const page = Number(query.page)
  return citizenRpc(event, 'citizen_applications', {
    p_status: typeof query.status === 'string' ? query.status : '',
    p_term: normalizeSearch(typeof query.q === 'string' ? query.q.slice(0, 100) : ''),
    p_paged: query.paged === '1',
    p_page: Number.isSafeInteger(page) && page >= 1 ? Math.min(page, 100_000) : 1,
  })
})
