<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
# Kiểm tra trước nộp, lịch tại quầy, tiến trình và bổ sung theo yêu cầu

Các chức năng mở rộng dựa trên mã nguồn `main` trong gói CommuneOS `(6)`; không thay các API xử lý hồ sơ hiện có.

## 1. Kiểm tra hồ sơ trước nộp (Poka-yoke)

- Công dân lưu bản nháp theo quy trình hiện tại, tải giấy tờ lên rồi mở **Rà soát và xác nhận**.
- `GET /api/applications/:id/preflight` đối chiếu **dữ liệu đã lưu trên server** với trường bắt buộc, kiểu/định dạng thông tin, yêu cầu giấy tờ, địa phương tiếp nhận, quyền nộp/đại diện và trạng thái công bố thủ tục.
- `blocking` là lỗi xác định từ dữ liệu hiện có và chặn gửi. `verify` là các nội dung cán bộ cần kiểm chứng như tính hợp lệ bản chính và điều kiện pháp lý, **không** được coi là lỗi chắc chắn.
- `POST /api/applications/:id/submit` tiếp tục kiểm tra trong giao dịch khi gửi, không tin trạng thái đã kiểm tra trên client.
- Dữ liệu thủ tục/biểu mẫu trong repo vẫn là **mẫu minh họa**; không khẳng định điều kiện nghiệp vụ đã được phê duyệt. Để bổ sung điều kiện pháp lý chính thức cần bộ quy tắc có nguồn, hiệu lực và phê duyệt.

## 2. Lịch hẹn và số thứ tự tiếp nhận

Giao diện: `/lich-hen-mot-cua` (yêu cầu tài khoản công dân).

API công dân:

- `GET /api/counter/slots?procedureId=khai-sinh` – chỉ khung giờ **đã công bố** cho địa phương đăng nhập, số chỗ còn lại từ hàm tổng hợp an toàn.
- `POST /api/counter/bookings` với `{ "slotId": "<uuid>" }` – cấp số nguyên tăng theo khung giờ, khóa bản ghi slot để không trùng số; tối đa 3 lượt tương lai/tài khoản.
- `GET /api/counter/bookings` – chỉ lịch của tài khoản hiện tại, có trạng thái và số đang phục vụ khi cán bộ cập nhật.
- `POST /api/counter/bookings/:id/cancel` – chỉ hủy lịch `booked`, trước giờ bắt đầu.

API PostgREST dành cho cán bộ (`commune-app` **với JWT cán bộ**, không dùng phiên công dân):

- `POST /rest/rpc/publish_counter_slot` với `p_procedure_id`, `p_starts_at`, `p_ends_at`, `p_capacity` để công bố khung giờ. Không có khung giờ mặc định giả lập.
- `POST /rest/rpc/list_counter_tickets` với `p_slot_id`: danh sách ID số thứ tự (không xuất tên hoặc số định danh công dân).
- `POST /rest/rpc/set_counter_ticket_status` với `p_booking_id`, `p_status`; chỉ nhận trạng thái hợp lệ theo thứ tự `booked → checked_in → serving → done` (có thể đánh dấu `no_show`).

**Cần tích hợp giao diện cán bộ/máy lấy số** để cán bộ công bố lịch, điểm danh và gọi số. Chưa có công cụ dự báo thời gian chờ hoặc xác minh công dân đến quầy. Không dùng số thứ tự thay cho bước tiếp nhận hồ sơ chính thức.

## 3. Tiến trình và hạn xử lý từng công đoạn

`GET /api/applications/:id/stages` chỉ đọc dữ liệu do cán bộ phát hành qua `api.record_citizen_case_stage` (tham số `p_application_id`, `p_stage_name`, `p_stage_status`, `p_unit_name`, `p_due_at`, `p_reason`).

- Cơ quan xử lý xác định tên công đoạn, đơn vị phụ trách và thời hạn; hệ thống không tạo công đoạn hoặc hạn xử lý giả.
- Thay đổi thời hạn dài hơn so với lần cập nhật trước của cùng một công đoạn phải kèm lý do.
- Màn hình hồ sơ hiển thị cập nhật mới nhất của từng công đoạn và cho phép mở lịch sử cập nhật.
- Khi chưa có dữ liệu từ cán bộ, màn hình hiển thị trạng thái tổng quát và thông báo **chưa có công đoạn chi tiết**.

## 4. Bổ sung theo danh sách yêu cầu cụ thể

Bên cán bộ có quyền gọi `POST /rest/rpc/request_citizen_case_supplement` với các tham số:

```json
{
  "p_application_id": "HS-...",
  "p_note": "Bổ sung giấy tờ chưa đầy đủ",
  "p_items": [
    {"kind":"document","key":"<document_code>","instruction":"Vui lòng nộp bản giấy tờ rõ nét","reason":"Tệp cũ không đọc được"},
    {"kind":"field","key":"<form_data_key>","instruction":"Vui lòng giải trình thông tin khai báo","reason":"Nội dung chưa thống nhất với chứng từ"}
  ]
}
```

- Hàm cán bộ kiểm tra JWT, xã tiếp nhận, trạng thái hồ sơ, giới hạn tối đa 12 mục và tính hợp lệ của từng mã giấy tờ / trường đã kê khai.
- `GET /api/applications/:id/supplement` trả danh sách yêu cầu của đợt bổ sung mới nhất cho chính người nộp.
- `POST /api/applications/:id/supplement/:itemId` lưu văn bản giải trình (`response`) hoặc chọn tài liệu đã tải lên đúng mã và sau thời điểm yêu cầu (`documentId`).
- `POST /api/applications/:id/complete-supplement` chỉ chấp nhận khi **tất cả** mục có nội dung hợp lệ; ghi sự kiện trả về xử lý. Khi cán bộ dùng đường trạng thái cũ không có yêu cầu chi tiết, giữ kiểm tra cũ: phải tải ít nhất một giấy tờ mới.
- Cán bộ gọi `POST /rest/rpc/read_dossier_supplement` với `p_application_id` để xem phản hồi phục vụ thẩm định; công dân không thể sửa lời yêu cầu hoặc tự đánh dấu đã phê duyệt.

Các phản hồi trường được lưu ở bảng bổ sung, **không tự sửa nội dung biểu mẫu đã nộp**; cơ quan tiếp nhận quyết định cách xử lý.

## 5. Migration và kiểm thử

Áp dụng sau các migration hiện có trong `db-setup`:

```bash
cd /Users/T07/Hakathon/Source/commune-os-integrated
npm --prefix apps/citizen test
npm --prefix apps/citizen run build
# Sao lưu PostgreSQL trước khi cập nhật nếu có dữ liệu quan trọng.
make COMPOSE="docker compose -f docker-compose.yml" repair-db
make COMPOSE="docker compose -f docker-compose.yml" preflight-counter-test
```

Migration: `core/db/init/12-citizen-case-review-counter.sql`.

Lưu ý: cần có đội cán bộ công bố lịch/công đoạn và tạo yêu cầu bổ sung thật. Kiểm thử tĩnh không thay thế kiểm thử RLS, truy cập chéo tài khoản, thử đặt lịch đồng thời và Playwright trên hệ thống Docker thực tế.
