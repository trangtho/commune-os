<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# apps/commune

Bảng quản trị cán bộ (Nuxt) cho CommuneOS. Dùng để duyệt, giải quyết và quản lý hồ sơ hành chính số từ công dân.

## Cấu trúc

- `pages/` – các trang quản trị (tổng quan, hồ sơ, thủ tục, thông báo, báo cáo, nhân viên)
- `components/` – MetricCard, StatusPill, ProcedureCard, CaseTimeline, DocUploader
- `server/api/` – API route xử lý nghiệp vụ (auth, hồ sơ, thủ tục, thông báo, nhân viên)
- `server/utils/` – gọi API lõi (`core-api.ts`, `core-files.ts`, `core-accounts.ts`), phiên làm việc, xác thực đầu vào.
  `database.ts` (kết nối PostgreSQL trực tiếp bằng vai trò `communeos_app`) chỉ còn dùng cho xác nhận
  bổ sung hồ sơ và `/api/health`; biến kết nối `NUXT_DB_*` khai báo trong `docker-compose.yml`.
- Thông báo (`/thong-bao`): thông báo cho cán bộ do lõi tự sinh (hồ sơ mới, được giao hồ sơ, hồ sơ đã bổ sung,
  yêu cầu và kết quả duyệt), đọc qua `/rest/staff_notifications`; trạng thái đã đọc tính riêng từng cán bộ.
  Chỉ lãnh đạo xã gửi được thông báo cho công dân của xã.
- `types/models.ts` – TypeScript interfaces chia sẻ với cổng Công dân

## Cài đặt và chạy

```bash
cd apps/commune
npm install
npm run dev
```

Tài khoản thử (Keycloak): `canbo.xa-a`, `canbo.xa-b` (cán bộ xử lý), `lanhdao.xa-a`, `lanhdao.xa-b`
(lãnh đạo, thấy thêm khu Nhân viên), mật khẩu `12345`.

Chạy: `SESSION_SECRET=$(openssl rand -hex 32) npm run dev -- --port 3002`
(cần `docker compose up -d` ở thư mục gốc).

## Kết nối với lõi

Cán bộ đăng nhập qua Keycloak; danh sách và chi tiết hồ sơ lấy từ API lõi
(`GATEWAY_URL`, mặc định `http://localhost:9080`). Lõi tự lọc theo xã trong token.
