// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

export type TenantStatus = "active" | "locked";

/** Tài khoản lãnh đạo xã (dịch vụ tài khoản của lõi, /accounts/tenants/:code/leaders). */
export interface Leader {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string | null;
  enabled: boolean;
  createdAt: string;
  mustChangePassword: boolean;
}

/** Mật khẩu tạm chỉ trả về một lần, lãnh đạo phải đổi khi đăng nhập lần đầu. */
export interface IssuedPassword {
  username: string;
  temporaryPassword: string;
}

export interface Tenant {
  id: string;
  code: string;
  name: string;
  status: TenantStatus;
  created_at: string;
  /** Gói xã thêm cột này; không cài gói xã thì không có. */
  dossier_count?: number;
}

/** Gói nghiệp vụ đã cài trên lõi (GET /rest/modules). */
export interface Module {
  name: string;
  title: string;
  version: string;
}

/** Gói bật cho một đơn vị (GET /rest/tenant_modules). */
export interface TenantModule {
  tenant_code: string;
  module: string;
  title: string;
}

export type Channel = "counter" | "online";

export interface RequiredDocument {
  code: string;
  name: string;
}

export interface Pack {
  code: string;
  name: string;
  version: string;
  sla_hours: number;
  channels: Channel[];
  required_documents: RequiredDocument[];
  roles: { receive: string; review: string; sign: string };
  category: string | null;
  summary: string | null;
}

/** Một thủ tục trong danh mục của lõi (GET /rest/procedures, quyền sys_admin). */
export interface Procedure {
  id: string;
  title: string;
  category: string;
  version: string;
  sla_days: number;
  updated_at: string;
  summary: string;
  enabled_tenants: string[];
}

/** Giấy tờ cần nộp của một thủ tục (GET /rest/procedure_documents). */
export interface ProcedureDocument {
  procedure_id: string;
  document_code: string;
  document_name: string;
  is_required: boolean;
}

/** Kết quả kiểm tra sổ ghi nhận của một xã (POST /rest/rpc/verify_ledger). */
export interface LedgerCheck {
  tenant_code: string;
  entries: number;
  ok: boolean;
  broken_seq: number | null;
  reason: string | null;
}
