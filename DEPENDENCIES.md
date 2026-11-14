<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# Thành phần bên thứ ba

CommuneOS không đính kèm mã nguồn của dự án khác trong kho này. Mọi thành
phần dưới đây được lấy qua ảnh container chính thức hoặc trình quản lý gói,
có ghim phiên bản, và **không bị chỉnh sửa mã nguồn**; việc tùy biến chỉ thực
hiện bằng tệp cấu hình.

Quy tắc: thêm một dòng vào bảng trong cùng pull request đưa thành phần mới
vào dự án. Trước khi thêm, mở tệp LICENSE của dự án đó để xác nhận giấy phép
thuộc danh sách OSI (https://opensource.org/licenses).

## Dịch vụ (ảnh container)

| Thành phần    | Phiên bản | Giấy phép          | Nguồn                                      | Dùng để                                     |
| ------------- | --------- | ------------------ | ------------------------------------------ | ------------------------------------------- |
| PostgreSQL    | 17        | PostgreSQL License | Ảnh chính thức `postgres`                  | Cơ sở dữ liệu                               |
| Keycloak      | 26.8.2    | Apache-2.0         | Ảnh chính thức `quay.io/keycloak/keycloak` | Định danh, đăng nhập một lần (SSO), cấp JWT |
| Apache APISIX | 3.20.0    | Apache-2.0         | Ảnh chính thức `apache/apisix`             | Cửa ngõ API: định tuyến, kiểm JWT           |

## Thư viện (trình quản lý gói)

| Thư viện              | Phiên bản | Giấy phép | Nơi dùng                                 |
| --------------------- | --------- | --------- | ---------------------------------------- |
| Nuxt                  | 4.6.4     | MIT       | `core/admin`                             |
| Vue                   | 3.5.45    | MIT       | `core/admin`                             |
| Vue Router            | 5.5.1     | MIT       | `core/admin`                             |
| Tailwind CSS          | 6.14.0    | MIT       | `core/admin` (qua `@nuxtjs/tailwindcss`) |
| `@nuxtjs/tailwindcss` | 6.14.0    | MIT       | `core/admin`                             |
| `lucide-vue-next`     | 1.0.0     | ISC       | `core/admin`, bộ biểu tượng              |

## Mô hình AI

Trọng số mô hình không nằm trong kho mã; chúng được tải về khi cài đặt.

| Mô hình | Giấy phép | Dùng để |
| ------- | --------- | ------- |
|         |           |         |
