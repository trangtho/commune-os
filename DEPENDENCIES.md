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

| Thành phần | Phiên bản | Giấy phép | Nguồn | Dùng để |
| --- | --- | --- | --- | --- |
| PostgreSQL | 17 | PostgreSQL License | Ảnh chính thức `postgres` | Cơ sở dữ liệu |

## Thư viện (trình quản lý gói)

| Thư viện | Phiên bản | Giấy phép | Nơi dùng |
| --- | --- | --- | --- |
| | | | |

## Mô hình AI

Trọng số mô hình không nằm trong kho mã; chúng được tải về khi cài đặt.

| Mô hình | Giấy phép | Dùng để |
| --- | --- | --- |
| | | |

## Kênh Công dân (bổ sung)

| Gói/dịch vụ | Vai trò | Ghi chú giấy phép / xác minh |
| --- | --- | --- |
| Nuxt 3 | Framework SSR | MIT; xác minh bản đang cài từ LICENSE |
| Vue 3 | Giao diện | MIT; xác minh LICENSE |
| TypeScript | Kiểm tra kiểu | Apache-2.0 |
| Tailwind CSS 3 | Utility CSS | MIT |
| `@nuxtjs/tailwindcss` | Module Tailwind cho Nuxt | MIT; xác minh LICENSE |
| `lucide-vue-next` | Icon SVG | ISC; xác minh LICENSE |
| `pg` (node-postgres) | Truy vấn PostgreSQL | MIT |
| `zod` | Kiểm tra dữ liệu đầu vào | MIT |
| PostgreSQL 17 | CSDL, RLS | PostgreSQL License |

Các số phiên bản được khóa theo semver trong `apps/citizen/package.json`.
Trước khi phát hành cần thực hiện `npm install` để tạo / commit
`package-lock.json` và chạy `reuse lint`/kiểm toán giấy phép trong CI.
