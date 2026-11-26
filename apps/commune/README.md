<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# apps/commune

Bảng quản trị cán bộ (Nuxt) cho CommuneOS. Dùng để duyệt, giải quyết và quản lý hồ sơ hành chính số từ công dân.

## Cấu trúc

- `pages/` – các trang quản trị (tổng quan, hồ sơ, thủ tục, thông báo, báo cáo, nhân viên)
- `components/` – MetricCard, StatusPill, ProcedureCard, CaseTimeline, DocUploader
- `server/api/` – API route xử lý nghiệp vụ (auth, hồ sơ, thủ tục, thông báo, nhân viên)
- `server/utils/` – gọi API lõi (`core-api.ts`, `core-files.ts`, `core-accounts.ts`), phiên làm việc, xác thực đầu vào.
  Không kết nối PostgreSQL trực tiếp. Xác nhận bổ sung hồ sơ đi qua Workflow; `/api/health` kiểm tra lõi qua APISIX.
  Phiên đăng nhập dùng cookie mã hóa HttpOnly và refresh token.
- Thông báo (`/thong-bao`): thông báo cho cán bộ do lõi tự sinh (hồ sơ mới, được giao hồ sơ, hồ sơ đã bổ sung,
  yêu cầu và kết quả duyệt), đọc qua `/rest/staff_notifications`; trạng thái đã đọc tính riêng từng cán bộ.
  Chỉ lãnh đạo xã gửi được thông báo cho công dân của xã.
- Trợ lý AI nghiệp vụ: nút nổi trên mọi trang (`components/StaffAssistant.vue`, `server/api/tro-ly.post.ts`), gọi cổng AI
  của lõi bằng token cán bộ; chỉ dùng thủ tục xã đang mở và hướng dẫn nghiệp vụ, không truy cập hồ sơ hay dữ liệu công dân.
- `types/models.ts` – TypeScript interfaces chia sẻ với cổng Công dân

## Cài đặt và chạy

```bash
cd apps/commune
npm ci
SESSION_SECRET=$(openssl rand -hex 32) npm run dev
```

Tài khoản thử do `make demo` tạo: `canbo.xa-a`, `canbo.xa-b` (cán bộ xử lý), `lanhdao.xa-a`, `lanhdao.xa-b`
(lãnh đạo, thấy thêm khu Nhân viên), mật khẩu `Demo@2026!` (`DEMO_PASSWORD`).

Chạy: `SESSION_SECRET=$(openssl rand -hex 32) npm run dev -- --port 3002`
(cần `docker compose up -d` ở thư mục gốc).

## Kết nối với lõi

Cán bộ đăng nhập qua Keycloak; danh sách và chi tiết hồ sơ lấy từ API lõi
(`GATEWAY_URL`, mặc định `http://localhost:9080`). Lõi tự lọc theo xã trong token.
