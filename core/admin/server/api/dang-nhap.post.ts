// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Đổi tên đăng nhập + mật khẩu lấy token từ Keycloak.
// Trình duyệt gọi POST /api/dang-nhap; máy chủ Nuxt gọi Keycloak giúp (tránh lỗi CORS).
// Mật khẩu không được lưu ở đâu cả.
export default defineEventHandler(async (event) => {
  const { username, password } = await readBody<{ username?: string; password?: string }>(event);
  if (!username || !password) {
    throw createError({ statusCode: 400, statusMessage: "Thiếu tên đăng nhập hoặc mật khẩu" });
  }
  const { keycloakUrl } = useRuntimeConfig(event);
  try {
    const res = await $fetch<{ access_token: string; expires_in: number }>(
      `${keycloakUrl}/realms/communeos/protocol/openid-connect/token`,
      {
        method: "POST",
        body: new URLSearchParams({
          grant_type: "password",
          client_id: "commune-app",
          username,
          password,
        }),
      },
    );
    return { access_token: res.access_token, expires_in: res.expires_in };
  } catch {
    throw createError({ statusCode: 401, statusMessage: "Sai tên đăng nhập hoặc mật khẩu" });
  }
});