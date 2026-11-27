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
| PostgreSQL + pgvector | 17, pgvector 0.8.1 | PostgreSQL License | Ảnh `pgvector/pgvector:0.8.1-pg17-trixie` (dựng trên ảnh chính thức `postgres`) | Cơ sở dữ liệu, tìm kiếm vector |
| Keycloak      | 26.8.2    | Apache-2.0         | Ảnh chính thức `quay.io/keycloak/keycloak` | Định danh, đăng nhập một lần (SSO), cấp JWT |
| Apache APISIX | 3.20.0    | Apache-2.0         | Ảnh chính thức `apache/apisix`             | Cửa ngõ API: định tuyến, kiểm JWT           |
| Node.js       | 22-alpine | MIT                | Ảnh chính thức `node`                      | Chạy các ứng dụng Nuxt, portal doanh nghiệp (chỉ thư viện chuẩn Node), generator và dịch vụ điều phối |
| PostgREST     | 16.5      | MIT                | Ảnh chính thức postgrest/postgrest         | API dữ liệu sau gateway                     |
| Flowable REST | 8.0.0     | Apache-2.0         | Ảnh chính thức flowable/flowable-rest      | Động cơ quy trình BPMN                      |
| SeaweedFS     | 4.53      | Apache-2.0         | Ảnh chính thức chrislusf/seaweedfs         | Kho đối tượng chuẩn S3 (giấy tờ hồ sơ)      |
| Ollama        | 0.12.6    | MIT                | Ảnh chính thức `ollama/ollama`             | Chạy mô hình AI cục bộ (CPU hoặc GPU)       |
| ClamAV        | 1.5.2     | GPL-2.0-only       | Ảnh chính thức clamav/clamav (tùy chọn)    | Quét mã độc tệp tải lên, chạy dịch vụ riêng |
| Swagger UI    | 5.17.14   | Apache-2.0         | Ảnh chính thức `swaggerapi/swagger-ui`     | Trang tài liệu API của lõi (`/docs/`)       |

## Thư viện (trình quản lý gói)

| Thư viện              | Phiên bản | Giấy phép  | Nơi dùng                                       |
| --------------------- | --------- | ---------- | ---------------------------------------------- |
| Nuxt                  | ^4.6.4    | MIT        | `apps/admin`                                   |
| Nuxt                  | ^3.17.5   | MIT        | `apps/citizen`, `apps/commune`                 |
| Vue                   | ^3.5.45   | MIT        | `apps/admin`                                   |
| Vue                   | ^3.5.13   | MIT        | `apps/citizen`, `apps/commune`                 |
| Vue Router            | ^5.4.0    | MIT        | `apps/admin`                                   |
| Vue Router            | ^4.5.1    | MIT        | `apps/citizen`, `apps/commune`                 |
| Tailwind CSS          | ^3.4.17   | MIT        | `apps/admin`, `apps/citizen`, `apps/commune`   |
| `@nuxtjs/tailwindcss` | ^6.14.0   | MIT        | `apps/admin`, `apps/citizen`, `apps/commune`   |
| `lucide-vue-next`     | ^1.0.0    | ISC        | `apps/admin`, bộ biểu tượng                    |
| `lucide-vue-next`     | ^0.468.0  | ISC        | `apps/citizen`, `apps/commune`, bộ biểu tượng  |
| `@fontsource/be-vietnam-pro` | 5.3.0 | OFL-1.1 | `apps/admin`, `apps/citizen`, `apps/commune`, phông chữ đóng gói cùng ứng dụng |
| `pg`                  | ^8.16.0   | MIT        | `apps/citizen` (LISTEN thời gian thực)        |
| `zod`                 | ^3.25.0   | MIT        | `apps/citizen`, `apps/commune`                 |
| TypeScript            | ^5.8.0    | Apache-2.0 | `apps/citizen`, `apps/commune`                 |
| `vue-tsc`             | ^2.2.12   | MIT        | `apps/commune`, kiểm tra kiểu                  |
| `@types/pg`           | ^8.15.0   | MIT        | `apps/citizen` (LISTEN thời gian thực)        |
| `@types/node`         | ^22.15.0  | MIT        | `apps/citizen`, `apps/commune`                 |
| `@playwright/test`    | ^1.56.1   | Apache-2.0 | `apps/citizen`, kiểm thử giao diện             |

Các dịch vụ của lõi (`core/orchestrator`, `core/files`) chỉ dùng Node.js, không có thư viện ngoài.

Các phiên bản có dấu `^` lấy từ `package.json` và là ràng buộc semver, không
phải phiên bản cài đặt chính xác. Trước khi phát hành cần xác minh giấy phép
theo phiên bản thực tế trong `package-lock.json`.

## Mô hình AI

Kho mã không chứa trọng số mô hình. Dịch vụ `ai-models` tải mô hình từ thư viện Ollama vào volume
Docker ở lần chạy đầu. Mô hình chạy trên máy chủ của đơn vị, không gọi API AI bên ngoài vì dữ liệu là dữ liệu mật.

| Mô hình | Phiên bản (thẻ Ollama) | Giấy phép | Dùng để |
| --- | --- | --- | --- |
| Qwen3 1.7B (Alibaba Qwen) | `qwen3:1.7b` | Apache-2.0 | Chọn câu trích dẫn (mặc định, `AI_CHAT_MODEL`) |
| BGE-M3 (BAAI) | `bge-m3` | MIT | Vector 1024 chiều cho tìm kiếm ngữ nghĩa (`AI_EMBED_MODEL`) |

Đổi mô hình qua `.env` thì người triển khai tự kiểm tra giấy phép của mô hình đó; chỉ dùng mô hình
có giấy phép mở (Apache-2.0, MIT).
