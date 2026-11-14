// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Nơi duy nhất lấy và sửa dữ liệu xã. Hiện dùng dữ liệu giả; khi lõi có API,
// chỉ cần thay phần thân các hàm bằng lời gọi POST /admin/tenants qua cửa ngõ.
import type { Tenant } from "~/types";
import { mockTenants } from "~/mocks/tenants";

const CODE_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function useTenants() {
  const tenants = useState<Tenant[]>("tenants", () =>
    mockTenants.map((t) => ({ ...t })),
  );

  /** Trả về thông báo lỗi, hoặc null nếu hợp lệ. */
  function validate(code: string, name: string): string | null {
    if (!code) return "Vui lòng nhập mã xã.";
    if (!CODE_PATTERN.test(code)) {
      return "Mã xã chỉ gồm chữ thường không dấu, số và dấu gạch ngang, ví dụ: xa-c.";
    }
    if (tenants.value.some((t) => t.code === code))
      return `Mã xã "${code}" đã tồn tại.`;
    if (!name.trim()) return "Vui lòng nhập tên xã.";
    return null;
  }

  function addTenant(code: string, name: string): string | null {
    const error = validate(code.trim(), name);
    if (error) return error;
    const nextId = Math.max(0, ...tenants.value.map((t) => t.id)) + 1;
    tenants.value.push({
      id: nextId,
      code: code.trim(),
      name: name.trim(),
      status: "active",
      created_at: new Date().toISOString(),
    });
    return null;
  }

  function toggleLock(id: number) {
    const tenant = tenants.value.find((t) => t.id === id);
    if (tenant)
      tenant.status = tenant.status === "active" ? "locked" : "active";
  }

  return { tenants, addTenant, toggleLock };
}
