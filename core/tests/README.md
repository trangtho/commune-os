<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# core/tests

Kiểm thử API và kiểm thử cách ly dữ liệu giữa các xã.

| Tệp                   | Kiểm tra                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tenant-isolation.sh` | Đi đường thật Keycloak → APISIX → PostgREST → PostgreSQL. 41 mục (45 khi có AI): không token bị chặn, xã A không đọc được hồ sơ xã B, số điện thoại được che, API chỉ đọc, cán bộ xã không thêm được xã, token bị sửa bị chặn, cán bộ xã khác không xử lý được hồ sơ, bước chuyển sai và thiếu lý do bị chặn, sổ ghi nhận nguyên vẹn, sơ đồ BPMN trả đúng các bước đi tiếp, không bỏ qua được động cơ quy trình, thủ tục theo xã, lưu trữ tệp và SHA-256, quản lý tài khoản cán bộ, phân công và hai cấp duyệt, công dân chỉ thấy hồ sơ của mình qua `/rest`, token công dân không đọc được dữ liệu cán bộ và ngược lại, cần client secret mới xin được token công dân, khách chỉ xem được danh mục thủ tục qua `/public`, công dân không đọc hay nộp được hồ sơ của người khác, đọc được tình trạng quy trình, kho tệp, tài khoản qua cổng, thông báo cán bộ theo xã và chỉ lãnh đạo gửi được thông báo cho công dân. Thêm 4 mục AI khi dịch vụ AI đang chạy: `/ai/ask` cần token, tìm đúng thủ tục theo nghĩa và che số điện thoại, chỉ quản trị xem tình trạng AI, dịch vụ chạy mô hình không ra được Internet (không chạy thì báo BỎ QUA) |

## Chạy

Cần `docker compose up -d` đang chạy, cùng `curl` và `python3`.

```bash
DEMO_PASSWORD=12345 make test
```

`DEMO_PASSWORD` là mật khẩu của các tài khoản thử cán bộ, lãnh đạo và quản trị (mặc định `12345`).
`CITIZEN_DEMO_PASSWORD` là mật khẩu của `congdan.demo`, `congdan.khac` (mặc định `Demo@2026!`).
`CITIZEN_KEYCLOAK_SECRET` là bí mật của client `citizen-app` (không đặt thì đọc từ tệp `.env`).
Kết quả đúng: 45 dòng `ĐẠT` (41 và một dòng `BỎ QUA` khi không chạy AI) và dòng cuối `KẾT QUẢ: ĐẠT`.

Nếu một xã đang bị khóa trong bảng quản trị, mục "Xã A thấy hồ sơ của mình"
sẽ báo LỖI. Đây là hành vi đúng: mở khóa xã rồi chạy lại.

Kiểm thử Kênh người dân chạy riêng bằng `make test-citizen`.
