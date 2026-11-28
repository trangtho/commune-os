// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Địa chỉ màn hình cán bộ xã (ứng dụng của gói xã) để mở từ bảng quản trị. Cấu hình NUXT_PUBLIC_COMMUNE_URL thì dùng giá trị đó; không thì
// suy ra từ địa chỉ bảng quản trị đang mở, cùng máy chủ: qua proxy HTTPS (cổng 8444) thì màn hình cán bộ ở cổng 8443,
// chạy trực tiếp (cổng 3001) thì ở cổng 3002.
export function useCommuneUrl(): string {
  const configured = String(useRuntimeConfig().public.communeUrl || "");
  if (configured) return configured;
  const { protocol, hostname, port } = window.location;
  const communePort = port === "8444" ? "8443" : "3002";
  return `${protocol}//${hostname}:${communePort}`;
}
