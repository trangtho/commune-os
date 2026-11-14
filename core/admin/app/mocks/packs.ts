// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Dữ liệu giả lập. Thời hạn và giấy tờ là giá trị minh họa, chưa đối chiếu
// quy định hiện hành.
import type { Pack } from "~/types";

export const mockPacks: Pack[] = [
  {
    code: "khai-sinh",
    name: "Đăng ký khai sinh",
    version: "1.0.0",
    sla_hours: 8,
    channels: ["counter", "online"],
    required_documents: [
      { code: "to-khai", name: "Tờ khai đăng ký khai sinh" },
      { code: "giay-chung-sinh", name: "Giấy chứng sinh" },
    ],
    roles: { receive: "receptionist", review: "officer", sign: "leader" },
    loaded_at: "2026-11-14T09:00:00+07:00",
  },
];
