// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Danh mục thủ tục mà xã của cán bộ đang mở, lấy từ API lõi GET /rest/procedures.
// Quản trị hệ thống bật/tắt thủ tục cho từng xã ở bảng quản trị (cổng 3001).
import { coreGet } from '../../utils/core-api'

export default defineEventHandler(async (event) => {
  return await coreGet(event, '/procedures?select=id,title,category,summary,icon,sla_days,fee_note,instructions,published,version')
})
