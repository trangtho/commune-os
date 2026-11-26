<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# core/orchestrator — Dịch vụ điều phối quy trình

Dịch vụ headless (không có giao diện) đứng giữa cổng APISIX, động cơ quy trình
Flowable và API dữ liệu PostgREST. Viết bằng Node.js 22, không dùng thư viện ngoài.

Dịch vụ không gắn với một nghiệp vụ cụ thể: mỗi **loại đối tượng** có quy trình (hồ sơ thủ tục của
gói nghiệp vụ xã, đơn nghỉ phép của [ví dụ doanh nghiệp](../../examples/doanh-nghiep/README.md)...) chỉ cần
khai báo sơ đồ BPMN, bảng ảo đọc trạng thái và hàm đổi trạng thái. Loại `dossiers` có sẵn.

```
Cán bộ bấm nút → APISIX /workflow/* (kiểm tra token)
  → orchestrator: đọc hồ sơ qua PostgREST bằng token của cán bộ (RLS lọc theo xã)
  → hỏi Flowable: hồ sơ đang ở bước nào, sơ đồ cho đi tiếp tới đâu
  → gọi set_dossier_status (kèm bí mật WORKFLOW_TOKEN); database kiểm tra vai trò, xã, lý do
  → ghi xong mới cho quy trình trong Flowable đi tiếp
```

## API

| Gọi qua gateway                        | Nội dung                                                   |
| -------------------------------------- | ---------------------------------------------------------- |
| `GET /workflow/<loại>/<mã>/actions`    | Bước hiện tại và các bước được phép đi tiếp                |
| `POST /workflow/<loại>/<mã>/actions`   | Thực hiện một bước: `{"action":"processing","note":"..."}` |
| `GET /workflow/health`                 | Kiểm tra dịch vụ và động cơ Flowable (Flowable không trả lời thì 503) |

| Mã lỗi | Nghĩa                                                  |
| ------ | ------------------------------------------------------ |
| 400    | Thiếu lý do khi yêu cầu bổ sung hoặc từ chối; JSON sai |
| 401    | Không có token hoặc token hết hạn                      |
| 404    | Đối tượng không tồn tại, thuộc đơn vị khác, hoặc loại chưa khai báo |
| 409    | Bước không có trong sơ đồ, hoặc hồ sơ đã kết thúc      |

## Sơ đồ quy trình

Sơ đồ nằm trong `bpmn/`. Khi khởi động, dịch vụ tự nạp mọi tệp `*.bpmn20.xml` vào
Flowable; tệp nào đã nạp với đúng nội dung đó thì bỏ qua.

`xu-ly-ho-so.bpmn20.xml` có 3 bước (tiếp nhận, xử lý, chờ bổ sung) và 2 kết thúc
(hoàn thành, từ chối). Mỗi bước (userTask) có `id` trùng tên trạng thái hồ sơ;
nhánh đi tiếp chọn theo biến `action`.

## Thêm loại đối tượng (gói nghiệp vụ)

Mỗi thư mục con của `MODULES_DIR` (docker compose gắn `./examples` vào `/modules`) có `workflow.json` và thư mục
`bpmn/`. Ví dụ [`examples/doanh-nghiep/workflow.json`](../../examples/doanh-nghiep/workflow.json):

| Trường       | Ý nghĩa                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------- |
| `name`       | Đoạn đường dẫn: `/workflow/<name>/<mã>/actions`                                                   |
| `label`      | Tên hiển thị trong thông báo lỗi (ví dụ "Đơn nghỉ phép")                                          |
| `processKey` | `id` của `process` trong sơ đồ BPMN                                                               |
| `view`       | Bảng ảo trong schema `api` có cột `id`, `status`, `tenant_code`; RLS lọc theo đơn vị của token     |
| `statusRpc`  | Hàm `api.<statusRpc>(<idParam>, status, note)`; phải kiểm tra `public.is_workflow_call()`         |
| `idParam`    | Tên tham số mã đối tượng của hàm trên                                                             |
| `final`      | Các trạng thái kết thúc                                                                            |
| `variables`  | (tùy chọn) Biến quy trình lấy từ cột của `view`, ví dụ `{"tenant": "tenant_code"}`                |

Dịch vụ gửi kèm header `X-Workflow-Expected-Status` (trạng thái lúc đọc); hàm đổi trạng thái nên từ chối (409)
khi trạng thái đã khác. Khai báo xong chạy `docker compose restart orchestrator` (hoặc `make up`).

**Đổi quy trình mà không sửa mã nguồn:** sửa sơ đồ rồi chạy
`docker compose restart orchestrator`. Sơ đồ mới được nạp thành phiên bản mới;
hồ sơ nộp sau dùng phiên bản mới, hồ sơ đang xử lý giữ phiên bản cũ.

## Cấu hình

| Biến                                 | Ý nghĩa                                           |
| ------------------------------------ | ------------------------------------------------- |
| `FLOWABLE_URL`                       | Địa chỉ REST của Flowable                         |
| `FLOWABLE_USER`, `FLOWABLE_PASSWORD` | Tài khoản `rest-admin` của Flowable               |
| `REST_URL`                           | Địa chỉ PostgREST                                 |
| `WORKFLOW_TOKEN`                     | Bí mật để database nhận ra lời gọi từ dịch vụ này |
| `BPMN_DIR`                           | Thư mục chứa sơ đồ (mặc định `/app/bpmn`)         |
| `MODULES_DIR`                        | Thư mục các gói nghiệp vụ khác (compose: `/modules`) |

Gọi thẳng `/rest/rpc/set_dossier_status` (hay hàm đổi trạng thái của gói khác) mà không qua dịch vụ này sẽ bị từ chối (403).
