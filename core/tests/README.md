<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# core/tests

Kiểm thử API và kiểm thử cách ly dữ liệu giữa các xã.

| Tệp                   | Kiểm tra                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tenant-isolation.sh` | Đi đường thật Keycloak → APISIX → PostgREST → PostgreSQL. 28 mục: không token bị chặn, xã A không đọc được hồ sơ xã B, số điện thoại được che, API chỉ đọc, cán bộ xã không thêm được xã, token bị sửa bị chặn, cán bộ xã khác không xử lý được hồ sơ, bước chuyển sai và thiếu lý do bị chặn, sổ ghi nhận nguyên vẹn, sơ đồ BPMN trả đúng các bước đi tiếp, không bỏ qua được động cơ quy trình, thủ tục theo xã, lưu trữ tệp và SHA-256, quản lý tài khoản cán bộ, phân công và hai cấp duyệt |

## Chạy

Cần `docker compose up -d` đang chạy, cùng `curl` và `python3`.

```bash
DEMO_PASSWORD=12345 make test
```

`DEMO_PASSWORD` là mật khẩu của các tài khoản thử cán bộ, lãnh đạo và quản trị (mặc định `12345`).
Kết quả đúng: 28 dòng `ĐẠT` và dòng cuối `KẾT QUẢ: ĐẠT`.

Nếu một xã đang bị khóa trong bảng quản trị, mục "Xã A thấy hồ sơ của mình"
sẽ báo LỖI. Đây là hành vi đúng: mở khóa xã rồi chạy lại.

Kiểm thử Kênh người dân chạy riêng bằng `make test-citizen`.
