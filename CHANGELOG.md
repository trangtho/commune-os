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
