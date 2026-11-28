<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# modules/xa – Gói nghiệp vụ chính quyền cấp xã

Ứng dụng minh họa chính chạy trên lõi CommuneOS: bộ phận một cửa cấp xã, Kênh người dân, màn hình cán bộ xã.
Mỗi xã là một đơn vị của lõi. Gói chỉ dựa vào phần lõi dùng chung (đơn vị, hàm đọc token, quy trình, sổ ghi nhận,
tệp, tài khoản), xem [docs/LOI_DUNG_CHUNG.md](../../docs/LOI_DUNG_CHUNG.md).

| Thư mục, tệp | Nội dung |
| --- | --- |
| [`module.json`](module.json) | Khai báo gói: thứ tự tệp SQL, quy trình hồ sơ (`/workflow/dossiers`), việc định kỳ |
| `db/` | Công dân, thủ tục, hồ sơ, giấy tờ, thông báo, cán bộ xã, API của Kênh người dân (`*.sql`); danh mục thủ tục mẫu (`seed.sql`) |
| `db/tests/` | Kiểm thử SQL của gói (chạy trong transaction rồi `ROLLBACK`), `make test-sql` |
| [`tests/`](tests/README.md) | Kiểm thử qua lõi: cách ly xã, quy trình, tệp, tài khoản, công dân, AI (`make test`); ba ứng dụng (`make portal-smoke`) |
| [`api-docs.yaml`](api-docs.yaml) | Đặc tả OpenAPI các đường dẫn riêng của gói trên dịch vụ của lõi (hiện trên trang `/docs/`) |
| `identity/realm.json` | Cấu hình Keycloak riêng của gói: client `citizen-app`, vai trò `citizen`, `receptionist`, `supervisor`, thuộc tính công dân |
| `bpmn/` | Quy trình xử lý hồ sơ `xu-ly-ho-so` |
| `demo/` | Dữ liệu mẫu tạo qua API của lõi: 2 xã, lãnh đạo, cán bộ, công dân, hồ sơ (`make demo`) |
| [`packs/`](packs/README.md) | Gói thủ tục (`pack.yaml`) nạp qua bảng quản trị |

Ứng dụng của gói nằm ở `apps/`: `apps/citizen` (Kênh người dân), `apps/commune` (màn hình cán bộ),
`apps/admin` (bảng quản trị, phần thủ tục và xã). Các ứng dụng chỉ gọi lõi qua cổng API.

Bật gói: có `xa` trong `COMMUNEOS_MODULES` (mặc định có), rồi `make up`. Kiểm thử: `make test`, `make test-sql`,
`make test-citizen`, `make e2e-citizen`.

## API dữ liệu

Gọi qua `/rest/` của lõi (xem [core/rest](../../core/rest/README.md)), bằng token của cán bộ xã (client `commune-app`).

| Muốn | Gọi |
| --- | --- |
| Hồ sơ của xã (số điện thoại đã che) | `GET /rest/dossiers` |
| Hồ sơ đang xử lý, hạn gần nhất trước | `GET /rest/dossiers?status=eq.processing&order=due_at` |
| Hồ sơ quá hạn | `GET /rest/dossiers?overdue=is.true` |
| Một hồ sơ | `GET /rest/dossiers?id=eq.HS-2026-001248` |
| Lịch sử xử lý một hồ sơ | `GET /rest/dossier_events?dossier_id=eq.HS-2026-001248&order=created_at` |
| Giấy tờ đã nộp của một hồ sơ | `GET /rest/dossier_documents?dossier_id=eq.HS-2026-001248` |
| Giấy tờ cần nộp theo thủ tục | `GET /rest/procedure_documents?procedure_id=eq.khai-sinh` |
| Danh mục thủ tục đang công bố | `GET /rest/procedures` |
| Đổi trạng thái hồ sơ (cán bộ xã) | Không gọi ở đây: dùng `POST /workflow/dossiers/<mã>/actions` (xem `core/orchestrator`). `set_dossier_status` chỉ nhận lời gọi từ dịch vụ điều phối |
| Mở / tắt thủ tục cho xã (sys_admin) | `POST /rest/rpc/set_tenant_procedure`, `set_tenant_procedures`, `set_procedure_tenants` |
| Nạp gói thủ tục (sys_admin) | `POST /rest/rpc/import_procedure` với `{"pack": {...}}` (nội dung `pack.yaml` chuyển sang JSON) |
| Phân công, trình duyệt hồ sơ | `POST /rest/rpc/assign_dossier`, `request_dossier_approval`; xem `GET /rest/dossier_assignments` |
| Thông báo cho cán bộ (theo xã, gửi cho mình hoặc vai trò của mình) | `GET /rest/staff_notifications`; đánh dấu đã đọc `POST /rest/rpc/read_staff_notification`, `read_all_staff_notifications` |
| Lãnh đạo gửi thông báo tới công dân của xã | `POST /rest/rpc/broadcast_citizen_notice` với `{"title":"...","body":"..."}` |
| Nhân viên, việc giao, yêu cầu | `staff_profiles`, `staff_tasks`, `staff_requests`, `staff_workload`, `my_profile`, `my_tasks`, `my_requests` (xem `docs/QUAN_LY_NHAN_VIEN.md`) |

### Công dân (token của client `citizen-app`)

Token công dân có vai trò `citizen`, claim `citizen_id` và `citizen_tenant`. PostgREST chuyển sang
vai trò `citizen-app`; hàm `public.rest_pre_request()` (biến `PGRST_DB_PRE_REQUEST`) đặt
`app.citizen_id`, `app.tenant_id` để chính sách RLS của các bảng công dân áp dụng
(`modules/xa/db/19-citizen-rest-api.sql`). Token công dân không đọc được các API của cán bộ ở trên (403).

Luồng chính của Kênh người dân là các hàm trong `modules/xa/db/21-citizen-api-core-flow.sql`, gọi bằng
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

Khách chưa đăng nhập gọi `procedure_catalog`, `procedure_detail`... qua `POST /public/rpc/...` (không token,
PostgREST dùng vai trò `web_anon`, chỉ gọi được các hàm khai báo ở mục `publicRpc` của `module.json`).

Hồ sơ thuộc về xã tiếp nhận: `tenant_code` là xã xử lý hồ sơ, `home_tenant_code` là xã của người nộp.
