<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# Dịch vụ tệp (lưu trữ dữ liệu phi cấu trúc)

Dịch vụ không giao diện của lõi, lưu tệp cho mọi gói nghiệp vụ.

- Nội dung tệp nằm trong kho đối tượng chuẩn S3 (SeaweedFS, dịch vụ `storage`).
- **Tệp đính kèm dùng chung:** gói khai báo loại đối tượng được đính kèm trong `module.json` (mục `attachments`).
  PostgreSQL giữ thông tin mô tả và mã băm SHA-256 ở bảng của lõi (`core_attachments`, `core/db/init/09-tep-dinh-kem.sql`);
  mỗi tệp ghi một dòng vào sổ ghi nhận của đơn vị.
- **Đường dẫn tệp riêng của gói** (mục `files` trong `module.json`): gói khai báo đường dẫn, tham số, hàm ghi và hàm đọc
  của mình; dịch vụ chỉ lưu, kiểm tra, trả tệp. Mã của dịch vụ không có đường dẫn nào của gói. Gói xã khai báo giấy tờ
  hồ sơ (`application_documents`, gắn loại giấy tờ của thủ tục, mỗi giấy tờ mới sinh một sự kiện hồ sơ có ghi mã băm),
  giấy tờ cá nhân của cán bộ, giấy tờ trong mã chuyển hồ sơ tại quầy.
- Khi tải về, dịch vụ tính lại mã băm. Tệp bị sửa trong kho sẽ bị từ chối (409).
- Có quét mã độc bằng ClamAV nếu đặt `CLAMAV_HOST`. Khi đã bật mà ClamAV không chạy thì từ chối tải lên.

## API

Qua cổng APISIX, cần token Keycloak (cổng kiểm tra token, PostgreSQL kiểm tra quyền theo đơn vị):

| Phương thức | Đường dẫn                                                     | Việc                                                                                                                 |
| ----------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| POST        | `/files/{loại}/{mã}/attachments?name={tên}`                   | Đính kèm tệp vào một đối tượng của gói (ví dụ `/files/leave-requests/NP-.../attachments`). Định dạng, giới hạn như dưới. |
| GET         | `/files/{loại}/{mã}/attachments`                              | Danh sách tệp đính kèm của đối tượng.                                                                                |
| GET         | `/files/attachments/{id}`                                     | Tải tệp đính kèm (kiểm tra mã băm). |
| GET, POST   | `/files/<đường dẫn gói khai báo>`                             | Ví dụ gói xã: `POST /files/dossiers/{mã hồ sơ}/documents?code=&name=`, `GET /files/documents/{id}` (đặc tả: `modules/xa/api-docs.yaml`). |
| GET         | `/files/health`                                               | Kiểm tra dịch vụ và kho đối tượng SeaweedFS (kho không trả lời thì 503); cho biết quét mã độc có bật không.          |

**Đường dẫn tệp riêng của gói** (mục `files` trong `module.json`). Mỗi mục: `method` (`GET` tải về, `POST` tải lên), `path`
(sau `/files/`; `{tên}` là tham số, `{tên:uuid}` phải là UUID), `rpc` (hàm `api.*` của gói, gọi bằng token người dùng
kèm khóa nội bộ), `query` (tham số truy vấn: `pattern`, `required`, `max`, `default`), `args` (tham số của hàm, `{tên}` lấy
từ đường dẫn hoặc truy vấn). Tải lên: hàm nhận thêm `mime_type`, `size_bytes`, `sha256`, `storage_key`. Tải về: hàm trả
một dòng có `storage_key`, `mime_type`, `original_name` (hoặc `title`), `sha256` (có thì kiểm tra lại mã băm). Ví dụ gói xã:

```json
"files": [
  { "method": "POST", "path": "dossiers/{id}/documents", "rpc": "register_document",
    "query": { "code": { "pattern": "^[a-z0-9-]{1,100}$", "required": true }, "name": { "max": 180, "default": "tep-dinh-kem" } },
    "args": { "dossier_id": "{id}", "document_code": "{code}", "original_name": "{name}" } },
  { "method": "GET", "path": "documents/{id:uuid}", "rpc": "document_object", "args": { "document_id": "{id}" } }
]
```

Danh sách giấy tờ của một hồ sơ (gói xã) lấy ở API dữ liệu: `GET /rest/dossier_documents?dossier_id=eq.{mã}`.

**Quyền với tệp đính kèm dùng chung.** Người dùng phải xem được đối tượng qua bảng ảo của gói (`view` trong khai báo),
bằng chính token của họ, nên RLS của gói quyết định: không xem được đối tượng (đơn vị khác, nhân viên khác) thì 404.
Đơn vị phải bật gói. `uploadStatuses` (tùy chọn) giới hạn trạng thái còn nhận tệp; ví dụ đơn nghỉ phép đã duyệt thì 409.
Khai báo trong `module.json` của gói:

```json
"attachments": [
  { "resource": "leave-requests", "view": "leave_requests", "label": "Đơn nghỉ phép", "uploadStatuses": ["submitted"] }
]
```

Nội bộ, chỉ trong mạng docker (cổng không chuyển tới), cần đầu `X-Service-Token`:
`PUT /internal/objects`, `GET /internal/objects/{khóa}`, `DELETE /internal/objects/{khóa}`.
Ứng dụng của gói (ví dụ Kênh người dân) dùng đường này.

## Biến môi trường

`S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `REST_URL`,
`WORKFLOW_TOKEN` (khóa nội bộ của lõi, dùng chung với dịch vụ điều phối),
`FILES_SERVICE_TOKEN`, `CLAMAV_HOST` (tùy chọn), `PORT` (mặc định 3000),
`COMMUNEOS_MODULES`, `MODULES_DIR` (gói đang bật và thư mục gói, để đọc mục `attachments`, `files`).
