// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Nơi duy nhất lấy và sửa dữ liệu xã, qua API lõi:
//   GET  /rest/tenants                 danh sách xã
//   POST /rest/rpc/add_tenant          thêm xã
//   POST /rest/rpc/set_tenant_status   khóa / mở khóa
import type { Tenant } from "~/types";

const CODE_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

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
  function validate(code: string, name: string): string | null {
    if (!code) return "Vui lòng nhập mã xã.";
    if (!CODE_PATTERN.test(code)) {
      return "Mã xã chỉ gồm chữ thường không dấu, số và dấu gạch ngang, ví dụ: xa-c.";
    }
    if (tenants.value.some((t) => t.code === code)) return `Mã xã "${code}" đã tồn tại.`;
    if (!name.trim()) return "Vui lòng nhập tên xã.";
    return null;
  }

  /** Trả về thông báo lỗi, hoặc null nếu thành công. */
  async function addTenant(code: string, name: string): Promise<string | null> {
    const error = validate(code.trim(), name);
    if (error) return error;
    try {
      await api("/rpc/add_tenant", { method: "POST", body: { code: code.trim(), name: name.trim() } });
      await load();
      return null;
    } catch (e) {
      return (e as Error).message;
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