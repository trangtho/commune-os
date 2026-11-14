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
| Node.js       | 22-alpine | MIT                | Ảnh chính thức `node`                      | Build và chạy Kênh Công dân (Nuxt 3)        |

## Thư viện (trình quản lý gói)

| Thư viện              | Phiên bản | Giấy phép  | Nơi dùng       |
| --------------------- | --------- | ---------- | -------------- |
| Nuxt                  | ^3.17.5   | MIT        | `apps/citizen` |
| Vue                   | ^3.5.13   | MIT        | `apps/citizen` |
| Vue Router            | ^4.5.1    | MIT        | `apps/citizen` |
| `pg`                  | ^8.16.0   | MIT        | `apps/citizen` |
| `zod`                 | ^3.25.0   | MIT        | `apps/citizen` |
| `lucide-vue-next`     | ^0.468.0  | ISC        | `apps/citizen` |
| TypeScript            | ^5.8.0    | Apache-2.0 | `apps/citizen` |
| Tailwind CSS          | ^3.4.17   | MIT        | `apps/citizen` |
| `@nuxtjs/tailwindcss` | ^6.14.0   | MIT        | `apps/citizen` |
| `@types/pg`           | ^8.15.0   | MIT        | `apps/citizen` |
| `@types/node`         | ^22.15.0  | MIT        | `apps/citizen` |

Các phiên bản có dấu `^` lấy từ `apps/citizen/package.json` và là ràng buộc
semver, không phải phiên bản cài đặt chính xác. Trước khi phát hành cần tạo
`package-lock.json` và xác minh giấy phép theo phiên bản thực tế.

## Mô hình AI

Trọng số mô hình không nằm trong kho mã; chúng được tải về khi cài đặt.

| Mô hình | Giấy phép | Dùng để |
| ------- | --------- | ------- |
|         |           |         |
