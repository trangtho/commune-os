<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# Thanh tiêu đề (banner) – Kênh Công dân

## Hiện trạng

- Thanh tiêu đề dưới header là nền xanh trơn, giống nhau ở mọi trang; chỉ tiêu đề và một dòng mô tả đổi theo trang
  (`apps/citizen/layouts/default.vue`).
- Không còn dùng ảnh trụ sở UBND (`ubnd-hero.png`, `ubnd-hero-clean.png`) ở thanh tiêu đề và trang đăng nhập của
  cả Kênh người dân lẫn màn hình cán bộ; hai tệp ảnh đã được gỡ khỏi `public/images/`.
- Bốn bước nộp hồ sơ chỉ hiện trong thanh tiêu đề khi đang nộp hồ sơ, là thành phần Vue (chữ thật), dạng lưới từ màn hình
  `xl` (>= 1280px), màn hình hẹp vuốt ngang được.
- Giữ nguyên kiến trúc `100dvh`: header và thanh tiêu đề cố định, vùng nội dung cuộn riêng.

## Xem kết quả

```bash
docker compose up -d --build citizen commune
```

Mở `http://localhost:3000`, nhấn Ctrl+Shift+R để tải lại CSS mới.
