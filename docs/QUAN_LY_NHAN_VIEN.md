<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# Quản lý nhân viên trong xã

Mỗi xã có hai vai trò: `leader` (lãnh đạo) và `officer` (cán bộ xử lý). Tài liệu này mô tả phần dữ liệu
nghiệp vụ về cán bộ. Tài khoản đăng nhập nằm ở Keycloak và do dịch vụ `core/accounts` quản lý
(xem [core/accounts/README.md](../core/accounts/README.md)).

## Ai làm được gì

| Chức năng | Cán bộ xử lý | Lãnh đạo xã |
| --- | --- | --- |
| Tạo, sửa, khóa, mở, cấp lại mật khẩu, xóa tài khoản cán bộ xử lý | | ✓ (`/accounts/*`) |
| Xem hồ sơ cá nhân và giấy tờ của mình | ✓ | ✓ |
| Đề nghị sửa hồ sơ, nộp hoặc bỏ giấy tờ (chờ duyệt) | ✓ | ✓ |
| Sửa thẳng hồ sơ của cán bộ, đánh dấu đã nghỉ việc | | ✓ |
| Duyệt hoặc không duyệt yêu cầu của cán bộ | | ✓ (không tự duyệt yêu cầu của mình) |
| Giao việc, hủy việc | | ✓ |
| Cập nhật tiến độ việc được giao | ✓ (chỉ việc của mình) | ✓ |
| Phân công hồ sơ của dân cho cán bộ | | ✓ |
| Trả kết quả hồ sơ của dân (hoàn thành, từ chối) | Phải có đề nghị đã được lãnh đạo duyệt | ✓ |
| Giám sát khối lượng công việc theo cán bộ | | ✓ |

## Thông tin hồ sơ cán bộ

Họ tên, giới tính, ngày sinh, mã cán bộ, chức vụ, đơn vị công tác, ngày vào làm, trình độ chuyên môn,
điện thoại, email công vụ, lĩnh vực phụ trách, địa chỉ liên hệ, đang công tác hay đã nghỉ.
Mã cán bộ và ngày vào làm chỉ lãnh đạo nhập. Lãnh đạo tự sửa hồ sơ của mình không cần duyệt.
Cố ý không lưu số CCCD, dân tộc, tôn giáo: chỉ giữ thông tin cần cho công việc.

## Thiết kế

- Bảng `staff_profiles`, `staff_documents`, `staff_requests`, `staff_tasks` và hai cột
  `applications.assigned_staff_id`, `assigned_staff_name` (tệp `core/db/init/17-nhan-vien.sql`).
- Không bảng nào cho đọc ghi trực tiếp. Ứng dụng đọc qua các view `api.my_*` (của người gọi) và
  `api.staff_*` (cả xã, chỉ lãnh đạo; người khác nhận danh sách rỗng). Ghi qua các hàm `SECURITY DEFINER`;
  mỗi hàm kiểm tra vai trò và xã lấy từ token Keycloak, cán bộ được nhận diện bằng `sub`.
- Mọi thay đổi do cán bộ đề nghị chỉ được áp dụng trong hàm `api.decide_staff_request`, khi lãnh đạo duyệt.
  Đề nghị sửa hồ sơ chỉ nhận các trường cho phép; các trường khác (ví dụ `tenant_code`) bị bỏ.
- Giấy tờ cá nhân đi qua dịch vụ tệp của lõi (`POST /files/staff-documents`): kiểm tra định dạng,
  quét mã độc (nếu bật), lưu kho đối tượng, ghi SHA-256. Khi tải về, mã băm được so lại.
  Chỉ chủ giấy tờ hoặc lãnh đạo cùng xã tải được.
- Hai cấp duyệt: trigger `check_dossier_approval` trên `applications` chặn cán bộ xử lý chuyển hồ sơ
  sang `completed` hoặc `rejected` khi chưa có đề nghị `dossier_approval` đã duyệt, đúng kết quả đề nghị.
  Dùng xong, đề nghị chuyển sang `used`, không dùng lại được. Quyết định của lãnh đạo và việc phân công
  được ghi vào nhật ký hồ sơ (`application_events`), nên cũng vào sổ ghi nhận.
- "Xóa" cán bộ: tài khoản Keycloak bị xóa hẳn (phải khóa trước). Hồ sơ cá nhân, việc đã giao, nhật ký vẫn giữ
  để tra cứu; lãnh đạo đánh dấu hồ sơ là đã nghỉ việc.

## Giao diện (Màn hình cán bộ, cổng 3002)

- **Hồ sơ cá nhân** (`/ho-so-ca-nhan`, mọi cán bộ): Thông tin, Giấy tờ, Yêu cầu của tôi.
- **Việc được giao** (`/viec-duoc-giao`, mục riêng trên menu, có số việc chưa xong; trang Tổng quan cũng hiện các việc này): bắt đầu làm, báo đã xong kèm ghi chú kết quả.
- **Nhân viên** (`/tai-khoan`, chỉ lãnh đạo): Tài khoản, Hồ sơ nhân viên, Chờ duyệt, Giao việc, Giám sát công việc.
- **Chi tiết hồ sơ** (`/ho-so/:id`): khối "Phân công & duyệt".
