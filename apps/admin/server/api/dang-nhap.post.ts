// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Đổi tên đăng nhập + mật khẩu (+ mã xác thực hai lớp nếu đã bật) lấy token từ Keycloak.
// Trình duyệt gọi POST /api/dang-nhap; máy chủ Nuxt gọi Keycloak giúp (tránh lỗi CORS).
// Mật khẩu và mã xác thực không được lưu ở đâu cả.
export default defineEventHandler(async (event) => {
  const { username, password, otp } = await readBody<{ username?: string; password?: string; otp?: string }>(event);
  if (!username || !password) {
    throw createError({ statusCode: 400, statusMessage: "Thiếu tên đăng nhập hoặc mật khẩu" });
  }
  if (otp && !/^[0-9]{6}$/.test(otp)) {
    throw createError({ statusCode: 400, statusMessage: "Mã xác thực gồm 6 chữ số" });
  }
  const { keycloakUrl } = useRuntimeConfig(event);
  const body = new URLSearchParams({ grant_type: "password", client_id: "commune-app", username, password });
  // Keycloak nhận mã OTP qua tham số "otp" trong luồng đăng nhập trực tiếp.
  if (otp) body.set("otp", otp);
  try {
    const res = await $fetch<{ access_token: string; expires_in: number }>(
      `${keycloakUrl}/realms/communeos/protocol/openid-connect/token`,
      { method: "POST", body },
    );
    return { access_token: res.access_token, expires_in: res.expires_in };
  } catch (e: any) {
    const reason = String(e?.data?.error_description || "");
    if (reason.includes("not fully set up")) {
      throw createError({
        statusCode: 403,
        statusMessage: "Tài khoản cần hoàn tất cài đặt (đổi mật khẩu hoặc bật xác thực hai lớp) ở trang tài khoản Keycloak trước.",
      });
    }
    if (reason.includes("disabled")) {
      throw createError({ statusCode: 403, statusMessage: "Tài khoản đang bị khóa." });
    }
    // Chỉ báo sai mật khẩu khi Keycloak trả đúng lỗi đó; Keycloak chưa chạy hay cấu hình sai thì báo rõ.
    if (e?.data?.error === "invalid_grant") {
      throw createError({ statusCode: 401, statusMessage: "Sai tên đăng nhập, mật khẩu hoặc mã xác thực." });
    }
    if (!e?.response || e.response.status >= 500 || e.response.status === 404) {
      throw createError({ statusCode: 503, statusMessage: "Hệ thống định danh (Keycloak) đang khởi động hoặc chưa kết nối được. Vui lòng thử lại sau khoảng 1 phút." });
    }
    throw createError({ statusCode: 503, statusMessage: `Cấu hình đăng nhập với Keycloak chưa đúng (${e?.data?.error || e.response.status}). Chạy lại make up hoặc báo quản trị.` });
  }
});
