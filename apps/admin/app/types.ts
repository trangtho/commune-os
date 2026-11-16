// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

export type TenantStatus = "active" | "locked";

export interface Tenant {
  id: string;
  code: string;
  name: string;
  status: TenantStatus;
  created_at: string;
  dossier_count: number;
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
