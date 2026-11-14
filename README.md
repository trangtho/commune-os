<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# CommuneOS

**DX-OS Open-Core cho chính quyền cơ sở.**

CommuneOS là nền tảng lõi mở headless, đa thuê ước, giúp một xã tự dựng hệ
điều hành số của mình: định danh, cổng API, dữ liệu, quy trình và AI chạy
ngay trên máy chủ của xã, không phụ thuộc nhà cung cấp.

Bài dự thi Phần mềm nguồn mở - Olympic Tin học Sinh viên Việt Nam (OLP) 2026,
chủ đề "Xây dựng Hệ điều hành Chuyển đổi số bằng Công nghệ Lõi nguồn mở
(DX-OS Open-Core)".

## Giấy phép

Dự án phát hành theo **Apache License 2.0** (toàn văn trong tệp
[LICENSE](LICENSE)). Chúng tôi chọn giấy phép này để mọi cơ quan, tổ chức và
cá nhân được tự do sử dụng, sửa đổi và phân phối lại phần mềm, kể cả cho mục
đích thương mại, với điều kiện giữ nguyên thông báo bản quyền và giấy phép.

Mỗi tệp mã nguồn mang tiêu đề `SPDX-License-Identifier: Apache-2.0`.
Giấy phép của các thành phần bên thứ ba được liệt kê trong
[DEPENDENCIES.md](DEPENDENCIES.md).

## Kiến trúc

| Tầng                  | Thư mục         | Nội dung                                                              |
| --------------------- | --------------- | --------------------------------------------------------------------- |
| Tầng 1 - Lõi headless | `core/`         | Cửa ngõ API, định danh, dữ liệu, quy trình, sổ cái, AI, bảng quản trị |
| Tầng 2 - Ứng dụng     | `apps/commune/` | Ứng dụng xã cho cán bộ, lãnh đạo, cấp trên                            |
| Tầng 2 - Ứng dụng     | `apps/citizen/` | Kênh nộp hồ sơ trực tuyến cho người dân                               |
| Cấu hình              | `packs/`        | Gói thủ tục: BPMN, biểu mẫu, bảng kiểm giấy tờ, wiki                  |

| Tầng                  | Thư mục         | Nội dung                                                              |
| --------------------- | --------------- | --------------------------------------------------------------------- |
| Tầng 1 - Lõi headless | `core/`         | Cửa ngõ API, định danh, dữ liệu, quy trình, sổ cái, AI, bảng quản trị |
| Tầng 2 - Ứng dụng     | `apps/commune/` | Ứng dụng xã cho cán bộ, lãnh đạo, cấp trên                            |
| Tầng 2 - Ứng dụng     | `apps/citizen/` | Kênh nộp hồ sơ trực tuyến cho người dân                               |
| Cấu hình              | `packs/`        | Gói thủ tục: BPMN, biểu mẫu, bảng kiểm giấy tờ, wiki                  |

Lõi không cấp giao diện cho người dùng cuối; nó chỉ có bảng quản trị cho quản
trị viên hệ thống. Ứng dụng ở Tầng 2 chỉ gọi lõi qua cửa ngõ API.

Chi tiết: [docs/](docs/).

## Yêu cầu hệ thống

- Docker Engine và Docker Compose (hoặc Podman)
- GNU Make
- Khoảng 16 GB RAM để chạy đầy đủ, kể cả mô hình AI cục bộ

## Dựng từ mã nguồn

```bash
git clone https://github.com/trangtho/commune-os.git
cd commune-os
cp .env.example .env      # sửa mật khẩu trong .env
make up                   # dựng và khởi động toàn bộ dịch vụ
make seed                 # nạp dữ liệu mẫu giả lập
make test                 # kiểm thử cách ly xã qua gateway (cần DEMO_PASSWORD, xem core/tests)
```

Mọi cấu hình nằm trong tệp `.env`; không cần sửa tệp mã nguồn nào.

## Cấu hình

Xem chú thích từng biến trong [.env.example](.env.example).

## Tài khoản thử

Các tài khoản dưới đây là dữ liệu giả lập, chỉ dùng trên máy phát triển.

| Tên đăng nhập | Mật khẩu | Xã (`tenant_id`) | Vai          | Dùng ở đâu                         |
| ------------- | -------- | ---------------- | ------------ | ---------------------------------- |
| `canbo.xa-a`  | `12345`  | `xa-a`           | receptionist | API `/rest`, màn hình cán bộ xã    |
| `canbo.xa-b`  | `12345`  | `xa-b`           | receptionist | API `/rest`, màn hình cán bộ xã    |
| `quantri`     | tự đặt   | (để trống)       | sys_admin    | Bảng quản trị hệ thống (cổng 3001) |

Hai tài khoản `canbo.*` có sẵn trong tệp realm và được nạp tự động.
Tài khoản `quantri` **chưa có trong tệp realm**, phải tạo tay một lần:

1. Mở http://localhost:8080/admin, đăng nhập bằng tài khoản quản trị Keycloak trong `.env`.
2. Chọn realm **communeos** ở góc trên bên trái (không dùng realm `master`).
3. Users → Create new user: Username `quantri`, điền Email, First name, Last name, bật Email verified → Create.
4. Tab Credentials → Set password, **tắt Temporary** → Save.
5. Tab Role mapping → Assign role → lọc theo realm roles → chọn `sys_admin` → Assign.

Trang quản trị Keycloak: http://localhost:8080 (tài khoản quản trị lấy từ tệp `.env`).

## Mở rộng

- Thêm thủ tục mới: sao `packs/_template/`, sửa rồi nạp qua bảng quản trị.
- Xây ứng dụng mới trên lõi: thêm thư mục trong `apps/`, gọi API qua cửa ngõ.

Hướng dẫn chi tiết trong [docs/](docs/).

## Đóng góp và báo lỗi

- Báo lỗi và đề xuất: [Issues](https://github.com/trangtho/commune-os/issues)
- Hướng dẫn đóng góp: [CONTRIBUTING.md](CONTRIBUTING.md)
- Lịch sử thay đổi: [CHANGELOG.md](CHANGELOG.md)

## Đội phát triển

Danh sách người đóng góp: [Contributors](https://github.com/trangtho/commune-os/graphs/contributors).

## Kênh Công dân – giao diện & PostgreSQL mô phỏng

Từ bản cập nhật này, `apps/citizen/` chứa ứng dụng Nuxt 3, Vue 3, TypeScript,
Tailwind CSS có thể điều hướng và thao tác qua API Nitro, với PostgreSQL làm
nguồn dữ liệu mẫu. Giao diện tái sử dụng header, banner xanh, bộ bước thực
hiện, danh mục bên trái và bảng hỗ trợ bên phải theo mẫu CommuneOS.

**Chạy bản demo:**

```bash
cp .env.example .env
# DÙNG MẬT KHẨU RIÊNG, KHÔNG GIỮ CÁC GIÁ TRỊ CHANGE_ME
# Trong .env, đặt SESSION_SECRET bằng giá trị từ: openssl rand -hex 32
make up
# Mở http://localhost:3000
```

Lệnh `make up` sử dụng dịch vụ `db-setup` để nạp schema và dữ liệu mẫu cả trên
**volume trống và volume đã tồn tại**. Thủ tục mẫu trùng mã sẽ không bị ghi đè.
Để sửa trực tiếp khi đã chạy bản cũ, dùng `make repair-db`; xem thêm
[docs/CITIZEN_SETUP.md](docs/CITIZEN_SETUP.md).

Tài khoản demo **chỉ dành cho phát triển cục bộ**:
`congdan.demo` / `Demo@2026!`.

Cổng có danh mục thủ tục, chi tiết thủ tục, nộp hồ sơ nhiều bước có Poka-yoke,
tải file PDF/JPG/PNG, danh sách và chi tiết hồ sơ, tra cứu tiến độ, bổ sung,
kết quả mô phỏng, thông báo, trợ lý FAQ, hướng dẫn, hồ sơ cá nhân, đổi mật
khẩu và phản hồi. Các thay đổi được ghi vào PostgreSQL.

**Giới hạn:** Đây là demo, không phải hệ thống dịch vụ công thật: chưa triển
khai Keycloak OIDC, cổng APISIX, Flowable, ký số, OCR, RAG hoặc kiểm dịch
ClamAV. Không nhập, tải lên hoặc đưa vào kho mã bất kỳ dữ liệu cá nhân thật nào.
Không triển khai public Internet ở chế độ DEMO_MODE.

Chi tiết cấu hình, kiến trúc API, cách thử và hạn chế bảo mật:
[docs/CITIZEN_SETUP.md](docs/CITIZEN_SETUP.md).

### PostgreSQL: khắc phục thiếu thủ tục trên volume cũ

Từ phiên bản sửa lỗi này, `make up` tự chạy `db-setup` (idempotent) để tạo bảng,
cấp quyền và nạp dữ liệu mẫu cho volume đã tồn tại. Nếu trang Công dân báo
"Không tải được thủ tục từ PostgreSQL", chạy `make repair-db`, `make doctor`,
rồi kiểm tra `http://localhost:3000/api/health` và `/api/procedures`.
Không xóa Docker volume có dữ liệu cần giữ. Chi tiết: `docs/CITIZEN_SETUP.md`.

**Kết nối PostgreSQL cho ứng dụng Nuxt trong Docker:** Các giá trị runtime
`NUXT_DB_HOST=db`, `NUXT_DB_NAME`, `NUXT_DB_USER`, `NUXT_DB_PASSWORD` và
`NUXT_SESSION_SECRET` được cấu hình trong `docker-compose.yml`. Chỉ đặt biến
`PGHOST` trong Compose là chưa đủ để bảo đảm Nuxt runtimeConfig nhận đúng
địa chỉ khi build image trước khi container chạy. Chi tiết tại
`docs/CITIZEN_SETUP.md`.

### Tự động cập nhật dữ liệu trên kênh Công dân

Kênh Công dân hỗ trợ đồng bộ không cần tải lại trang bằng PostgreSQL `LISTEN/NOTIFY` → Nuxt SSE → Vue `refreshNuxtData`. Trên database volume cũ, chạy `make repair-db` **một lần** để cài các trigger, sau đó truy cập như bình thường. Nếu SSE bị gián đoạn, trình duyệt tự đối soát dữ liệu bằng gọi API định kỳ. Hướng dẫn kiểm tra và giới hạn demo: [docs/REALTIME_CITIZEN.md](docs/REALTIME_CITIZEN.md).
