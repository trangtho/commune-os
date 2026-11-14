<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# core/rest — API dữ liệu (PostgREST)

Mọi giao diện (bảng quản trị, màn hình cán bộ xã) đọc dữ liệu qua API này.

```
Đăng nhập Keycloak → token (tenant_id = mã xã, realm_access.roles = vai trò)
  → APISIX /rest/* kiểm tra token
  → PostgREST kiểm tra lại chữ ký, chuyển sang vai trò "commune-app"
  → PostgreSQL áp RLS: chỉ trả dữ liệu của đúng xã trong token
```

Mọi lời gọi cần header `Authorization: Bearer <token>`. Không có token → 401.

## Danh sách API

| Muốn                                 | Gọi                                                                        |
| ------------------------------------ | -------------------------------------------------------------------------- |
| Hồ sơ của xã (số điện thoại đã che)  | `GET /rest/dossiers`                                                       |
| Hồ sơ đang xử lý, hạn gần nhất trước | `GET /rest/dossiers?status=eq.processing&order=due_at`                     |
| Hồ sơ quá hạn                        | `GET /rest/dossiers?overdue=is.true`                                       |
| Một hồ sơ                            | `GET /rest/dossiers?id=eq.HS-2026-001248`                                  |
| Lịch sử xử lý một hồ sơ              | `GET /rest/dossier_events?dossier_id=eq.HS-2026-001248&order=created_at`   |
| Giấy tờ đã nộp của một hồ sơ         | `GET /rest/dossier_documents?dossier_id=eq.HS-2026-001248`                 |
| Giấy tờ cần nộp theo thủ tục         | `GET /rest/procedure_documents?procedure_id=eq.khai-sinh`                  |
| Danh mục thủ tục đang công bố        | `GET /rest/procedures`                                                     |
| Danh sách xã (sys_admin thấy tất cả) | `GET /rest/tenants`                                                        |
| Thêm xã (chỉ sys_admin)              | `POST /rest/rpc/add_tenant` với `{"code":"xa-c","name":"Xã C"}`            |
| Khóa / mở xã (chỉ sys_admin)         | `POST /rest/rpc/set_tenant_status` với `{"code":"xa-a","status":"locked"}` |

Hồ sơ thuộc về xã tiếp nhận: `tenant_code` là xã xử lý hồ sơ, `home_tenant_code` là xã của người nộp.

Cú pháp lọc, sắp xếp, chọn cột theo tài liệu PostgREST:
`?cot=eq.giatri`, `?order=cot.desc`, `?select=cot1,cot2`, `?limit=20`.

## Mã lỗi

| HTTP | Nghĩa                                                  |
| ---- | ------------------------------------------------------ |
| 401  | Không có token, token hết hạn hoặc bị sửa              |
| 403  | Đúng token nhưng không đủ quyền (vd cán bộ xã thêm xã) |
| 400  | Dữ liệu gửi lên sai (vd mã xã có chữ hoa)              |
| 409  | Dữ liệu đã tồn tại (vd trùng mã xã)                    |

## Tệp liên quan

- `core/db/init/02-create-api-roles.sh`: vai trò `authenticator` và `commune-app`.
- `core/db/init/03-api.sql`: schema `api`, chính sách RLS, hàm ghi.
- `core/rest/fetch-jwks.mjs`: lấy khóa công khai của Keycloak khi khởi động (dịch vụ `rest-keys`).
  Nếu đổi khóa trong Keycloak: `docker compose up -d --force-recreate rest-keys rest`.
