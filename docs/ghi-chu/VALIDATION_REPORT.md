<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# Báo cáo kiểm tra bản bàn giao (13/11/2026)

## Đã kiểm tra trong môi trường tạo bản bàn giao

- `make test`: **6/6 kiểm tra cấu trúc tĩnh đạt**.
- Đã phân tích cú pháp TypeScript trong 57 tệp `.ts` hoặc `<script>` Vue:
  **không phát hiện lỗi cú pháp** (kiểm tra tĩnh, không phải type-check).
- Đã kiểm tra số lượng thẻ `<template>` mở/đóng trong các `.vue`: đạt.
- `docker-compose.yml`: tải thành công bằng YAML parser, có dịch vụ `db`, `db-setup`
  và `citizen` (đã kiểm tra thứ tự khởi động).
- Đã kiểm tra có schema, data seed, chính sách PostgreSQL RLS và tệp test
  `core/db/tests/citizen-rls.sql`.

## Chưa kiểm tra được tại thời điểm bàn giao

- **Chưa chạy `npm install` và `npm run build`** vì môi trường dựng gói không
  phân giải được `registry.npmjs.org`.
- **Chưa chạy Docker Compose hoặc PostgreSQL thật** vì môi trường này không
  cài Docker/psql; vì vậy chưa thể xác nhận migration, kết nối DB và RLS
  bằng kiểm thử thực thi.
- **Chưa chạy kiểm thử trình duyệt đầu-cuối** hoặc kiểm chứng pixel-perfect
  giữa ứng dụng thực tế và mẫu ảnh.
- Chưa đánh giá khả năng tải lớn, bảo mật ứng dụng production hoặc kiểm
  thử quyền liên xã tại backend thực tế.

**Yêu cầu nghiệm thu trên Ubuntu có Docker và kết nối Internet:**

```bash
cp .env.example .env
# đổi mật khẩu và SESSION_SECRET rồi mới chạy
make up
curl http://localhost:3000/api/health
make rls-test
make test
```

Mở trang trên trình duyệt, đăng nhập bằng tài khoản giả lập và làm theo các
kịch bản tại `docs/CITIZEN_SETUP.md`.

Bản này là implementation prototype, **chưa được xác nhận là đã build và
chạy end-to-end thành công**. Không triển khai Internet công cộng trước khi
thay thế cơ chế đăng nhập demo và bổ sung các biện pháp bảo mật sản phẩm thật.

## Sửa lỗi PostgreSQL (cập nhật)

- Đã thêm dịch vụ khởi tạo `db-setup` cho cả volume cũ; role `communeos_app`
  có thể được tạo/đồng bộ mật khẩu.
- Đã kiểm tra cú pháp YAML và các đường dẫn SQL, 6/6 kiểm tra cấu trúc đạt.
- Đã xác nhận patch áp dụng sạch lên mã nguồn bản ZIP trước (`git apply --check`).
- **Chưa chạy thử trên PostgreSQL/Docker thật**, do không có Docker trong môi trường.
- Sau khi giải nén và giữ `.env` cũ, chạy `make up`, `make doctor`,
  `curl -i http://localhost:3000/api/health` để xác nhận.
