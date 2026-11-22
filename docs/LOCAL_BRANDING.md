<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# CommuneOS – biểu trưng (bản mô phỏng)

## Hiện trạng

- Header của Kênh người dân, màn hình cán bộ và bảng quản trị dùng biểu trưng CommuneOS do nhóm tự vẽ
  (hình trụ sở cách điệu trên nền màu chủ đạo của từng ứng dụng), kèm chữ CommuneOS. Biểu tượng tab trình duyệt
  (favicon) dùng cùng tệp này.
- Ở chiều rộng dưới 360px, Kênh người dân ẩn chữ CommuneOS, chỉ giữ biểu trưng và điều hướng.
- Dự án không dùng logo của cơ quan, tổ chức nào; hai logo trước đây đã được gỡ vì không có quyền sử dụng.

## Tệp ảnh

- `apps/citizen/public/images/logo-communeos.svg` (xanh dương)
- `apps/commune/public/images/logo-communeos.svg` (xanh ngọc)
- `apps/admin/public/images/logo-communeos.svg` (chàm)

Ba tệp SVG có tiêu đề SPDX Apache-2.0. Muốn đổi màu hay hình, sửa trực tiếp tệp SVG (giữ nguyên tên tệp).

## Xem kết quả trên máy local

Tại thư mục dự án:

```bash
docker compose up -d --build citizen commune admin
```

Truy cập `http://localhost:3000`, `http://localhost:3002`, `http://localhost:3001` và tải lại trang (Ctrl+Shift+R nếu
favicon còn lưu trong cache). Không cần chỉnh sửa cơ sở dữ liệu.
