// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// 30 thao tác quản lý cán bộ gần nhất của xã (lõi chỉ trả nhật ký xã của lãnh đạo đang đăng nhập).
import { coreGet } from '../../utils/core-api'

export default defineEventHandler((event) =>
  coreGet(event, '/staff_audit?select=actor,action,target_username,created_at&order=created_at.desc&limit=30'),
)
