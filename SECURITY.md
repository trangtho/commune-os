<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# Chính sách bảo mật

## Báo lỗ hổng

Nếu bạn phát hiện lỗ hổng bảo mật, xin **đừng mở issue công khai**. Hãy dùng mục
**Security → Report a vulnerability** của kho mã trên GitHub để báo riêng cho nhóm.

Xin nêu rõ: phần bị ảnh hưởng, các bước làm lại, và mức độ ảnh hưởng theo bạn đánh giá.
Nhóm sẽ phản hồi trong vòng 7 ngày.

## Phạm vi

- Mã nguồn trong kho này (lõi, bảng quản trị, ứng dụng Tầng 2).
- Cấu hình mẫu trong `docker-compose.yml` và `.env.example`.

## Lưu ý khi triển khai

- Tài khoản mẫu do `make demo` tạo (`canbo.xa-a`, `congdan.demo`...) dùng chung một mật khẩu công khai, chỉ dành
  cho máy phát triển; không chạy `make demo` trên máy chủ thật. Tài khoản quản trị hệ thống đặt trong `.env`.
- Mọi mật khẩu trong `.env` phải được thay bằng giá trị ngẫu nhiên: `make secrets`. Khi máy chủ mở cho máy khác
  (`COMMUNEOS_DOMAIN` khác localhost, `PORTAL_BIND_ADDRESS` khác 127.0.0.1 hoặc bật HTTPS), `make up` từ chối giá trị mẫu.
- Đưa ra Internet thì luôn bật HTTPS (`COMPOSE_PROFILES=https`) và giữ `PORTAL_BIND_ADDRESS=127.0.0.1`; PostgreSQL không
  bao giờ mở ra ngoài máy chủ. Hướng dẫn: [core/ops/README.md](core/ops/README.md).
- Không đưa dữ liệu cá nhân thật vào dữ liệu mẫu, issue hay ảnh chụp màn hình.
