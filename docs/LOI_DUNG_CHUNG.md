<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# Lõi dùng chung và gói nghiệp vụ

CommuneOS là **lõi mở headless dùng chung cho mọi tổ chức có nhiều đơn vị** (DX-OS Open-Core): định danh, cổng API,
dữ liệu cách ly theo đơn vị, quy trình BPMN, lưu trữ tệp, sổ ghi nhận và AI chạy cục bộ. Nghiệp vụ cụ thể nằm trong
**gói nghiệp vụ** chạy trên lõi:

- **Gói nghiệp vụ xã (ứng dụng minh họa chính)** ([modules/xa](../modules/xa/README.md)): một cửa cấp xã, gồm người
  dân, thủ tục, hồ sơ, cán bộ xử lý, cùng ba ứng dụng `apps/citizen`, `apps/commune`, `apps/admin`.
- **Gói doanh nghiệp** ([modules/doanh-nghiep](../modules/doanh-nghiep/README.md)): "Công ty A" duyệt đơn nghỉ
  phép trên cùng lõi, không sửa mã của lõi. Chạy `make example-enterprise`.

Lõi cài và chạy được khi không có gói xã; gói nào được nạp do biến `COMMUNEOS_MODULES` quyết định. Mỗi đơn vị chỉ dùng
các gói được bật cho mình: xã A bật gói `xa`, Công ty A bật gói `doanh-nghiep`; quản trị hệ thống chọn gói khi tạo đơn
vị và bật, tắt ở bảng quản trị (Đơn vị → chi tiết đơn vị).

## Ánh xạ H-P-D-I

| Trụ cột | Lõi cung cấp (dùng chung) | Gói nghiệp vụ xã dùng | Ví dụ doanh nghiệp dùng |
| --- | --- | --- | --- |
| **H** (Con người) | Đăng nhập một lần (Keycloak); đơn vị, lãnh đạo, nhân viên, đổi mật khẩu tạm (dịch vụ `accounts`); vai trò trong token | Cán bộ, lãnh đạo xã, công dân; hồ sơ cán bộ, giao việc, hai cấp duyệt ([QUAN_LY_NHAN_VIEN.md](QUAN_LY_NHAN_VIEN.md)) | Giám đốc (`leader`), nhân viên (`officer`) của Công ty A, tạo qua cùng API |
| **P** (Quy trình) | Flowable + dịch vụ điều phối: mọi loại đối tượng chạy theo sơ đồ BPMN, chặn gọi thẳng hàm đổi trạng thái ([core/orchestrator](../core/orchestrator/README.md)) | Quy trình xử lý hồ sơ `xu-ly-ho-so`; danh mục thủ tục theo xã, gói thủ tục (`modules/xa/packs/`) | Quy trình `duyet-nghi-phep` |
| **D** (Dữ liệu) | PostgreSQL + PostgREST, cách ly đơn vị bằng RLS; kho tệp S3 (SeaweedFS) và dịch vụ tệp; sổ ghi nhận hash-chain theo đơn vị (`public.ledger_record`) | Hồ sơ, giấy tờ, báo cáo điều hành (`apps/commune` → Báo cáo), sổ ghi nhận (`apps/admin` → Kiểm tra hồ sơ đã ký) | Đơn nghỉ phép (schema `nghi_phep`), tệp đính kèm của đơn (giấy khám bệnh...), ghi sổ từng bước duyệt |
| **I** (Trí tuệ) | AI chạy cục bộ (Ollama), dịch vụ `ai-gateway` che dữ liệu cá nhân trước khi đưa vào mô hình, chỉ trích dẫn từ nguồn ([core/ai](../core/ai/README.md)) | Kho tri thức thủ tục, tìm kiếm lai toàn văn + ngữ nghĩa (RAG); trợ lý thủ tục cho người dân, trợ lý nghiệp vụ cho cán bộ | (chưa dùng) |

## Ranh giới trong mã nguồn

| Thư mục | Thuộc | Nội dung |
| --- | --- | --- |
| `core/` | Lõi | Mọi dịch vụ: `identity` (Keycloak), `gateway` (APISIX), `db`/`rest` (PostgreSQL, PostgREST), `workflow-engine`/`orchestrator` (Flowable, dịch vụ điều phối), `storage`/`files` (kho tệp), `accounts` (tài khoản), `ai`/`ai-gateway`, `api-docs` |
| `core/db/init/` | Lõi | Đơn vị, hàm đọc token, quy trình, sổ ghi nhận, nhật ký tài khoản, danh sách gói, móc đầu yêu cầu ([core/db](../core/db/README.md)) |
| `modules/xa/` | Gói xã | Công dân, thủ tục, hồ sơ (SQL, kiểm thử SQL), quy trình `xu-ly-ho-so`, dữ liệu mẫu, gói thủ tục |
| `modules/doanh-nghiep/` | Gói doanh nghiệp | Đơn nghỉ phép (SQL), quy trình `duyet-nghi-phep`, kiểm thử |
| `apps/` | Gói xã | Kênh người dân, màn hình cán bộ, bảng quản trị; chỉ gọi lõi qua cổng API |

Lõi không biết gói nào tồn tại:

- `core/db/migrate.sh` chạy SQL của lõi, rồi SQL của từng gói trong `COMMUNEOS_MODULES` theo `module.json` của gói.
- Dịch vụ điều phối chỉ có loại đối tượng, sơ đồ BPMN, việc định kỳ do các gói đang bật khai báo.
- PostgREST gọi `public.rest_pre_request()` của lõi đầu mỗi yêu cầu; gói nào cần (gói xã đặt biến RLS của công dân)
  thì ghi danh móc của mình bằng `public.register_request_hook`.
- `make test-architecture` kiểm tra SQL của lõi và mã của dịch vụ điều phối không nhắc tới bảng, hàm, biến của gói xã.
- CI có job "Chỉ lõi, không có gói xã" (`COMMUNEOS_MODULES=doanh-nghiep`): dựng lõi, chạy `make test-platform` (kiểm tra
  thêm rằng không có bảng, API nào của gói xã) và `make example-enterprise`.

Gói nghiệp vụ chỉ được dựa vào phần lõi: bảng `tenants`, các hàm đọc token, `is_workflow_call`, `ledger_record`,
`register_request_hook`, `tenant_has_module`, `require_module`, dịch vụ tài khoản. Không đọc ghi bảng của gói khác.

**Gói theo đơn vị** (`core/db/init/08-goi-theo-don-vi.sql`): bảng `tenant_modules` ghi đơn vị nào bật gói nào. Gói tự
kiểm tra trong RLS (`public.tenant_has_module(tenant_id, '<gói>')`) và trong hàm (`public.require_module('<gói>')`), nên
đơn vị không bật gói thì API của gói trả rỗng hoặc 403. Ví dụ gói xã: đơn vị không bật gói xã không có thủ tục, hồ sơ,
không hiện trong danh sách đăng ký công dân, người của đơn vị không đăng nhập được màn hình cán bộ xã
(`apps/commune` hỏi `api.my_modules()`). Tắt gói không xóa dữ liệu; bật lại thì thấy lại.

## Thêm nghiệp vụ mới

Làm theo [modules/doanh-nghiep](../modules/doanh-nghiep/README.md):

1. **Thư mục gói:** `modules/<tên-gói>/` gồm `module.json`, `db/`, `bpmn/`, bài kiểm thử.
2. **Dữ liệu (`db/*.sql`, chạy lại được):** bảng trong schema riêng, có cột đơn vị (`tenant_id` tham chiếu `tenants`);
   bật RLS lọc theo `public.current_tenant_code()`, gói đã bật (`public.tenant_has_module`) và vai trò (`public.has_role`);
   hàm ghi gọi `public.require_module('<gói>')`; API là bảng ảo `security_invoker`
   và hàm `SECURITY DEFINER` trong schema `api`; ghi sổ bằng `public.ledger_record`; cấp quyền cho vai trò
   `commune-app`; cuối tệp `NOTIFY pgrst, 'reload schema'`.
3. **Quy trình (`bpmn/*.bpmn20.xml`):** mỗi `userTask` có `id` trùng một trạng thái; nhánh đi tiếp theo biến `action`.
4. **Khai báo (`module.json`):** `name`, `title`, `version`; `db` (tệp SQL theo thứ tự chạy); `workflows` (loại đối
   tượng, sơ đồ, bảng ảo, hàm đổi trạng thái, [các trường](../core/orchestrator/README.md#thêm-loại-đối-tượng-gói-nghiệp-vụ));
   `jobs` nếu cần việc định kỳ; `attachments` nếu đối tượng cần đính kèm tệp ([cách khai báo](../core/files/README.md)).
   Hàm đổi trạng thái phải kiểm tra `public.is_workflow_call()` để mọi bước đi qua sơ đồ.
5. **Cài gói:** thêm tên gói vào `COMMUNEOS_MODULES` trong `.env`, chạy `make up`.
6. **Đơn vị, tài khoản:** quản trị hệ thống tạo đơn vị kèm lãnh đạo và chọn gói (`POST /accounts/tenants` với
   `"modules": ["<gói>"]`, hoặc bảng quản trị → Đơn vị → Thêm đơn vị); lãnh đạo tạo nhân viên (`POST /accounts/staff`).
7. **Gọi qua cổng:** `/rest/...` cho dữ liệu, `/workflow/<loại>/<mã>/actions` cho từng bước. Giao diện (nếu cần) là ứng
   dụng mới trong `apps/`, chỉ gọi cổng API.

## Giới hạn hiện tại

- Vai trò cố định trong realm Keycloak (`leader`, `officer`, `receptionist`, `sys_admin`); gói mới dùng lại các vai trò
  này (ví dụ giám đốc là `leader`). Thông báo lỗi của dịch vụ tài khoản còn gọi đơn vị là "xã".
- AI: mô hình và dịch vụ `ai-gateway` thuộc lõi; kho tri thức và hàm tìm kiếm hiện thuộc gói xã (tri thức về thủ tục).
- Hồ sơ cán bộ, giao việc, hai cấp duyệt (`modules/xa/db/17-nhan-vien.sql`) còn thuộc gói xã vì gắn với hồ sơ.
- Cổng API liệt kê cố định các hàm công khai (`/public/rpc/...`), gồm cả hàm của gói xã.

## Vì sao bài toán minh họa là cấp xã

- Đề cho phép đội thi chọn bài toán minh họa. Chính quyền cấp xã là bài toán nhiều đơn vị khó: hàng nghìn xã trên
  cùng một lõi, dữ liệu xã này không lộ sang xã khác, dữ liệu cá nhân của người dân phải được bảo vệ, AI không được
  gửi dữ liệu ra ngoài. Lõi đáp ứng được bài toán này thì đáp ứng được tổ chức có yêu cầu nhẹ hơn.
- Lõi dùng lại được: ví dụ doanh nghiệp chạy trên cùng lõi, cùng cách cách ly đơn vị, cùng động cơ quy trình và sổ
  ghi nhận, chỉ thêm một thư mục gói nghiệp vụ.
