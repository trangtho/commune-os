// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Giữ token đăng nhập. Token nằm trong sessionStorage: đóng tab là phải đăng nhập lại.
const KEY = "communeos-admin-token";

interface TokenInfo {
  preferred_username?: string;
  exp?: number;
  realm_access?: { roles?: string[] };
}

/** Đọc phần nội dung (payload) của JWT. Chỉ để hiển thị; việc kiểm tra chữ ký do cổng và API làm. */
function readToken(token: string): TokenInfo {
  try {
    const part = token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(part), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return {};
  }
}

export function useAuth() {
  const token = useState<string | null>("auth-token", () => sessionStorage.getItem(KEY));

  const info = computed(() => (token.value ? readToken(token.value) : {}));
  const username = computed(() => info.value.preferred_username ?? "");
  const isSysAdmin = computed(() => info.value.realm_access?.roles?.includes("sys_admin") ?? false);
  const isLoggedIn = computed(() => {
    const exp = info.value.exp;
    return !!token.value && !!exp && exp * 1000 > Date.now();
  });

  /** Trả về thông báo lỗi, hoặc null nếu đăng nhập được. */
  async function login(user: string, password: string): Promise<string | null> {
    try {
      const res = await $fetch<{ access_token: string }>("/api/dang-nhap", {
        method: "POST",
        body: { username: user, password },
      });
      if (!readToken(res.access_token).realm_access?.roles?.includes("sys_admin")) {
        return "Tài khoản này không có quyền quản trị hệ thống.";
      }
      token.value = res.access_token;
      sessionStorage.setItem(KEY, res.access_token);
      return null;
    } catch {
      return "Sai tên đăng nhập hoặc mật khẩu.";
    }
  }

  function logout() {
    token.value = null;
    sessionStorage.removeItem(KEY);
    return navigateTo("/dang-nhap");
  }

  return { token, username, isSysAdmin, isLoggedIn, login, logout };
}