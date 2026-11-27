<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# core/tests

Kiểm thử API của lõi và kiểm thử cách ly dữ liệu giữa các đơn vị. `tenant-isolation.sh` cần gói xã (`make demo`);
kiểm thử của gói doanh nghiệp nằm ở `modules/doanh-nghiep/test.sh`.

| Tệp                   | Kiểm tra                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `wait-ready.sh`       | Không phải kiểm thử: chờ mọi dịch vụ sẵn sàng (healthcheck đạt, `db-setup`, `identity-setup`, `rest-keys` kết thúc với mã 0), báo dịch vụ lỗi. Dùng ở cuối `make up`, trong `make ready` và CI. |
| `platform.sh`         | Phần lõi dùng chung, không phụ thuộc gói nào (`make test-platform`): gói đã cài khớp `COMMUNEOS_MODULES`, không token bị chặn, tạo và hủy đơn vị kèm lãnh đạo qua dịch vụ tài khoản, token mang đúng đơn vị, đơn vị chỉ dùng gói chọn khi tạo (tắt được, gói chưa cài bị từ chối, lãnh đạo không tự bật), sổ ghi nhận nguyên vẹn và không xóa được, loại quy trình chưa khai báo trả 404; tệp đính kèm, kho tri thức chỉ đi qua dịch vụ của lõi; khi không cài gói xã thì không có bảng, API nào của gói xã. CI chạy cả trên bản cài chỉ có lõi. |
| `tenant-isolation.sh` | Đi đường thật Keycloak → APISIX → PostgREST → PostgreSQL. 49 mục (54 khi có AI): không token bị chặn, xã A không đọc được hồ sơ xã B, số điện thoại được che, API chỉ đọc, cán bộ xã không thêm được xã, token bị sửa bị chặn, cán bộ xã khác không xử lý được hồ sơ, bước chuyển sai và thiếu lý do bị chặn, sổ ghi nhận nguyên vẹn, sơ đồ BPMN trả đúng các bước đi tiếp, không bỏ qua được động cơ quy trình, thủ tục theo xã, lưu trữ tệp và SHA-256, quản lý tài khoản cán bộ, phân công và hai cấp duyệt, công dân chỉ thấy hồ sơ của mình qua `/rest`, token công dân không đọc được dữ liệu cán bộ và ngược lại, cần client secret mới xin được token công dân, khách chỉ xem được danh mục thủ tục qua `/public`, công dân không đọc hay nộp được hồ sơ của người khác, đọc được tình trạng quy trình, kho tệp, tài khoản qua cổng, thông báo cán bộ theo xã và chỉ lãnh đạo gửi được thông báo cho công dân, quản trị hệ thống đăng nhập bằng tài khoản trong `.env`, chỉ quản trị tạo được xã, tạo xã kèm lãnh đạo (lãnh đạo phải đổi mật khẩu tạm, token mang đúng xã), tạo tài khoản lãnh đạo lỗi thì xã vừa tạo bị hủy, quản lý lãnh đạo không vượt xã, người dân tự đăng ký (thiếu đồng ý, mật khẩu yếu, trùng tên bị từ chối); xã, tài khoản kiểm thử được dọn sau khi chạy. Thêm 5 mục AI khi dịch vụ AI đang chạy: `/ai/ask` cần token, tìm đúng thủ tục theo nghĩa và che số điện thoại, chỉ quản trị xem tình trạng AI, phạm vi trợ lý theo xã và đối tượng, từ chối tra cứu thông tin cá nhân, dịch vụ chạy mô hình không ra được Internet (không chạy thì báo BỎ QUA) |

## Chạy

Cần `docker compose up -d` đang chạy, cùng `curl` và `python3`. `make test` tự chạy `make demo` trước (tạo xã,
tài khoản và hồ sơ mẫu qua API; chạy lại được); các bài `make *-test` bằng SQL cũng vậy, và đọc mã xã, công dân mẫu
theo `xa-a`, `xa-b`, `congdan.demo`, `congdan.khac`.

```bash
make test
```

`DEMO_PASSWORD` là mật khẩu của các tài khoản do `make demo` tạo: cán bộ, lãnh đạo, công dân (mặc định `Demo@2026!`).
Tài khoản quản trị hệ thống lấy từ `COMMUNEOS_ADMIN_USERNAME`, `COMMUNEOS_ADMIN_PASSWORD` (không đặt thì đọc từ `.env`);
phần dọn dữ liệu kiểm thử dùng `KEYCLOAK_ADMIN`, `KEYCLOAK_ADMIN_PASSWORD` trong `.env`.
`CITIZEN_KEYCLOAK_SECRET` là bí mật của client `citizen-app` (không đặt thì đọc từ tệp `.env`).
Kết quả đúng: 54 dòng `ĐẠT` (49 và một dòng `BỎ QUA` khi không chạy AI) và dòng cuối `KẾT QUẢ: ĐẠT`.

Nếu một xã đang bị khóa trong bảng quản trị, mục "Xã A thấy hồ sơ của mình"
sẽ báo LỖI. Đây là hành vi đúng: mở khóa xã rồi chạy lại.

Kiểm thử Kênh người dân chạy riêng: `make test-citizen` (đơn vị), `make test-sql` (RLS bằng SQL, ROLLBACK),
`make e2e-citizen` (giao diện, Playwright trong Docker; tạo dữ liệu trên tài khoản mẫu).
