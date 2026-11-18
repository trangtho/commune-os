// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Cán bộ đặt mật khẩu mới thay cho mật khẩu tạm, ngay trên trang đăng nhập.
// Dịch vụ tài khoản của lõi kiểm tra mật khẩu tạm bằng Keycloak rồi mới đặt mật khẩu mới.
export default defineEventHandler(async (event) => {
  const b = await readBody<{ username?: string; currentPassword?: string; newPassword?: string }>(event)
  const { gatewayUrl } = useRuntimeConfig(event)
  try {
    return await $fetch(`${gatewayUrl}/accounts/first-password`, {
      method: 'POST',
      body: {
        username: String(b?.username || ''),
        currentPassword: String(b?.currentPassword || ''),
        newPassword: String(b?.newPassword || ''),
      },
      headers: { 'x-forwarded-for': getRequestIP(event, { xForwardedFor: true }) || '' },
    })
  } catch (e: any) {
    const status = e?.response?.status
    if ([400, 401, 403, 409, 429].includes(status)) {
      throw createError({ statusCode: status, statusMessage: e?.data?.message || 'Không đặt được mật khẩu mới' })
    }
    throw createError({ statusCode: 502, statusMessage: 'Không gọi được dịch vụ tài khoản của lõi. Kiểm tra docker compose đã chạy chưa.' })
  }
})
