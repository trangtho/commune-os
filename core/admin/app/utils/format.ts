// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

/** Đổi chuỗi ISO thành ngày giờ kiểu Việt Nam, ví dụ "14/11/2026 08:00". */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(d);
}

export const CHANNEL_LABELS: Record<string, string> = {
  counter: "Tại quầy",
  online: "Trực tuyến",
};

export const ROLE_LABELS: Record<string, string> = {
  receptionist: "Cán bộ tiếp nhận",
  officer: "Chuyên viên",
  leader: "Lãnh đạo xã",
  supervisor: "Cấp trên",
  sys_admin: "Quản trị hệ thống",
};
