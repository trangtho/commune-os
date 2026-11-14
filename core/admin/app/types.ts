// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

export type TenantStatus = "active" | "locked";

export interface Tenant {
  id: number;
  code: string;
  name: string;
  status: TenantStatus;
  created_at: string;
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
  loaded_at: string;
}
