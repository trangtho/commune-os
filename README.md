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

Mỗi tệp mã nguồn mang tiêu đề SPDX khai báo giấy phép Apache-2.0; các tệp không
viết được chú thích (JSON, hình ảnh) được khai báo trong [REUSE.toml](REUSE.toml).
Kiểm tra bằng `reuse lint`.
Giấy phép của các thành phần bên thứ ba được liệt kê trong
[DEPENDENCIES.md](DEPENDENCIES.md).

## Kiến trúc

| Tầng                  | Thư mục         | Nội dung                                                                          |
| --------------------- | --------------- | --------------------------------------------------------------------------------- |
| Tầng 1 - Lõi headless | core/           | Cửa ngõ API, định danh, dữ liệu, lưu trữ tệp, quy trình, sổ cái (không giao diện) |
| Tầng 2 - Ứng dụng     | `apps/commune/` | Ứng dụng xã cho cán bộ, lãnh đạo, cấp trên                                        |
| Tầng 2 - Ứng dụng     | `apps/citizen/` | Kênh nộp hồ sơ trực tuyến cho người dân                                           |
| Tầng 2 - Ứng dụng     | `apps/admin/`   | Bảng quản trị hệ thống: xã, thủ tục, sổ ghi nhận                                  |
| Cấu hình              | `packs/`        | Gói thủ tục: BPMN, biểu mẫu, bảng kiểm giấy tờ, wiki                              |

Lõi hoàn toàn không có giao diện: chỉ có dịch vụ và API. Bảng quản trị (`apps/admin`) và
phần xử lý hồ sơ của màn hình cán bộ (`apps/commune`) gọi lõi qua cửa ngõ API.
Kênh người dân (`apps/citizen`) đăng nhập qua Keycloak; luồng chính (thủ tục, bản nháp, nộp hồ sơ,
giấy tờ, hồ sơ của tôi, thông báo, hồ sơ cá nhân) gọi lõi qua cửa ngõ. Các chức năng phụ còn lại vẫn
đọc ghi PostgreSQL trực tiếp bằng vai trò `communeos_app` (có RLS).
Mỗi xã tự có danh sách thủ tục được mở. Cán bộ và người dân chỉ thấy, chỉ nộp được thủ tục xã mình đang mở; cơ sở dữ liệu tự chặn nếu ai đó vượt qua giao diện. Quản trị hệ thống cấu hình xã và thủ tục nhưng không đọc được nội dung hồ sơ.

### Dịch vụ của lõi

| Dịch vụ (docker compose)          | Thành phần            | Vai trò                                                                                      |
| --------------------------------- | --------------------- | -------------------------------------------------------------------------------------------- |
| `identity`, `identity-setup`      | Keycloak              | Đăng nhập một lần cho cán bộ và công dân; `identity-setup` bổ sung mục mới vào realm đã có  |
| `gateway`                         | Apache APISIX         | Cửa ngõ API: `/rest`, `/workflow`, `/files`, `/accounts`, `/ai` (kiểm tra token), `/public` (khách) |
| `db`, `rest`                      | PostgreSQL, PostgREST | Dữ liệu có cấu trúc, API tự sinh, cách ly xã bằng RLS                                        |
| `workflow-engine`, `orchestrator` | Flowable, Node.js     | Quy trình xử lý hồ sơ theo sơ đồ BPMN                                                        |
| `storage`                         | SeaweedFS             | Kho đối tượng chuẩn S3 cho giấy tờ (dữ liệu phi cấu trúc)                                    |
| `files`                           | Node.js               | Dịch vụ tệp: kiểm tra, lưu, mã băm SHA-256 ([core/files](core/files/README.md))              |
| `antivirus` (tùy chọn)            | ClamAV                | Quét mã độc tệp tải lên                                                                      |
| `accounts`                        | Node.js               | Lãnh đạo xã quản lý tài khoản cán bộ qua Keycloak ([core/accounts](core/accounts/README.md)) |
| `ai`, `ai-gateway`, `ai-models`   | Ollama, Node.js       | AI chạy cục bộ: tìm kiếm ngữ nghĩa, chọn trích dẫn ([core/ai](core/ai/README.md))            |

AI của lõi chạy hoàn toàn trên máy chủ: mô hình (mặc định `qwen3:1.7b` và `bge-m3`) nằm trong mạng
Docker không có đường ra Internet, không gọi API AI bên ngoài. Mô hình không nằm trong kho mã;
`make up` tự tải ở lần chạy đầu (cần Internet lần đó, khoảng 2,6 GB).

Chi tiết: [docs/](docs/).

## Yêu cầu hệ thống

- Docker Engine và Docker Compose (hoặc Podman)
- GNU Make
- Khoảng 8 GB RAM cho toàn bộ dịch vụ, trong đó khoảng 2,5 GB cho mô hình AI cục bộ
- Khoảng 4 GB ổ đĩa cho mô hình AI (volume `ai-models`); chạy được chỉ với CPU
- Thêm khoảng 1,5 GB RAM nếu bật quét mã độc (dịch vụ antivirus)

## Dựng từ mã nguồn

```bash
git clone https://github.com/trangtho/commune-os.git
cd commune-os
cp .env.example .env      # sửa mật khẩu trong .env
make up                   # dựng, khởi động toàn bộ dịch vụ và tự nạp dữ liệu mẫu (db-setup)
make test                 # 46 kiểm tra qua gateway: cách ly xã, quy trình, tệp, tài khoản, công dân, AI (xem core/tests)
make test-citizen         # kiểm thử đơn vị Kênh người dân
```

Sau mỗi lần `git pull`, chạy lại `make up`: lệnh này dừng ngay nếu `.env` thiếu biến bắt buộc mới thêm
(`make check-env` báo tên biến, chép dòng tương ứng từ `.env.example`), và khởi động lại các dịch vụ lõi chạy thẳng
mã nguồn (`gateway`, `orchestrator`, `accounts`, `files`, `ai-gateway`) để không còn chạy mã cũ. Máy đã có PostgreSQL
dùng cổng 5432 thì đổi `POSTGRES_PORT` trong `.env`. Vừa khởi động lại máy mà đăng nhập báo "Hệ thống định danh
đang khởi động" thì chờ khoảng 1 phút cho Keycloak chạy xong.

`make seed` chỉ cần khi muốn nạp lại dữ liệu mẫu bằng tay (idempotent).
`make backup` / `make restore BACKUP=...` sao lưu và khôi phục cơ sở dữ liệu, kho tệp ([core/backup](core/backup/README.md)).
`make help` liệt kê mọi lệnh, gồm các bài kiểm thử RLS của Kênh người dân (`make rls-test`, ...).

Mọi cấu hình nằm trong tệp `.env`; không cần sửa tệp mã nguồn nào.

Sau khi `make up` chạy xong, mở trình duyệt:

| Giao diện               | Địa chỉ               | Chạy bằng        |
| ----------------------- | --------------------- | ---------------- |
| Kênh người dân          | http://localhost:3000 | Docker (tự chạy) |
| Màn hình cán bộ xã      | http://localhost:3002 | Docker (tự chạy) |
| Bảng quản trị hệ thống  | http://localhost:3001 | Docker (tự chạy) |
| Trang quản trị Keycloak | http://localhost:8080 | Docker (tự chạy) |

## Cấu hình

Xem chú thích từng biến trong [.env.example](.env.example).
Với kho lưu trữ tệp, cần đặt `S3_SECRET_KEY` và `FILES_SERVICE_TOKEN` bằng giá trị ngẫu nhiên
(`openssl rand -hex 24`); tương tự với `CITIZEN_KEYCLOAK_SECRET`, bí mật của client `citizen-app`
mà chỉ máy chủ Kênh người dân giữ. Giá trị trong `.env.example` chỉ dùng trên máy phát triển.
Bật quét mã độc: `docker compose --profile antivirus up -d antivirus`
rồi đặt `CLAMAV_HOST=antivirus`.

## Tài khoản thử

Các tài khoản dưới đây là dữ liệu giả lập, chỉ dùng trên máy phát triển.

| Tên đăng nhập  | Mật khẩu     | Xã               | Vai trò   | Dùng ở đâu                              |
| -------------- | ------------ | ---------------- | --------- | --------------------------------------- |
| `canbo.xa-a`   | `12345`      | `xa-a`           | officer   | Màn hình cán bộ xã, API `/rest`         |
| `canbo.xa-b`   | `12345`      | `xa-b`           | officer   | Màn hình cán bộ xã, API `/rest`         |
| `lanhdao.xa-a` | `12345`      | `xa-a`           | leader    | Màn hình cán bộ xã, quản lý cán bộ xã A |
| `lanhdao.xa-b` | `12345`      | `xa-b`           | leader    | Màn hình cán bộ xã, quản lý cán bộ xã B |
| `quantri`      | `12345`      | (để trống)       | sys_admin | Bảng quản trị hệ thống (cổng 3001)      |
| `congdan.demo` | `Demo@2026!` | `xa-a`           | citizen   | Kênh người dân (cổng 3000)              |
| `congdan.khac` | `Demo@2026!` | `xa-b`           | citizen   | Kênh người dân, thử cách ly dữ liệu     |

Cả bảy tài khoản có sẵn trong tệp realm Keycloak, được nạp tự động khi dựng lần đầu; trên máy đã cài
từ trước, dịch vụ `identity-setup` tự bổ sung hai tài khoản công dân. Xã của cán bộ nằm ở thuộc tính
`tenant_id`, của công dân ở `citizen_tenant` (kèm `citizen_id` trùng mã trong `core/db/seed/seed.sql`).

Trang quản trị Keycloak: http://localhost:8080 (tài khoản quản trị lấy từ tệp `.env`).

## Mở rộng

- Thêm thủ tục mới: sao `packs/_template/`, sửa `pack.yaml`, nạp ở bảng quản trị → Danh mục thủ tục → Thêm thủ tục,
  rồi mở cho từng xã (Danh sách xã → bấm vào xã → tab Thủ tục). Thủ tục mới chưa mở cho xã nào.
- Xây ứng dụng mới trên lõi: thêm thư mục trong `apps/`, gọi API qua cửa ngõ.

Hướng dẫn chi tiết trong [docs/](docs/).

## Đóng góp và báo lỗi

- Báo lỗi và đề xuất: [Issues](https://github.com/trangtho/commune-os/issues)
- Hướng dẫn đóng góp: [CONTRIBUTING.md](CONTRIBUTING.md)
- Lịch sử thay đổi: [CHANGELOG.md](CHANGELOG.md)

## Đội phát triển

Danh sách người đóng góp: [Contributors](https://github.com/trangtho/commune-os/graphs/contributors).

## Kênh người dân (`apps/citizen`)

Ứng dụng Nuxt 3 cho người dân: danh mục thủ tục theo xã, nộp hồ sơ nhiều bước có
Poka-yoke, kho giấy tờ cá nhân, tự điền biểu mẫu, theo dõi tiến độ, bổ sung hồ sơ,
đại diện nộp thay, lịch hẹn một cửa, thông báo thời gian thực (PostgreSQL
`LISTEN/NOTIFY` → SSE) và trợ lý hỏi đáp thủ tục.

Hiện trạng cần biết (chi tiết trong [docs/CITIZEN_SETUP.md](docs/CITIZEN_SETUP.md)):

- Đăng nhập công dân qua Keycloak (client bí mật `citizen-app`); đổi mật khẩu qua `/accounts/me/password`.
  Kết nối OIDC bên ngoài là tùy chọn, tắt mặc định.
- Luồng chính gọi các hàm `api.*` của lõi qua cổng `/rest` (khách xem thủ tục qua `/public`); lõi kiểm tra
  lại mọi ràng buộc khi ghi, kể cả đủ giấy tờ bắt buộc. Giấy tờ lưu qua dịch vụ tệp `files` của lõi
  (SeaweedFS, SHA-256, ClamAV tùy chọn).
- Các chức năng phụ còn lại (kho giấy tờ, đại diện, lịch hẹn, lộ trình, trợ lý...) vẫn đọc ghi
  PostgreSQL trực tiếp (vai trò `communeos_app`, RLS theo công dân và xã).
- Trợ lý hỏi đáp dùng AI của lõi: tìm kiếm lai toàn văn + ngữ nghĩa trên thủ tục đã công bố, mô hình chỉ chọn
  câu trích dẫn nguyên văn; câu trả lời luôn có nguồn. AI chưa sẵn sàng thì dùng tìm kiếm toàn văn.
  Nút "Hỏi trợ lý AI" có trên mọi trang, cả ở màn hình cán bộ (thêm hướng dẫn nghiệp vụ). Trợ lý chỉ dùng thủ tục
  xã của người hỏi đang mở, không đọc hồ sơ hay dữ liệu cá nhân, từ chối câu hỏi tra cứu thông tin của người khác.
- Kết quả giải quyết là phiếu mô phỏng, chưa ký số.

Không nhập, tải lên hoặc đưa vào kho mã bất kỳ dữ liệu cá nhân thật nào.
Không đưa bản demo ra Internet khi `DEMO_MODE=true`.

Nếu trang báo "Không tải được thủ tục từ PostgreSQL": `make repair-db`, `make doctor`,
rồi mở `http://localhost:3000/api/health`. Không xóa volume có dữ liệu cần giữ.
Cập nhật thời gian thực: [docs/REALTIME_CITIZEN.md](docs/REALTIME_CITIZEN.md).
