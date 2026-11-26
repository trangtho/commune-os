<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# core/api-docs

Trang tài liệu API của lõi (Swagger UI), mở qua cổng: http://localhost:9080/docs/ (cổng theo `GATEWAY_PORT`).
Trang chỉ hiển thị đặc tả, không chứa dữ liệu. Lời gọi thử đi qua cổng APISIX như mọi ứng dụng khác, cần token
và bị RLS lọc theo xã như bình thường.

Hai đặc tả, chọn ở ô "Select a definition":

| Đặc tả | Nguồn | Nội dung |
| --- | --- | --- |
| Dịch vụ lõi | `core-services.yaml` (viết tay) | `/workflow`, `/files`, `/accounts`, `/ai`, `/public` |
| Dữ liệu – PostgREST | PostgREST tự sinh, qua `/docs/rest-openapi.json` | Mọi bảng ảo và hàm `rpc/*` của schema `api`, mô tả lấy từ `modules/xa/db/25-api-comments.sql` |

Lấy token: bấm **Authorize** ở đặc tả "Dịch vụ lõi", mục `keycloak`, nhập tài khoản thử trong README gốc
(`client_id` = `commune-app`). Token này được tự gắn vào lời gọi của cả hai đặc tả. Token công dân dùng
`client_id` = `citizen-app` và `client_secret` = `CITIZEN_KEYCLOAK_SECRET` trong `.env`.

Khi sửa hoặc thêm đường dẫn của dịch vụ Node.js trong `core/`, sửa `core-services.yaml` cho khớp.
Khi thêm hàm, bảng ảo vào schema `api`, thêm dòng mô tả vào tệp mô tả của gói (gói xã: `modules/xa/db/25-api-comments.sql`;
gói doanh nghiệp: `COMMENT ON` trong `db/nghi-phep.sql`) hoặc của lõi (`core/db/init/90-mo-ta-api.sql`).

Tệp trong thư mục:

- `core-services.yaml`: đặc tả OpenAPI 3 của các dịch vụ Node.js.
- `swagger-initializer.js`: cấu hình Swagger UI (hai đặc tả, đăng nhập Keycloak, tự gắn token).
- `50-communeos.sh`: chạy khi container khởi động, chép hai tệp trên vào thư mục web của Swagger UI.
