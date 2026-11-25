// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Tài khoản lãnh đạo của một xã, qua dịch vụ tài khoản của lõi (chỉ quản trị hệ thống):
//   GET   /accounts/tenants/:code/leaders                       danh sách
//   POST  /accounts/tenants/:code/leaders                       thêm lãnh đạo (trả mật khẩu tạm)
//   POST  /accounts/tenants/:code/leaders/:id/reset-password    cấp lại mật khẩu tạm
//   PATCH /accounts/tenants/:code/leaders/:id/status            khóa / mở
import type { IssuedPassword, Leader } from "~/types";

export function useLeaders(code: string) {
  const { api } = useApi();
  const base = `/accounts/tenants/${encodeURIComponent(code)}/leaders`;
  const leaders = ref<Leader[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    error.value = null;
    try {
      return await fn();
    } catch (e) {
      error.value = (e as Error).message;
      return undefined;
    }
  }

  async function load() {
    loading.value = true;
    await run(async () => (leaders.value = await api<Leader[]>(base)));
    loading.value = false;
  }

  async function add(username: string, fullName: string, email: string): Promise<IssuedPassword | undefined> {
    const issued = await run(() =>
      api<IssuedPassword>(base, {
        method: "POST",
        body: { username: username.trim().toLowerCase(), fullName: fullName.trim(), email: email.trim() || undefined },
      }),
    );
    if (issued) await load();
    return issued;
  }

  async function resetPassword(leader: Leader): Promise<IssuedPassword | undefined> {
    const issued = await run(() => api<IssuedPassword>(`${base}/${leader.id}/reset-password`, { method: "POST" }));
    if (issued) await load();
    return issued;
  }

  async function setEnabled(leader: Leader, enabled: boolean) {
    const done = await run(() => api(`${base}/${leader.id}/status`, { method: "PATCH", body: { enabled } }));
    if (done) await load();
  }

  return { leaders, loading, error, load, add, resetPassword, setEnabled };
}
