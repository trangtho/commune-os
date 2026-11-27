<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# core/db

PostgreSQL 17. `init/` chỉ chứa phần **lõi dùng chung**, không có bảng nghiệp vụ nào:

| Tệp | Nội dung |
| --- | --- |
| `00-create-app-role.sh` | Vai trò `communeos_app` (chỉ nhận tín hiệu thay đổi LISTEN, không có quyền dữ liệu) |
| `01-create-api-roles.sh` | Vai trò của API dữ liệu: `authenticator`, `commune-app` (người của đơn vị), `web_anon` (khách) |
| `02-don-vi.sql` | Bảng đơn vị `tenants`, hàm đọc token (`current_tenant_code`, `has_role`, `require_staff`, `require_leader`...), API đơn vị |
| `03-quy-trinh.sql` | `core_settings`, `is_workflow_call()`: chỉ dịch vụ của lõi đổi được trạng thái |
| `04-workflow-secret.sh` | Ghi mã băm của `WORKFLOW_TOKEN` |
| `05-so-ghi-nhan.sql` | Sổ ghi nhận hash-chain theo đơn vị, `public.ledger_record` cho mọi gói |
| `06-nhat-ky-tai-khoan.sql` | Nhật ký quản lý tài khoản |
| `07-goi-nghiep-vu.sql` | Gói đã cài (`core_modules`, `api.modules`), hàm công khai do gói khai báo (`core_public_rpc`; `rest_pre_request` chặn khách gọi hàm khác), móc đầu yêu cầu PostgREST (`register_request_hook`), `api.public_platform()` |
| `08-goi-theo-don-vi.sql` | Gói bật cho từng đơn vị (`tenant_modules`, `api.tenant_modules`, `api.set_tenant_module`, `api.my_modules`); gói tự kiểm tra bằng `tenant_has_module()`, `require_module()` |
| `09-tep-dinh-kem.sql` | Tệp đính kèm dùng chung (`core_attachments`, `attachment_register`, `attachment_list`, `attachment_object`; chỉ dịch vụ tệp gọi) |
| `10-tri-thuc.sql` | Kho tri thức dùng chung cho trợ lý AI (`core_knowledge`, `knowledge_documents`, `knowledge_add`, `knowledge_remove`; tìm kiếm, tạo vector chỉ cho `ai-gateway`); `knowledge_load_module_doc` nạp tài liệu của gói |
| `11-vai-tro-goi.sql` | Vai trò do gói khai báo (`core_module_roles`, `api.module_roles`); `module_roles_sync` đồng bộ khi cài gói |
| `90-mo-ta-api.sql` | Mô tả tiếng Việt cho schema `api` và API của lõi (chạy sau mọi gói) |

Bảng, API, dữ liệu mẫu và kiểm thử SQL của từng nghiệp vụ nằm trong gói: [`modules/xa/db/`](../../modules/xa/db/)
(công dân, thủ tục, hồ sơ...), [`modules/doanh-nghiep/db/`](../../modules/doanh-nghiep/db/).

## Thứ tự chạy

`make up` chạy dịch vụ `db-setup` ở mỗi lần khởi động, trên cả volume mới và volume đã có dữ liệu
(`make repair-db` chạy lại riêng bước này). `db-setup` gọi [`migrate.sh`](migrate.sh):

1. Các tệp `init/0*` đến `init/8*` theo thứ tự tên tệp.
2. Từng gói trong `COMMUNEOS_MODULES` (mặc định `xa,doanh-nghiep`): các tệp trong mục `db` của
   `modules/<gói>/module.json`, đúng thứ tự khai báo; tài liệu trong mục `knowledge` vào kho tri thức; vai trò trong mục `roles`; hàm công khai trong mục `publicRpc`; xong thì ghi
   tên, phiên bản vào `core_modules`.
3. Các tệp `init/9*`.

Thêm tệp SQL cho một gói: đặt trong `modules/<gói>/db/` rồi thêm vào mục `db` của `module.json`. Thêm tệp cho lõi:
đặt trong `init/` với số thứ tự phù hợp; tệp của lõi không được dùng bảng, hàm của gói nào (`make test-architecture`
kiểm tra). Mọi tệp phải chạy lại được nhiều lần (idempotent).

Đặt `COMMUNEOS_MODULES=` để không cài gói nào; dùng volume mới để kiểm thử lõi độc lập.
Bỏ một gói khỏi `COMMUNEOS_MODULES` chỉ ngừng nạp gói đó (xóa khỏi `core_modules`), không xóa dữ liệu hoặc schema cũ. Móc yêu cầu chỉ chạy với gói còn trong registry.
