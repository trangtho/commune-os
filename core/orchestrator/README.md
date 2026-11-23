<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# core/orchestrator — Dịch vụ điều phối quy trình

Dịch vụ headless (không có giao diện) đứng giữa cổng APISIX, động cơ quy trình
Flowable và API dữ liệu PostgREST. Viết bằng Node.js 22, không dùng thư viện ngoài.

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
| `GET /workflow/dossiers/<mã>/actions`  | Bước hiện tại và các bước được phép đi tiếp                |
| `POST /workflow/dossiers/<mã>/actions` | Thực hiện một bước: `{"action":"processing","note":"..."}` |
| `GET /workflow/health`                 | Kiểm tra dịch vụ và động cơ Flowable (Flowable không trả lời thì 503) |

| Mã lỗi | Nghĩa                                                  |
| ------ | ------------------------------------------------------ |
| 400    | Thiếu lý do khi yêu cầu bổ sung hoặc từ chối; JSON sai |
| 401    | Không có token hoặc token hết hạn                      |
| 404    | Hồ sơ không tồn tại, hoặc thuộc xã khác                |
| 409    | Bước không có trong sơ đồ, hoặc hồ sơ đã kết thúc      |

## Sơ đồ quy trình

Sơ đồ nằm trong `bpmn/`. Khi khởi động, dịch vụ tự nạp mọi tệp `*.bpmn20.xml` vào
Flowable; tệp nào đã nạp với đúng nội dung đó thì bỏ qua.

`xu-ly-ho-so.bpmn20.xml` có 3 bước (tiếp nhận, xử lý, chờ bổ sung) và 2 kết thúc
(hoàn thành, từ chối). Mỗi bước (userTask) có `id` trùng tên trạng thái hồ sơ;
nhánh đi tiếp chọn theo biến `action`.

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

Gọi thẳng `/rest/rpc/set_dossier_status` mà không qua dịch vụ này sẽ bị từ chối (403).
