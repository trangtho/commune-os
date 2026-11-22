<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# core/rest — API dữ liệu (PostgREST)

Bảng quản trị và màn hình cán bộ xã đọc dữ liệu qua API này. Kênh người dân dùng API này khi
đăng nhập; các chức năng khác của Kênh người dân vẫn kết nối PostgreSQL trực tiếp.

```
Đăng nhập Keycloak → token (tenant_id = mã xã, realm_access.roles = vai trò)
  → APISIX /rest/* kiểm tra token
  → PostgREST kiểm tra lại chữ ký, chuyển sang vai trò "commune-app"
  → PostgreSQL áp RLS: chỉ trả dữ liệu của đúng xã trong token
```

Mọi lời gọi cần header `Authorization: Bearer <token>`. Không có token → 401.

## Danh sách API

| Muốn                                 | Gọi                                                                                                                                                |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hồ sơ của xã (số điện thoại đã che)  | `GET /rest/dossiers`                                                                                                                               |
| Hồ sơ đang xử lý, hạn gần nhất trước | `GET /rest/dossiers?status=eq.processing&order=due_at`                                                                                             |
| Hồ sơ quá hạn                        | `GET /rest/dossiers?overdue=is.true`                                                                                                               |
| Một hồ sơ                            | `GET /rest/dossiers?id=eq.HS-2026-001248`                                                                                                          |
| Lịch sử xử lý một hồ sơ              | `GET /rest/dossier_events?dossier_id=eq.HS-2026-001248&order=created_at`                                                                           |
| Giấy tờ đã nộp của một hồ sơ         | `GET /rest/dossier_documents?dossier_id=eq.HS-2026-001248`                                                                                         |
| Giấy tờ cần nộp theo thủ tục         | `GET /rest/procedure_documents?procedure_id=eq.khai-sinh`                                                                                          |
| Danh mục thủ tục đang công bố        | `GET /rest/procedures`                                                                                                                             |
| Danh sách xã (sys_admin thấy tất cả) | `GET /rest/tenants`                                                                                                                                |
| Thêm xã (chỉ sys_admin)              | `POST /rest/rpc/add_tenant` với `{"code":"xa-c","name":"Xã C"}`                                                                                    |
| Khóa / mở xã (chỉ sys_admin)         | `POST /rest/rpc/set_tenant_status` với `{"code":"xa-a","status":"locked"}`                                                                         |
| Đổi trạng thái hồ sơ (cán bộ xã)     | Không gọi ở đây: dùng `POST /workflow/dossiers/<mã>/actions` (xem `core/orchestrator`). `set_dossier_status` chỉ nhận lời gọi từ dịch vụ điều phối|
| Xem sổ ghi nhận                      | `GET /rest/ledger?order=seq.desc&limit=30`                                                                                                         |
| Kiểm tra sổ có bị sửa không          | `POST /rest/rpc/verify_ledger` với `{}` hoặc `{"only_tenant":"xa-a"}`                                                                              |
| Mở / tắt thủ tục cho xã (sys_admin)  | `POST /rest/rpc/set_tenant_procedure`, `set_tenant_procedures`, `set_procedure_tenants`                                                            |
| Nạp gói thủ tục (sys_admin)          | `POST /rest/rpc/import_procedure` với `{"pack": {...}}` (nội dung `pack.yaml` chuyển sang JSON)                                                          |
| Phân công, trình duyệt hồ sơ         | `POST /rest/rpc/assign_dossier`, `request_dossier_approval`; xem `GET /rest/dossier_assignments`                                                   |
| Nhật ký quản lý cán bộ (lãnh đạo)    | `GET /rest/staff_audit`                                                                                                                            |
| Nhân viên, việc giao, yêu cầu        | `staff_profiles`, `staff_tasks`, `staff_requests`, `staff_workload`, `my_profile`, `my_tasks`, `my_requests` (xem `docs/QUAN_LY_NHAN_VIEN.md`)      |

### Công dân (token của client `citizen-app`)

Token công dân có vai trò `citizen`, claim `citizen_id` và `citizen_tenant`. PostgREST chuyển sang
vai trò `citizen-app`; hàm `public.rest_pre_request()` (biến `PGRST_DB_PRE_REQUEST`) đặt
`app.citizen_id`, `app.tenant_id` để chính sách RLS của các bảng công dân áp dụng
(`core/db/init/19-citizen-rest-api.sql`). Token công dân không đọc được các API của cán bộ ở trên (403).

Luồng chính của Kênh người dân là các hàm trong `core/db/init/21-citizen-api-core-flow.sql`, gọi bằng
`POST /rest/rpc/<tên hàm>` với tham số JSON (tên bắt đầu bằng `p_`). Hàm chạy bằng quyền người gọi nên RLS
áp dụng; ràng buộc nghiệp vụ kiểm tra lại khi ghi. Lỗi nghiệp vụ trả mã HTTP tương ứng (mã `PTxyz`) kèm
lời nhắn tiếng Việt.

| Muốn | Gọi |
| --- | --- |
| Thông tin của công dân đang đăng nhập | `GET /rest/my_citizen_profile` |
| Danh mục, chi tiết thủ tục (công dân thấy thủ tục xã mình mở) | `procedure_catalog`, `procedure_detail` |
| Hồ sơ cá nhân: xem, sửa | `citizen_profile`, `citizen_profile_update` |
| Hồ sơ của tôi, một hồ sơ, dữ liệu bản nháp | `citizen_applications`, `citizen_application`, `citizen_application_draft` |
| Tạo, sửa, tự lưu bản nháp | `citizen_application_create`, `citizen_application_update`, `citizen_application_autosave` |
| Nộp hồ sơ (chặn nếu thiếu giấy tờ bắt buộc) | `citizen_application_submit` |
| Giấy tờ: ghi, xóa, lấy để tải | `citizen_document_add`, `citizen_document_remove`, `citizen_document_file` |
| Thông báo: xem, đọc một, đọc tất cả | `citizen_notifications`, `citizen_notification_read`, `citizen_notifications_read_all` |

Khách chưa đăng nhập gọi `procedure_catalog`, `procedure_detail` qua `POST /public/rpc/...` (không token,
PostgREST dùng vai trò `web_anon` chỉ được gọi hai hàm này).

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
