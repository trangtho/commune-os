// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Một chỗ duy nhất gọi API lõi: tự gắn token, tự đổi lỗi kỹ thuật thành câu dễ hiểu.
// Ví dụ: const xa = await api<Tenant[]>("/tenants")                    → /rest/tenants (API dữ liệu)
//        await api("/accounts/tenants", { method: "POST", body })     → dịch vụ tài khoản của lõi
type Options = { method?: "GET" | "POST" | "PATCH"; body?: Record<string, unknown> };

export class ApiError extends Error {}

export function useApi() {
  const { logout } = useAuth();

  async function api<T>(path: string, options: Options = {}): Promise<T> {
    try {
      return await $fetch<T>(`/api/core${path.startsWith("/accounts/") ? path : `/rest${path}`}`, {
        method: options.method ?? "GET",
        body: options.body,
      });
    } catch (e: any) {
      const status = e?.response?.status;
      const message: string | undefined = e?.data?.data?.message ?? e?.data?.message;
      if (status === 401) {
        await logout();
        throw new ApiError("Phiên đăng nhập đã hết, vui lòng đăng nhập lại.");
      }
      if (status === 409) throw new ApiError(message ?? "Dữ liệu đã tồn tại.");
      if (status === 403) throw new ApiError(message ?? "Bạn không có quyền làm việc này.");
      if (status === 400) throw new ApiError(message ?? "Dữ liệu chưa hợp lệ.");
      if (status === 404) throw new ApiError(message ?? "Không tìm thấy dữ liệu.");
      if (status === 422 || status === 502 || status === 503) throw new ApiError(message ?? "Máy chủ từ chối yêu cầu.");
      throw new ApiError("Không kết nối được máy chủ. Kiểm tra docker compose đã chạy chưa.");
    }
  }

  return { api };
}