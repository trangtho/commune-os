// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Đường dẫn /api/* không có thì trả 404 JSON, không chuyển sang trang đăng nhập (tránh lời gọi API nhận nhầm 200).
export default defineEventHandler(() => {
  throw createError({ statusCode: 404, statusMessage: 'Không có đường dẫn API này' })
})
