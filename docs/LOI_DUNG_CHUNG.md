<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# Lõi dùng chung và gói nghiệp vụ

CommuneOS là **lõi mở headless dùng chung cho mọi tổ chức có nhiều đơn vị** (DX-OS Open-Core): định danh, cổng API,
dữ liệu cách ly theo đơn vị, quy trình BPMN, lưu trữ tệp, sổ ghi nhận và AI chạy cục bộ. Nghiệp vụ cụ thể nằm trong
**gói nghiệp vụ** chạy trên lõi:

- **Gói nghiệp vụ xã (ứng dụng minh họa chính):** một cửa cấp xã, gồm người dân, thủ tục, hồ sơ, cán bộ xử lý,
  cùng ba ứng dụng `apps/citizen`, `apps/commune`, `apps/admin`.
- **Ví dụ doanh nghiệp** ([examples/doanh-nghiep](../examples/doanh-nghiep/README.md)): "Công ty A" duyệt đơn nghỉ
  phép trên cùng lõi, không sửa mã của lõi. Chạy `make example-enterprise`.

## Ánh xạ H-P-D-I

| Trụ cột | Lõi cung cấp (dùng chung) | Gói nghiệp vụ xã dùng | Ví dụ doanh nghiệp dùng |
| --- | --- | --- | --- |
| **H** (Con người) | Đăng nhập một lần (Keycloak); đơn vị, lãnh đạo, nhân viên, đổi mật khẩu tạm (dịch vụ `accounts`); vai trò trong token | Cán bộ, lãnh đạo xã, công dân; hồ sơ cán bộ, giao việc, hai cấp duyệt ([QUAN_LY_NHAN_VIEN.md](QUAN_LY_NHAN_VIEN.md)) | Giám đốc (`leader`), nhân viên (`officer`) của Công ty A, tạo qua cùng API |
| **P** (Quy trình) | Flowable + dịch vụ điều phối: mọi loại đối tượng chạy theo sơ đồ BPMN, chặn gọi thẳng hàm đổi trạng thái ([core/orchestrator](../core/orchestrator/README.md)) | Quy trình xử lý hồ sơ `xu-ly-ho-so`; danh mục thủ tục theo xã, gói thủ tục (`packs/`) | Quy trình `duyet-nghi-phep` |
| **D** (Dữ liệu) | PostgreSQL + PostgREST, cách ly đơn vị bằng RLS; kho tệp S3 (SeaweedFS) và dịch vụ tệp; sổ ghi nhận hash-chain theo đơn vị (`public.ledger_record`) | Hồ sơ, giấy tờ, báo cáo điều hành (`apps/commune` → Báo cáo), sổ ghi nhận (`apps/admin` → Sổ cái) | Đơn nghỉ phép (schema `nghi_phep`), ghi sổ từng bước duyệt |
| **I** (Trí tuệ) | AI chạy cục bộ (Ollama), tìm kiếm lai toàn văn + ngữ nghĩa trên kho tri thức nội bộ (RAG), che dữ liệu cá nhân trước khi đưa vào mô hình ([core/ai](../core/ai/README.md)) | Trợ lý thủ tục cho người dân, trợ lý nghiệp vụ cho cán bộ | (chưa dùng) |

## Ranh giới trong mã nguồn

Hiện mã chưa dời thư mục: mọi migration vẫn nằm trong `core/db/init/` để giữ nguyên thứ tự chạy trên các bản cài đã có.
Bảng dưới cho biết từng phần thuộc lõi hay thuộc gói nghiệp vụ xã.

**Dịch vụ:** mọi dịch vụ trong `core/` (`identity`, `gateway`, `db`/`rest`, `workflow-engine`/`orchestrator`, `storage`/`files`,
`accounts`, `ai`/`ai-gateway`, `api-docs`) là lõi dùng chung. Ba ứng dụng trong `apps/` thuộc gói nghiệp vụ xã.

**Cơ sở dữ liệu (`core/db/init/`):**

| Nhóm | Tệp | Nội dung |
| --- | --- | --- |
| Lõi | `00-create-app-role.sh`, `01-tao-database-keycloak.sql`, `02-create-api-roles.sh` | Vai trò cơ sở dữ liệu, cơ sở dữ liệu của Keycloak |
| Lõi | `10-ledger.sql` | Sổ ghi nhận hash-chain theo đơn vị, `public.ledger_record` cho mọi gói |
| Lõi | `12-workflow-secret.sh` | Bí mật để cơ sở dữ liệu nhận ra lời gọi từ dịch vụ điều phối |
| Lõi | `16-nhat-ky-can-bo.sql` | Nhật ký quản lý tài khoản |
| Lõi, còn lẫn phần của xã | `01-schema.sql` | Bảng `tenants` (đơn vị) nằm chung với bảng người dân, thủ tục, hồ sơ |
| Lõi, còn lẫn phần của xã | `03-api.sql` | Hàm đọc token (`current_tenant_code`, `is_sys_admin`), API đơn vị; kèm bảng ảo hồ sơ |
| Lõi, còn lẫn phần của xã | `11-workflow.sql` | `core_settings`, `is_workflow_call`; kèm hàm đổi trạng thái hồ sơ |
| Lõi, còn lẫn phần của xã | `14-luu-tru-tep.sql` | Siêu dữ liệu kho tệp; kèm gắn giấy tờ vào hồ sơ |
| Lõi, còn lẫn phần của xã | `17-nhan-vien.sql` | Hàm đọc token (`has_role`, `require_staff`, `require_leader`), hồ sơ cán bộ, giao việc; kèm phân công hồ sơ |
| Lõi, còn lẫn phần của xã | `22-ai-knowledge-vectors.sql` | Tìm kiếm lai cho AI; chỉ mục tri thức lấy từ thủ tục |
| Lõi, còn lẫn phần của xã | `25-api-comments.sql`, `35-account-onboarding.sql` | Mô tả API; tạo đơn vị kèm lãnh đạo (kèm đăng ký công dân) |
| Gói nghiệp vụ xã | Các tệp còn lại: `02-ai-knowledge`, `03-citizen-*` đến `09-*`, `11-citizen-*`, `12-citizen-*`, `13-*`, `15-*`, `16-citizen-*`, `17-citizen-*`, `18-*` đến `21-*`, `23-*`, `24-*`, `26-*` đến `34-*`, `36-*` | Người dân, thủ tục, hồ sơ, xử lý hồ sơ, thông báo cán bộ, hướng dẫn nghiệp vụ xã, API của Kênh người dân |

Gói nghiệp vụ mới chỉ được dựa vào phần lõi: bảng `tenants`, các hàm đọc token, `is_workflow_call`, `ledger_record`,
dịch vụ tệp, dịch vụ tài khoản. Không đọc ghi bảng của gói nghiệp vụ xã.

## Thêm nghiệp vụ mới

Làm theo [examples/doanh-nghiep](../examples/doanh-nghiep/README.md):

1. **Thư mục gói:** `examples/<tên-gói>/` gồm `db/`, `bpmn/`, `workflow.json`, bài kiểm thử. Dịch vụ điều phối đọc
   mọi thư mục con của `examples/` (biến `MODULES_DIR`).
2. **Dữ liệu (`db/*.sql`, chạy lại được):** bảng trong schema riêng, có cột đơn vị (`tenant_id` tham chiếu `tenants`);
   bật RLS lọc theo `public.current_tenant_code()` và vai trò (`public.has_role`); API là bảng ảo `security_invoker`
   và hàm `SECURITY DEFINER` trong schema `api`; ghi sổ bằng `public.ledger_record`; cấp quyền cho vai trò
   `commune-app`; cuối tệp `NOTIFY pgrst, 'reload schema'`.
3. **Quy trình (`bpmn/*.bpmn20.xml`):** mỗi `userTask` có `id` trùng một trạng thái; nhánh đi tiếp theo biến `action`.
4. **Khai báo (`workflow.json`):** loại đối tượng, sơ đồ, bảng ảo, hàm đổi trạng thái
   ([các trường](../core/orchestrator/README.md#thêm-loại-đối-tượng-gói-nghiệp-vụ)). Hàm đổi trạng thái phải kiểm tra
   `public.is_workflow_call()` để mọi bước đi qua sơ đồ.
5. **Đơn vị, tài khoản:** quản trị hệ thống tạo đơn vị kèm lãnh đạo (`POST /accounts/tenants`), lãnh đạo tạo nhân viên
   (`POST /accounts/staff`).
6. **Chạy:** nạp SQL vào cơ sở dữ liệu, `make up` (dịch vụ điều phối nạp sơ đồ mới), rồi gọi qua cổng: `/rest/...`
   cho dữ liệu, `/workflow/<loại>/<mã>/actions` cho từng bước. Giao diện (nếu cần) là ứng dụng mới trong `apps/`, chỉ
   gọi cổng API.

## Giới hạn hiện tại

- Vai trò cố định trong realm Keycloak (`leader`, `officer`, `receptionist`, `sys_admin`); gói mới dùng lại các vai trò
  này (ví dụ giám đốc là `leader`). Thông báo lỗi của dịch vụ tài khoản còn gọi đơn vị là "xã".
- Gói nghiệp vụ nạp SQL bằng lệnh riêng (`make example-enterprise`), chưa có cơ chế bật/tắt gói khi cài.
- Các tệp "còn lẫn phần của xã" ở bảng trên chưa được tách; tách xong thì lõi có thể cài mà không có gói nghiệp vụ xã.

## Vì sao bài toán minh họa là cấp xã

- Đề cho phép đội thi chọn bài toán minh họa. Chính quyền cấp xã là bài toán nhiều đơn vị khó: hàng nghìn xã trên
  cùng một lõi, dữ liệu xã này không lộ sang xã khác, dữ liệu cá nhân của người dân phải được bảo vệ, AI không được
  gửi dữ liệu ra ngoài. Lõi đáp ứng được bài toán này thì đáp ứng được tổ chức có yêu cầu nhẹ hơn.
- Lõi dùng lại được: ví dụ doanh nghiệp chạy trên cùng lõi, cùng cách cách ly đơn vị, cùng động cơ quy trình và sổ
  ghi nhận, chỉ thêm một thư mục gói nghiệp vụ.
