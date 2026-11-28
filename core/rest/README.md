<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# core/rest — API dữ liệu (PostgREST)

Mọi ứng dụng (bảng quản trị, ứng dụng của các gói) đọc ghi dữ liệu qua API này. PostgREST sinh API từ schema `api`
của PostgreSQL: phần của lõi (bảng `core/db/init/`) và phần của các gói đang cài (`modules/<gói>/db/`). Gói khai báo
thêm vai trò PostgREST cho người dùng bên ngoài của mình (gói xã: `citizen-app` cho công dân); khách gọi các hàm gói khai
báo ở mục `publicRpc` qua `/public/rpc/...`.

```
Đăng nhập Keycloak → token (tenant_id = mã đơn vị, realm_access.roles = vai trò)
  → APISIX /rest/* kiểm tra token
  → PostgREST kiểm tra lại chữ ký, chuyển sang vai trò "commune-app"
  → PostgreSQL áp RLS: chỉ trả dữ liệu của đúng đơn vị trong token
```

Mọi lời gọi cần header `Authorization: Bearer <token>`. Không có token → 401.

## API của lõi

| Muốn | Gọi |
| --- | --- |
| Danh sách đơn vị (sys_admin thấy tất cả) | `GET /rest/tenants` |
| Thêm đơn vị (chỉ sys_admin) | `POST /rest/rpc/add_tenant` với `{"code":"cong-ty-a","name":"Công ty A"}`; tạo kèm lãnh đạo thì dùng `POST /accounts/tenants` |
| Khóa / mở đơn vị (chỉ sys_admin) | `POST /rest/rpc/set_tenant_status` với `{"code":"cong-ty-a","status":"locked"}` |
| Gói đang cài | `GET /rest/modules`; khách: `POST /public/rpc/public_platform` |
| Gói của từng đơn vị; bật, tắt (sys_admin) | `GET /rest/tenant_modules`, `POST /rest/rpc/my_modules`, `POST /rest/rpc/set_tenant_module` |
| Vai trò riêng của các gói đơn vị dùng | `GET /rest/module_roles` (gán qua `PUT /accounts/staff/{id}/roles`) |
| Xem sổ ghi nhận | `GET /rest/ledger?order=seq.desc&limit=30` (`ref_id`: mã đối tượng, ví dụ mã hồ sơ, mã đơn) |
| Kiểm tra sổ có bị sửa không | `POST /rest/rpc/verify_ledger` với `{}` hoặc `{"only_tenant":"cong-ty-a"}` |
| Kho tri thức của đơn vị | `GET /rest/knowledge_documents`; lãnh đạo `POST /rest/rpc/knowledge_add`, `knowledge_remove` |
| Nhật ký quản lý cán bộ (lãnh đạo) | `GET /rest/staff_audit` |
| Đổi trạng thái đối tượng theo quy trình | Không gọi ở đây: dùng `POST /workflow/<loại>/<mã>/actions` (xem `core/orchestrator`) |
| Tệp đính kèm | Không gọi ở đây: dùng `/files/<loại>/<mã>/attachments` (xem `core/files`); `attachment_*` chỉ nhận lời gọi từ dịch vụ tệp |

API của từng gói: gói xã ở [modules/xa/README.md](../../modules/xa/README.md#api-dữ-liệu), gói doanh nghiệp ở
[modules/doanh-nghiep/README.md](../../modules/doanh-nghiep/README.md). Trang `/docs/` hiện đầy đủ đặc tả.

Cú pháp lọc, sắp xếp, chọn cột theo tài liệu PostgREST:
`?cot=eq.giatri`, `?order=cot.desc`, `?select=cot1,cot2`, `?limit=20`.

## Mã lỗi

| HTTP | Nghĩa                                                  |
| ---- | ------------------------------------------------------ |
| 401  | Không có token, token hết hạn hoặc bị sửa              |
| 403  | Đúng token nhưng không đủ quyền (vd cán bộ thêm đơn vị) |
| 400  | Dữ liệu gửi lên sai (vd mã đơn vị có chữ hoa)          |
| 409  | Dữ liệu đã tồn tại (vd trùng mã đơn vị)                |

## Tệp liên quan

- `core/db/init/01-create-api-roles.sh`: vai trò `authenticator`, `commune-app`, `web_anon`.
- `core/db/init/02-don-vi.sql`: schema `api`, bảng đơn vị, hàm đọc token, API đơn vị.
- `core/db/init/07-goi-nghiep-vu.sql`: `rest_pre_request()` (PostgREST gọi đầu mỗi yêu cầu, chạy các móc của gói).
- `modules/<gói>/db/`: API, chính sách RLS của từng gói.
- `core/rest/fetch-jwks.mjs`: lấy khóa công khai của Keycloak khi khởi động (dịch vụ `rest-keys`).
  Nếu đổi khóa trong Keycloak: `docker compose up -d --force-recreate rest-keys rest`.
