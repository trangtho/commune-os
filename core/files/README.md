<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# Dịch vụ tệp (lưu trữ dữ liệu phi cấu trúc)

Dịch vụ không giao diện của lõi, quản lý giấy tờ của hồ sơ.

- Nội dung tệp nằm trong kho đối tượng chuẩn S3 (SeaweedFS, dịch vụ `storage`).
- PostgreSQL giữ thông tin mô tả và mã băm SHA-256 (`application_documents`, `modules/xa/db/14-luu-tru-tep.sql`).
- Mỗi giấy tờ mới sinh một sự kiện hồ sơ có ghi mã băm, nên mã băm nằm trong sổ ghi nhận.
- Khi tải về, dịch vụ tính lại mã băm. Tệp bị sửa trong kho sẽ bị từ chối (409).
- Có quét mã độc bằng ClamAV nếu đặt `CLAMAV_HOST`. Khi đã bật mà ClamAV không chạy thì từ chối tải lên.

## API

Qua cổng APISIX, cần token Keycloak (cổng kiểm tra token, PostgreSQL kiểm tra quyền theo xã):

| Phương thức | Đường dẫn                                                     | Việc                                                                                                                 |
| ----------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| POST        | `/files/dossiers/{mã hồ sơ}/documents?code={loại}&name={tên}` | Đính kèm tệp. Thân là nội dung tệp, `Content-Type` là `application/pdf`, `image/png` hoặc `image/jpeg`, tối đa 5 MB. |
| GET         | `/files/documents/{id}`                                       | Tải tệp. Đầu trả về có `X-Content-SHA256`.                                                                           |
| GET         | `/files/health`                                               | Kiểm tra dịch vụ và kho đối tượng SeaweedFS (kho không trả lời thì 503); cho biết quét mã độc có bật không.          |

Danh sách giấy tờ của hồ sơ lấy ở API dữ liệu: `GET /rest/dossier_documents?dossier_id=eq.{mã}`.

Nội bộ, chỉ trong mạng docker (cổng không chuyển tới), cần đầu `X-Service-Token`:
`PUT /internal/objects`, `GET /internal/objects/{khóa}`, `DELETE /internal/objects/{khóa}`.
Kênh người dân dùng đường này.

## Biến môi trường

`S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `REST_URL`,
`WORKFLOW_TOKEN` (khóa nội bộ của lõi, dùng chung với dịch vụ điều phối),
`FILES_SERVICE_TOKEN`, `CLAMAV_HOST` (tùy chọn), `PORT` (mặc định 3000).
