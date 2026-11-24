// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Nơi duy nhất lấy và sửa dữ liệu xã, qua API lõi:
//   GET  /rest/tenants                 danh sách xã
//   POST /accounts/tenants             thêm xã kèm tài khoản lãnh đạo xã (trả mật khẩu tạm một lần)
//   POST /rest/rpc/set_tenant_status   khóa / mở khóa
import type { IssuedPassword, Tenant } from "~/types";

export interface NewTenantForm {
  code: string;
  name: string;
  leaderUsername: string;
  leaderFullName: string;
  leaderEmail: string;
}

const CODE_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,49}$/;

export function useTenants() {
  const { api } = useApi();
  const tenants = useState<Tenant[]>("tenants", () => []);
  const loading = ref(false);
  const loadError = ref<string | null>(null);

  async function load() {
    loading.value = true;
    loadError.value = null;
    try {
      tenants.value = await api<Tenant[]>("/tenants");
    } catch (e) {
      loadError.value = (e as Error).message;
    } finally {
      loading.value = false;
    }
  }

  /** Kiểm tra nhanh trên trình duyệt; máy chủ vẫn kiểm tra lại. */
  function validate(form: NewTenantForm): string | null {
    const code = form.code.trim();
    if (!code) return "Vui lòng nhập mã xã.";
    if (!CODE_PATTERN.test(code)) {
      return "Mã xã chỉ gồm chữ thường không dấu, số và dấu gạch ngang, ví dụ: xa-c.";
    }
    if (tenants.value.some((t) => t.code === code)) return `Mã xã "${code}" đã tồn tại.`;
    if (!form.name.trim()) return "Vui lòng nhập tên xã.";
    if (!USERNAME_PATTERN.test(form.leaderUsername.trim().toLowerCase())) {
      return "Tên đăng nhập lãnh đạo 3–50 ký tự: chữ thường không dấu, số, dấu chấm, gạch. Ví dụ: lanhdao.xa-c";
    }
    if (!form.leaderFullName.trim()) return "Vui lòng nhập họ tên lãnh đạo xã.";
    return null;
  }

  /** Tạo xã và tài khoản lãnh đạo trong một lần gọi. Tạo tài khoản lỗi thì lõi hủy xã vừa tạo. */
  async function addTenant(form: NewTenantForm): Promise<{ error: string | null; leader?: IssuedPassword }> {
    const error = validate(form);
    if (error) return { error };
    try {
      const r = await api<{ leader: IssuedPassword }>("/accounts/tenants", {
        method: "POST",
        body: {
          code: form.code.trim(),
          name: form.name.trim(),
          leaderUsername: form.leaderUsername.trim().toLowerCase(),
          leaderFullName: form.leaderFullName.trim(),
          leaderEmail: form.leaderEmail.trim() || undefined,
        },
      });
      await load();
      return { error: null, leader: r.leader };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  async function toggleLock(tenant: Tenant): Promise<string | null> {
    const status = tenant.status === "active" ? "locked" : "active";
    try {
      await api("/rpc/set_tenant_status", { method: "POST", body: { code: tenant.code, status } });
      await load();
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }

  return { tenants, loading, loadError, load, addTenant, toggleLock };
}