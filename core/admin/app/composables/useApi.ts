// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Một chỗ duy nhất gọi API lõi: tự gắn token, tự đổi lỗi kỹ thuật thành câu dễ hiểu.
// Ví dụ: const xa = await api<Tenant[]>("/tenants")
//        await api("/rpc/add_tenant", { method: "POST", body: { code, name } })
type Options = { method?: "GET" | "POST"; body?: Record<string, unknown> };

export class ApiError extends Error {}

export function useApi() {
  const { token, logout } = useAuth();

  async function api<T>(path: string, options: Options = {}): Promise<T> {
    try {
      return await $fetch<T>(`/rest${path}`, {
        method: options.method ?? "GET",
        body: options.body,
        headers: { Authorization: `Bearer ${token.value}` },
      });
    } catch (e: any) {
      const status = e?.response?.status;
      const message: string | undefined = e?.data?.message;
      if (status === 401) {
        await logout();
        throw new ApiError("Phiên đăng nhập đã hết, vui lòng đăng nhập lại.");
      }
      if (status === 409) throw new ApiError("Dữ liệu đã tồn tại.");
      if (status === 403) throw new ApiError(message ?? "Bạn không có quyền làm việc này.");
      if (status === 400) throw new ApiError(message ?? "Dữ liệu chưa hợp lệ.");
      throw new ApiError("Không kết nối được máy chủ. Kiểm tra docker compose đã chạy chưa.");
    }
  }

  return { api };
}