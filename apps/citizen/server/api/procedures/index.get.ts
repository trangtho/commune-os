// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Danh mục thủ tục qua cổng API của lõi; công dân đã đăng nhập chỉ thấy thủ tục xã mình đang mở.
import { catalogRpc } from '../../utils/identity'
export default defineEventHandler(async (event) => {
  const q = String(getQuery(event).q || '').slice(0, 120)
  const category = String(getQuery(event).category || '').slice(0, 100)
  return catalogRpc(event, 'procedure_catalog', { p_q: q, p_category: category })
})
