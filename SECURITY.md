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

- Tài khoản và mật khẩu mẫu (`canbo.xa-a`, `quantri`, `congdan.demo`...) chỉ dành cho
  máy phát triển. Phải đổi hoặc xóa trước khi dùng thật.
- Mọi mật khẩu trong `.env` phải được thay bằng giá trị ngẫu nhiên.
- Không đưa dữ liệu cá nhân thật vào dữ liệu mẫu, issue hay ảnh chụp màn hình.
