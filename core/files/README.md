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
- Gói xã còn có giấy tờ hồ sơ riêng (`application_documents`, `modules/xa/db/14-luu-tru-tep.sql`) gắn với loại giấy tờ
  của thủ tục; mỗi giấy tờ mới sinh một sự kiện hồ sơ có ghi mã băm, nên mã băm nằm trong sổ ghi nhận.
- Khi tải về, dịch vụ tính lại mã băm. Tệp bị sửa trong kho sẽ bị từ chối (409).
- Có quét mã độc bằng ClamAV nếu đặt `CLAMAV_HOST`. Khi đã bật mà ClamAV không chạy thì từ chối tải lên.

## API

Qua cổng APISIX, cần token Keycloak (cổng kiểm tra token, PostgreSQL kiểm tra quyền theo đơn vị):

| Phương thức | Đường dẫn                                                     | Việc                                                                                                                 |
| ----------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| POST        | `/files/{loại}/{mã}/attachments?name={tên}`                   | Đính kèm tệp vào một đối tượng của gói (ví dụ `/files/leave-requests/NP-.../attachments`). Định dạng, giới hạn như dưới. |
| GET         | `/files/{loại}/{mã}/attachments`                              | Danh sách tệp đính kèm của đối tượng.                                                                                |
| GET         | `/files/attachments/{id}`                                     | Tải tệp đính kèm (kiểm tra mã băm). |
| POST        | `/files/dossiers/{mã hồ sơ}/documents?code={loại}&name={tên}` | Đính kèm tệp. Thân là nội dung tệp, `Content-Type` là `application/pdf`, `image/png` hoặc `image/jpeg`, tối đa 5 MB. |
| GET         | `/files/documents/{id}`                                       | Tải tệp. Đầu trả về có `X-Content-SHA256`.                                                                           |
| GET         | `/files/health`                                               | Kiểm tra dịch vụ và kho đối tượng SeaweedFS (kho không trả lời thì 503); cho biết quét mã độc có bật không.          |

Đường dẫn `/files/dossiers/...`, `/files/documents/...` là giấy tờ hồ sơ của gói xã; danh sách giấy tờ của hồ sơ lấy ở
API dữ liệu: `GET /rest/dossier_documents?dossier_id=eq.{mã}`.

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
Kênh người dân dùng đường này.

## Biến môi trường

`S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `REST_URL`,
`WORKFLOW_TOKEN` (khóa nội bộ của lõi, dùng chung với dịch vụ điều phối),
`FILES_SERVICE_TOKEN`, `CLAMAV_HOST` (tùy chọn), `PORT` (mặc định 3000),
`COMMUNEOS_MODULES`, `MODULES_DIR` (gói đang bật và thư mục gói, để đọc mục `attachments`).
