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
  loaded_at: string;
}
