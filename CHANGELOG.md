<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# Lịch sử thay đổi

Mọi thay đổi đáng chú ý của dự án được ghi tại đây.
Định dạng theo [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/),
đánh số phiên bản theo [Semantic Versioning](https://semver.org/lang/vi/).

## [Chưa phát hành]

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

### Sửa lỗi

- Bỏ khóa ký token khỏi tệp realm; mỗi nơi cài đặt tự sinh khóa riêng khi khởi động lần đầu.
<!--
Mẫu cho mỗi bản phát hành:

## [0.1.0] - 2026-11-15

### Thêm mới

### Thay đổi

### Sửa lỗi

-->
