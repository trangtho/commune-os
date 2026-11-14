<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# core/admin

Bảng quản trị hệ thống (Nuxt 4) cho quản trị viên. Đây là giao diện quản trị
bắt buộc của lõi; không dành cho cán bộ xã hay người dân.

## Chức năng

- Đăng nhập bằng Keycloak; chỉ tài khoản có vai trò `sys_admin` vào được.
- Danh sách xã: xem số hồ sơ, thêm xã, khóa / mở khóa xã (dữ liệu thật trong PostgreSQL).
- Thủ tục, Kiểm tra hồ sơ đã ký, Tình trạng hệ thống: đang làm.

## Chạy thử

Cần các dịch vụ lõi đang chạy (`docker compose up -d` ở thư mục gốc) và tài
khoản demo `quantri` được nạp bằng `make seed` vào Keycloak (xem mục "Tài khoản thử" ở README gốc).

```bash
cd core/admin
npm install
npm run dev -- --port 3001
```

Mở http://localhost:3001 và đăng nhập bằng `quantri`.

## Cách gọi dữ liệu

- Đăng nhập: trang gọi `POST /api/dang-nhap`, máy chủ Nuxt đổi tài khoản lấy
  token từ Keycloak (`server/api/dang-nhap.post.ts`). Token giữ trong
  `sessionStorage`, đóng tab là phải đăng nhập lại.
- Dữ liệu: mọi lời gọi `/rest/...` được Nuxt chuyển tiếp sang cổng APISIX
  (`routeRules` trong `nuxt.config.ts`), nên không có lỗi CORS.
- Một chỗ duy nhất gọi API: `app/composables/useApi.ts`. Danh sách API xem
  [core/rest/README.md](../rest/README.md).

| Biến môi trường | Mặc định                | Ý nghĩa          |
| --------------- | ----------------------- | ---------------- |
| `GATEWAY_URL`   | `http://localhost:9080` | Cổng APISIX      |
| `KEYCLOAK_URL`  | `http://localhost:8080` | Máy chủ Keycloak |
