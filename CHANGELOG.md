<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# Lịch sử thay đổi

Mọi thay đổi đáng chú ý của dự án được ghi tại đây.
Định dạng theo [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/),
đánh số phiên bản theo [Semantic Versioning](https://semver.org/lang/vi/).

## [Chưa phát hành]

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
