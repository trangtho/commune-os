<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# Lịch sử thay đổi

Mọi thay đổi đáng chú ý của dự án được ghi tại đây.
Định dạng theo [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/),
đánh số phiên bản theo [Semantic Versioning](https://semver.org/lang/vi/).

## [Chưa phát hành]

### Thêm mới (xử lý hồ sơ, 2026-11-15)

- Hàm `api.set_dossier_status`: cán bộ xã chuyển xử lý, yêu cầu bổ sung, hoàn thành, từ chối hồ sơ của xã mình; kiểm tra vai trò, bước chuyển hợp lệ và lý do bắt buộc ngay trong cơ sở dữ liệu.
- Mỗi lần đổi trạng thái tự ghi lịch sử và gửi thông báo cho người dân.
- View `api.dossier_transitions` liệt kê các bước chuyển được phép.
- `apps/commune`: nút Cập nhật trạng thái và Yêu cầu bổ sung gọi API lõi.
- `make test` tăng lên 12 kiểm tra.

### Thêm mới (màn hình cán bộ xã, 2026-11-15)

- `apps/commune` đăng nhập bằng Keycloak và đọc hồ sơ qua API lõi `/rest`; bỏ tài khoản cứng `canbo.demo`.
- API lọc hồ sơ theo xã tiếp nhận (`receiving_tenant_id`); thêm cột `home_tenant_code`, `category`, `description`, `form_data`, `result_note`, `updated_at` cho `dossiers`.
- Thêm view `dossier_documents`, `procedure_documents`.
- Token truy cập Keycloak có thời hạn 30 phút.

### Thêm mới (lõi, 2026-11-14)

- API dữ liệu PostgREST 16.5 sau cổng APISIX tại `/rest/*`; PostgREST tự kiểm tra lại chữ ký token Keycloak (JWKS).
- Schema `api`: `dossiers`, `dossier_events`, `procedures`, `tenants` (chỉ đọc, số điện thoại được che) và hàm `add_tenant`, `set_tenant_status` (chỉ vai trò `sys_admin`).
- Cách ly xã bằng RLS theo claim `tenant_id` của token; xã bị khóa thì cán bộ xã đó không đọc được hồ sơ nào.
- Bảng quản trị: đăng nhập Keycloak (chỉ `sys_admin`), màn hình Danh sách xã dùng dữ liệu thật (thêm, khóa/mở xã), nút đăng xuất.
- Kiểm thử `make test`: 9 kiểm tra cách ly xã và phân quyền qua gateway.

### Thay đổi

- Mã xã mẫu đổi `XA-DEMO`/`XA-TEST-2` thành `xa-a`/`xa-b` cho khớp tài khoản Keycloak; tự cập nhật trên dữ liệu cũ.
- Kiểm thử Kênh người dân chuyển sang `make test-citizen`.
- Biến mới bắt buộc trong `.env`: `POSTGRES_REST_PASSWORD`.

### Cải thiện cổng Công dân (2026-11-14)

- Sửa quyền UPDATE PostgreSQL cho luồng tạo/sửa bản nháp và nộp hồ sơ, không nới lỏng RLS.
- Phân biệt bản nháp chưa nộp với hồ sơ có thời hạn; chặn bỏ qua bước và khôi phục bản nháp qua SSR.
- Cải thiện kiểm tra upload, bổ sung hồ sơ, tìm kiếm tiếng Việt không dấu và xử lý lỗi API.
- Hiển thị bộ đếm thông báo chưa đọc theo SSE, làm gọn khối hỗ trợ và menu responsive.
- Cho phép in phiếu kết quả không cắt viewport; tăng bộ test tĩnh lên 20.
- Tài liệu triển khai, phạm vi/chức năng chưa hoàn thiện tại `docs/UPDATE_2026-11-14.md`.

### Thêm mới

- Dịch vụ định danh Keycloak 26.8.2, dùng database riêng trên cùng máy chủ PostgreSQL.
- Realm `communeos` nạp tự động khi khởi động, gồm 5 vai người dùng và claim `tenant_id` trong JWT.
- Hai tài khoản thử thuộc hai xã mẫu.
- Khung kho mã: giấy phép Apache-2.0, README, tài liệu đóng góp.
- Cấu trúc thư mục `core/`, `apps/`, `packs/`, `docs/`.
- Tệp `.env.example` và `Makefile`.
- Cửa ngõ API Apache APISIX 3.20.0 chạy ở chế độ đọc cấu hình từ tệp, không cần etcd.
- Cửa ngõ kiểm chữ ký và nơi cấp của JWT do Keycloak phát hành trên tuyến `/api/*`.
- Biến `KEYCLOAK_PUBLIC_URL` và `GATEWAY_PORT` trong `.env`.
- Bảng quản trị lõi (`core/admin`): khung giao diện, màn hình quản lý xã và gói thủ tục, dùng dữ liệu giả lập.
- PostgREST sau cổng /rest/\*.
- Thêm schema api + RLS cách ly xã.
- Bảng quản trị dùng dữ liệu thật.
- make test
- Biến mới POSTGRES_REST_PASSWORD

### Sửa lỗi

- Bỏ khóa ký token khỏi tệp realm; mỗi nơi cài đặt tự sinh khóa riêng khi khởi động lần đầu.
<!--
Mẫu cho mỗi bản phát hành:

## [0.1.0] - 2026-11-15

### Thêm mới

### Thay đổi

### Sửa lỗi

-->

## Unreleased — Kênh Công dân Nuxt + PostgreSQL mẫu

- Bổ sung giao diện Công dân dùng chung design system theo bản mockup thống nhất.
- Bổ sung bảng, dữ liệu seed và RLS cho PostgreSQL 17.
- Bổ sung API đăng nhập demo ký cookie; danh mục thủ tục, hồ sơ, tệp, thông báo,
  phản hồi và hồ sơ cá nhân.
- Triển khai luồng bản nháp → tải giấy tờ → kiểm tra Poka-yoke → nộp hồ sơ.
- Bổ sung Docker Compose và tài liệu chạy thử; không cam kết OIDC/AI/OTP thật.

## Citizen database connectivity fix (2026-11-13)

- Chạy `db-setup` cho cả volume PostgreSQL cũ, tự tạo schema và seed thủ tục.
- Đồng bộ mật khẩu role `communeos_app` khi triển khai lại; giữ nguyên dữ liệu.
- Cải tiến `/api/health` để kiểm tra bảng, quyền và thủ tục đã được nạp.
- Thêm `make repair-db`, `make doctor` và thông báo lỗi dễ xử lý trong UI.
