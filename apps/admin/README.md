<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# apps/admin

Bảng quản trị hệ thống (Nuxt 4) cho quản trị viên. Đây là một ứng dụng Tầng 2:
nó không nằm trong lõi mà gọi lõi qua cổng API như mọi ứng dụng khác (lõi không có giao diện).
Không dành cho cán bộ xã hay người dân.

## Chức năng

- Đăng nhập bằng Keycloak; chỉ tài khoản có vai trò `sys_admin` vào được.
- Danh sách xã: tìm kiếm, xem số hồ sơ và số thủ tục đang mở, thêm xã, khóa / mở khóa xã.
- Chi tiết xã: tổng quan, sổ ghi nhận, mở / tắt thủ tục theo lĩnh vực hoặc hàng loạt.
- Danh mục thủ tục: xem, nạp gói thủ tục từ `pack.yaml`, chọn xã được mở.
- Kiểm tra hồ sơ đã ký (`/so-cai`): xem sổ ghi nhận và kiểm tra chuỗi băm.
- Tình trạng hệ thống (`/tinh-trang`): kiểm tra từng dịch vụ lõi qua cổng (định danh, cổng API và dữ liệu, quy trình,
  lưu trữ tệp, tài khoản cán bộ, AI, sổ ghi nhận), kèm thời gian phản hồi; tự kiểm tra lại mỗi 30 giây. Chỉ đọc.

## Chạy thử

Cần các dịch vụ lõi đang chạy (`docker compose up -d` ở thư mục gốc). Tài khoản quản trị hệ thống là
`COMMUNEOS_ADMIN_USERNAME` / `COMMUNEOS_ADMIN_PASSWORD` trong `.env` (xem mục "Tài khoản thử" ở README gốc).

```bash
cd apps/admin
npm install
npm run dev -- --port 3001
```

Mở http://localhost:3001 và đăng nhập bằng tài khoản quản trị trong `.env`.

## Cách gọi dữ liệu

- Đăng nhập: trang gọi `POST /api/dang-nhap`, máy chủ Nuxt đổi tài khoản lấy
  token từ Keycloak (`server/api/dang-nhap.post.ts`). Token giữ trong
  `sessionStorage`, đóng tab là phải đăng nhập lại.
- Dữ liệu: mọi lời gọi `/rest/...` (và `/workflow`, `/files`, `/accounts`, `/ai` của trang Tình trạng hệ thống)
  được Nuxt chuyển tiếp sang cổng APISIX (`routeRules` trong `nuxt.config.ts`), nên không có lỗi CORS.
- Một chỗ duy nhất gọi API: `app/composables/useApi.ts`. Danh sách API xem
  [core/rest/README.md](../../core/rest/README.md).

| Biến môi trường | Mặc định                | Ý nghĩa          |
| --------------- | ----------------------- | ---------------- |
| `GATEWAY_URL`   | `http://localhost:9080` | Cổng APISIX      |
| `KEYCLOAK_URL`  | `http://localhost:8080` | Máy chủ Keycloak |
