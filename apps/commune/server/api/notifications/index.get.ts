// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Thông báo của cán bộ: lõi tự sinh khi có sự kiện, đọc qua cổng API; RLS chỉ trả thông báo của xã,
// gửi cho cán bộ này hoặc cho vai trò của cán bộ này.
import { coreGet } from '../../utils/core-api'
export default defineEventHandler((event) =>
  coreGet(event, '/staff_notifications?order=created_at.desc&limit=200'))
