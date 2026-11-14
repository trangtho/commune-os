<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# apps/commune

Bảng quản trị cán bộ (Nuxt) cho CommuneOS. Dùng để duyệt, giải quyết và quản lý hồ sơ hành chính số từ công dân.

## Cấu trúc

- `pages/` – các trang quản trị (tổng quan, hồ sơ, thủ tục, thông báo, báo cáo, nhân viên)
- `components/` – MetricCard, StatusPill, ProcedureCard, CaseTimeline, DocUploader
- `server/api/` – API route xử lý nghiệp vụ (auth, hồ sơ, thủ tục, thông báo, nhân viên)
- `server/utils/` – kết nối PostgreSQL, phiên làm việc, xác thực đầu vào
- `types/models.ts` – TypeScript interfaces chia sẻ với cổng Công dân

## Cài đặt và chạy

```bash
cd apps/commune
npm install
npm run dev
```

Tài khoản demo: `canbo.demo` / `Demo@2026!`

## Kết nối với cổng Công dân

Hai cổng chia sẻ cùng cơ sở dữ liệu PostgreSQL (`communeos`). Cán bộ đăng nhập qua bảng `staff`, công dân qua bảng `citizens`.
