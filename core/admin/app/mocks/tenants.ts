// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Dữ liệu giả lập cho giai đoạn chưa có API. Hai mã xã trùng với tenant_id
// của tài khoản thử trong Keycloak.
import type { Tenant } from "~/types";

export const mockTenants: Tenant[] = [
  {
    id: 1,
    code: "xa-a",
    name: "Xã A",
    status: "active",
    created_at: "2026-11-14T08:00:00+07:00",
  },
  {
    id: 2,
    code: "xa-b",
    name: "Xã B",
    status: "active",
    created_at: "2026-11-14T08:05:00+07:00",
  },
];
