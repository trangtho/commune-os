<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# CommuneOS

**DX-OS Open-Core cho mọi tổ chức nhiều đơn vị, kèm ứng dụng minh họa: một cửa cấp xã.**

CommuneOS là lõi mở headless, đa đơn vị (multi-tenant), chạy ngầm phía sau các ứng dụng: định danh, cổng API,
dữ liệu cách ly theo đơn vị, quy trình BPMN, lưu trữ tệp, sổ ghi nhận và AI chạy ngay trên máy chủ của tổ chức,
không phụ thuộc nhà cung cấp. Trên lõi này:

- **Gói nghiệp vụ xã (ứng dụng minh họa chính)** ([modules/xa](modules/xa/README.md)): một cửa cấp xã, gồm Kênh
  người dân, màn hình cán bộ, bảng quản trị. Mỗi xã là một đơn vị.
- **Gói doanh nghiệp** ([modules/doanh-nghiep](modules/doanh-nghiep/README.md)): "Công ty A" duyệt đơn nghỉ phép trên
  cùng lõi, chỉ thêm một thư mục gói nghiệp vụ.

Lõi cài và chạy được khi không có gói xã (CI kiểm tra mỗi lần đưa mã lên); gói nào được nạp do biến
`COMMUNEOS_MODULES` quyết định.

| Trụ cột | Lõi cung cấp |
| --- | --- |
| **H** (Con người) | Đăng nhập một lần, tài khoản theo đơn vị và vai trò; hồ sơ cán bộ, giao việc |
| **P** (Quy trình) | Động cơ BPMN cho mọi loại đối tượng (thủ tục hành chính, đơn nghỉ phép...) |
| **D** (Dữ liệu) | API dữ liệu cách ly đơn vị bằng RLS, kho tệp, sổ ghi nhận không sửa được, báo cáo điều hành |
| **I** (Trí tuệ) | Trợ lý AI dùng RAG trên tri thức nội bộ, mô hình chạy cục bộ |

Ranh giới giữa lõi dùng chung và gói nghiệp vụ xã, cách thêm nghiệp vụ mới: [docs/LOI_DUNG_CHUNG.md](docs/LOI_DUNG_CHUNG.md).

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
| Tầng 1 - Lõi headless | `core/`         | Cửa ngõ API, định danh, dữ liệu, lưu trữ tệp, quy trình, sổ ghi nhận, AI (không giao diện) |
| Tầng 2 - Ứng dụng     | `apps/commune/` | Ứng dụng xã cho cán bộ, lãnh đạo, cấp trên                                        |
| Tầng 2 - Ứng dụng     | `apps/citizen/` | Kênh nộp hồ sơ trực tuyến cho người dân                                           |
| Tầng 2 - Ứng dụng     | `apps/admin/`   | Bảng quản trị hệ thống: xã, thủ tục, sổ ghi nhận                                  |
| Gói nghiệp vụ         | `modules/xa/`   | Gói xã: dữ liệu công dân, thủ tục, hồ sơ; quy trình hồ sơ; dữ liệu mẫu; gói thủ tục (`packs/`) |
| Gói nghiệp vụ         | `modules/doanh-nghiep/` | Gói doanh nghiệp: duyệt đơn nghỉ phép                                     |

Ba ứng dụng trong `apps/` dùng gói xã. Mỗi gói khai báo trong `module.json` tệp SQL, quy trình BPMN, việc định kỳ;
lõi nạp các gói trong `COMMUNEOS_MODULES` (tệp mẫu `.env.example`: `xa,doanh-nghiep`; để rỗng thì chỉ có lõi). Ranh giới lõi và gói:
[docs/LOI_DUNG_CHUNG.md](docs/LOI_DUNG_CHUNG.md#ranh-giới-trong-mã-nguồn).

Lõi hoàn toàn không có giao diện: chỉ có dịch vụ và API. Bảng quản trị (`apps/admin`) và
màn hình cán bộ (`apps/commune`) gọi lõi qua cửa ngõ API.
Kênh người dân (`apps/citizen`) đăng nhập qua Keycloak và gọi lõi qua cửa ngõ cho mọi thao tác dữ liệu (hàm `api.*`
của gói xã, `modules/xa/db/21-*.sql`, `26-*.sql` đến `34-*.sql`); không còn đọc ghi PostgreSQL trực tiếp. Kết nối duy nhất còn lại tới
PostgreSQL chỉ để nhận tín hiệu thay đổi cho thông báo thời gian thực, bằng vai trò đã bị thu hồi mọi quyền dữ liệu.
Mỗi xã tự có danh sách thủ tục được mở. Cán bộ và người dân chỉ thấy, chỉ nộp được thủ tục xã mình đang mở; cơ sở dữ liệu tự chặn nếu ai đó vượt qua giao diện. Quản trị hệ thống cấu hình xã và thủ tục nhưng không đọc được nội dung hồ sơ.

### Dịch vụ của lõi

| Dịch vụ (docker compose)          | Thành phần            | Vai trò                                                                                      |
| --------------------------------- | --------------------- | -------------------------------------------------------------------------------------------- |
| `identity`, `identity-setup`      | Keycloak              | Đăng nhập một lần cho cán bộ và công dân; `identity-setup` bổ sung mục mới vào realm đã có  |
| `gateway`                         | Apache APISIX         | Cửa ngõ API: `/rest`, `/workflow`, `/files`, `/accounts`, `/ai` (kiểm tra token), `/public` (khách), `/docs` (tài liệu API) |
| `db`, `rest`                      | PostgreSQL, PostgREST | Dữ liệu có cấu trúc, API tự sinh, cách ly xã bằng RLS                                        |
| `workflow-engine`, `orchestrator` | Flowable, Node.js     | Quy trình theo sơ đồ BPMN cho mọi gói nghiệp vụ (hồ sơ thủ tục, đơn nghỉ phép...)            |
| `storage`                         | SeaweedFS             | Kho đối tượng chuẩn S3 cho giấy tờ (dữ liệu phi cấu trúc)                                    |
| `files`                           | Node.js               | Dịch vụ tệp: kiểm tra, lưu, mã băm SHA-256 ([core/files](core/files/README.md))              |
| `antivirus` (tùy chọn)            | ClamAV                | Quét mã độc tệp tải lên                                                                      |
| `accounts`                        | Node.js               | Lãnh đạo xã quản lý tài khoản cán bộ qua Keycloak ([core/accounts](core/accounts/README.md)) |
| `ai`, `ai-gateway`, `ai-models`   | Ollama, Node.js       | AI chạy cục bộ: tìm kiếm ngữ nghĩa, chọn trích dẫn ([core/ai](core/ai/README.md))            |
| `api-docs`                        | Swagger UI            | Trang tài liệu API của lõi, gọi thử được ([core/api-docs](core/api-docs/README.md))          |

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
make secrets              # tạo .env từ .env.example, sinh ngẫu nhiên mọi mật khẩu; in mật khẩu quản trị hệ thống
make up                   # dựng, khởi động toàn bộ dịch vụ, nạp schema và danh mục thủ tục; chờ tới khi mọi dịch vụ sẵn sàng
make demo                 # (tùy chọn) 2 xã mẫu, lãnh đạo, cán bộ, công dân, hồ sơ mẫu, tạo qua API của lõi
make test                 # chạy make demo rồi 54 kiểm tra qua gateway: cách ly xã, quy trình, tệp, tài khoản, công dân, AI (xem core/tests)
make test-citizen         # kiểm thử đơn vị Kênh người dân
make test-sql             # mọi bài kiểm thử RLS, phân quyền bằng SQL (ROLLBACK)
make e2e-citizen          # kiểm thử giao diện Kênh người dân bằng Playwright (chạy trong Docker, không cần cài trình duyệt)
make test-platform        # lõi dùng chung: đơn vị, gói đã cài, sổ ghi nhận, quy trình (chạy được khi không có gói xã)
make example-enterprise   # gói doanh nghiệp trên cùng lõi: Công ty A duyệt đơn nghỉ phép qua cổng API
```

Sau mỗi lần `git pull`, chạy lại `make up`: lệnh này dừng ngay nếu `.env` thiếu biến bắt buộc mới thêm
(`make check-env` báo tên biến, chép dòng tương ứng từ `.env.example`), và khởi động lại các dịch vụ lõi chạy thẳng
mã nguồn (`gateway`, `orchestrator`, `accounts`, `files`, `ai-gateway`) để không còn chạy mã cũ. Máy đã có PostgreSQL
dùng cổng 5432 thì đổi `POSTGRES_PORT` trong `.env`. Vừa khởi động lại máy mà đăng nhập báo "Hệ thống định danh
đang khởi động" thì chờ khoảng 1 phút cho Keycloak chạy xong.

`make seed` chỉ cần khi muốn nạp lại danh mục thủ tục mẫu bằng tay (idempotent).
`make backup` / `make restore BACKUP=...` sao lưu và khôi phục cơ sở dữ liệu, kho tệp ([core/backup](core/backup/README.md)).
`make help` liệt kê mọi lệnh, gồm từng bài kiểm thử RLS của Kênh người dân (`make rls-test`, ...).
`make ready` chờ mọi dịch vụ sẵn sàng (healthcheck đạt) và báo dịch vụ nào lỗi; `make up` tự chạy bước này ở cuối.
CI dựng lại toàn bộ từ mã nguồn (trừ mô hình AI) và chạy đủ các lệnh kiểm thử trên ở mỗi pull request.

Mọi cấu hình nằm trong tệp `.env`; không cần sửa tệp mã nguồn nào. Cài trên máy chủ cho máy khác truy cập (mạng nội
bộ hoặc HTTPS, chứng chỉ, đổi bí mật, cập nhật phiên bản): [core/ops](core/ops/README.md).

Sau khi `make up` chạy xong, mở trình duyệt:

| Giao diện               | Địa chỉ               | Chạy bằng        |
| ----------------------- | --------------------- | ---------------- |
| Kênh người dân          | http://localhost:3000 | Docker (tự chạy) |
| Màn hình cán bộ xã      | http://localhost:3002 | Docker (tự chạy) |
| Bảng quản trị hệ thống  | http://localhost:3001 | Docker (tự chạy) |
| Trang quản trị Keycloak | http://localhost:8080 | Docker (tự chạy) |
| Tài liệu API của lõi    | http://localhost:9080/docs/ | Docker (tự chạy) |

## Cấu hình

Xem chú thích từng biến trong [.env.example](.env.example). `make secrets` thay mọi mật khẩu, khóa bí mật mẫu
(`S3_SECRET_KEY`, `FILES_SERVICE_TOKEN`, `CITIZEN_KEYCLOAK_SECRET`...) bằng giá trị ngẫu nhiên; khi máy chủ mở cho máy
khác, `make check-env` (chạy trước `make up`) từ chối giá trị mẫu. Keycloak chạy ở chế độ chạy thật (`start`).
Giá trị trong `.env.example` chỉ dùng trên máy phát triển.
Bật quét mã độc: `docker compose --profile antivirus up -d antivirus`
rồi đặt `CLAMAV_HOST=antivirus`.

### Cookie đăng nhập, demo LAN và reverse proxy HTTPS

Mặc định cookie đăng nhập có `Secure`, `HttpOnly`; các cổng http (ba portal, cổng API, Keycloak) chỉ bind `127.0.0.1`.
Để demo trên máy cá nhân bằng HTTP, đặt `PORTAL_ALLOW_LOCAL_HTTP=true` trong `.env`.
Nếu giám khảo truy cập từ máy khác trong cùng LAN, ví dụ máy chủ có IP `192.168.1.20`:

```dotenv
PORTAL_ALLOW_LOCAL_HTTP=true
PORTAL_BIND_ADDRESS=192.168.1.20
```

Đổi IP ví dụ thành IP LAN thực tế của máy chạy Docker. Chỉ cho phép HTTP với dữ liệu mẫu,
trên mạng tin cậy; giới hạn firewall tới máy/mạng giám khảo. Không mở HTTP ra Internet.
Cookie chỉ được nới cho localhost, IPv4 loopback, IPv6 loopback và IP IPv4 riêng RFC1918
(`10/8`, `172.16/12`, `192.168/16`); không áp dụng cho tên miền hoặc IP công cộng.
Mở `http://192.168.1.20:3000` (người dân), `:3001` (quản trị), `:3002` (cán bộ).
Các biến `*_PORTAL_PUBLIC_ORIGIN` có thể để trống khi truy cập trực tiếp. Không đổi
`KEYCLOAK_PUBLIC_URL` chỉ để sửa cookie; cấu hình issuer, OIDC và các URL công khai của lõi
riêng nếu triển khai các dịch vụ đó từ xa. `CITIZEN_PUBLIC_ORIGIN` vẫn dành riêng cho QR kết quả.

CommuneOS có sẵn proxy HTTPS (Caddy): đặt `COMMUNEOS_DOMAIN`, bỏ dấu # ở dòng `COMPOSE_PROFILES=https` trong `.env`,
chạy `make secrets` (tự đặt các origin dưới đây theo cổng của proxy) rồi `make up`; xem [core/ops](core/ops/README.md).
Khi dùng nginx hoặc reverse proxy HTTPS khác, giữ `PORTAL_ALLOW_LOCAL_HTTP=false`,
`PORTAL_BIND_ADDRESS=127.0.0.1` nếu proxy chạy trên cùng máy chủ, và cấu hình từng origin:

```dotenv
CITIZEN_PORTAL_PUBLIC_ORIGIN=https://congdan.example.org
COMMUNE_PORTAL_PUBLIC_ORIGIN=https://canbo.example.org
ADMIN_PORTAL_PUBLIC_ORIGIN=https://quantri.example.org
```

Thay tên miền ví dụ bằng tên miền thật; mỗi origin chỉ gồm scheme, host và port (nếu không mặc định).
Proxy cần giữ `Host` công khai, chuyển tiếp tới cổng portal tương ứng và ghi đè các header chuyển tiếp
(`X-Forwarded-Host`, `X-Forwarded-Proto`) thay vì nhận từ client. Portal sử dụng origin cấu hình để kiểm tra
`Origin` và chính sách cookie, không tin các header chuyển tiếp đó để quyết định quyền ghi.
Không cho truy cập trực tiếp backend từ Internet; chuyển HTTP công khai sang HTTPS tại proxy.
Nếu proxy chạy trong Docker, dùng mạng Docker riêng với backend thay vì mở backend công khai.
Không dùng chung origin cho nhiều portal. Khi đã cấu hình origin HTTPS, truy cập từ origin khác
(kể cả localhost) sẽ không được phép ghi; dùng đúng URL công khai.

Áp dụng cấu hình bằng `docker compose up -d --build --no-deps citizen commune admin` và đăng nhập lại.
Kiểm tra reload, logout và thao tác ghi trên từng origin; yêu cầu từ origin khác vẫn phải bị từ chối (403).

## Tài khoản thử

Cài mới không có tài khoản người dùng nào ngoài **quản trị hệ thống**, do người cài đặt trong `.env`
(`COMMUNEOS_ADMIN_USERNAME`, `COMMUNEOS_ADMIN_PASSWORD`; `make check-env` từ chối mật khẩu trống, mật khẩu mẫu hoặc
dưới 10 ký tự). `identity-setup` tạo tài khoản này mỗi lần `make up` và đồng bộ lại mật khẩu từ `.env`.
Tệp realm Keycloak chỉ còn tài khoản dịch vụ; mật khẩu người dùng tối thiểu 8 ký tự, có chữ và số.

Các tài khoản khác được tạo theo vai trò:

- Quản trị hệ thống tạo xã kèm tài khoản lãnh đạo xã (bảng quản trị → Danh sách xã → Thêm xã); mật khẩu tạm hiện
  một lần. Tab "Tài khoản quản lý" của từng xã cấp lại mật khẩu tạm, khóa / mở, thêm lãnh đạo.
- Lãnh đạo xã tạo cán bộ xử lý (màn hình cán bộ xã → Nhân viên). Lãnh đạo, cán bộ mới phải đổi mật khẩu tạm khi
  đăng nhập lần đầu.
- Người dân tự đăng ký ở Kênh người dân (`/dang-ky`): chọn xã cư trú đang hoạt động và đồng ý xử lý dữ liệu cá nhân
  theo Nghị định 13/2023/NĐ-CP.

`make demo` tạo dữ liệu trình diễn bằng đúng các bước trên (chạy lại được), mật khẩu chung `DEMO_PASSWORD`
(mặc định `Demo@2026!`). Đây là dữ liệu giả lập, chỉ dùng trên máy phát triển:

| Tên đăng nhập  | Xã     | Vai trò   | Dùng ở đâu                              |
| -------------- | ------ | --------- | --------------------------------------- |
| `canbo.xa-a`   | `xa-a` | officer   | Màn hình cán bộ xã, API `/rest`         |
| `canbo.xa-b`   | `xa-b` | officer   | Màn hình cán bộ xã, API `/rest`         |
| `lanhdao.xa-a` | `xa-a` | leader    | Màn hình cán bộ xã, quản lý cán bộ xã A |
| `lanhdao.xa-b` | `xa-b` | leader    | Màn hình cán bộ xã, quản lý cán bộ xã B |
| `congdan.demo` | `xa-a` | citizen   | Kênh người dân (cổng 3000)              |
| `congdan.khac` | `xa-b` | citizen   | Kênh người dân, thử cách ly dữ liệu     |

Xã của cán bộ nằm ở thuộc tính `tenant_id`, của công dân ở `citizen_tenant` (kèm `citizen_id` trùng mã hồ sơ công dân
trong cơ sở dữ liệu). Bản cài cũ còn tài khoản mẫu mật khẩu `12345`: `make demo` đặt lại về `DEMO_PASSWORD`.

Trang quản trị Keycloak: http://localhost:8080 (tài khoản quản trị lấy từ tệp `.env`).

## Mở rộng

- Thêm thủ tục mới: sao `modules/xa/packs/_template/`, sửa `pack.yaml`, nạp ở bảng quản trị → Danh mục thủ tục → Thêm thủ tục,
  rồi mở cho từng xã (Danh sách xã → bấm vào xã → tab Thủ tục). Thủ tục mới chưa mở cho xã nào.
- Thêm nghiệp vụ mới (gói nghiệp vụ): thư mục `modules/<tên>/` gồm SQL cách ly theo đơn vị, sơ đồ BPMN, `module.json`;
  thêm tên gói vào `COMMUNEOS_MODULES`. Làm theo mẫu [modules/doanh-nghiep](modules/doanh-nghiep/README.md) và hướng dẫn trong
  [docs/LOI_DUNG_CHUNG.md](docs/LOI_DUNG_CHUNG.md#thêm-nghiệp-vụ-mới).
- Xây ứng dụng mới trên lõi: thêm thư mục trong `apps/`, gọi API qua cửa ngõ. Danh sách API, tham số, phản hồi mẫu
  và nút gọi thử nằm ở trang tài liệu http://localhost:9080/docs/ (cổng theo `GATEWAY_PORT`).

Hướng dẫn chi tiết trong [docs/](docs/).

## Kênh người dân (`apps/citizen`)

Ứng dụng Nuxt 3 cho người dân: danh mục thủ tục theo xã, nộp hồ sơ nhiều bước có
kiểm tra chống sai sót (Poka-yoke), kho giấy tờ cá nhân, tự điền biểu mẫu, theo dõi tiến độ, bổ sung hồ sơ,
đại diện nộp thay, lịch hẹn một cửa, thông báo thời gian thực (PostgreSQL
`LISTEN/NOTIFY` → SSE) và trợ lý hỏi đáp thủ tục.

Hiện trạng cần biết (chi tiết trong [docs/CITIZEN_SETUP.md](docs/CITIZEN_SETUP.md)):

- Đăng nhập công dân qua Keycloak (client bí mật `citizen-app`); đổi mật khẩu qua `/accounts/me/password`.
  Kết nối OIDC bên ngoài là tùy chọn, tắt mặc định.
- Mọi chức năng (thủ tục, hồ sơ, kho giấy tờ, đại diện, lịch hẹn, lộ trình, hỗ trợ, trợ lý...) gọi các hàm `api.*`
  của lõi qua cổng `/rest` bằng token công dân (khách dùng các hàm `public_*` qua `/public`); lõi kiểm tra lại mọi
  ràng buộc khi ghi, RLS theo công dân và xã. Giấy tờ lưu qua dịch vụ tệp `files` của lõi (SeaweedFS, SHA-256,
  ClamAV tùy chọn). Phần việc của cán bộ (trả lời hỗ trợ, mã chuyển hồ sơ tại quầy, dữ liệu cá nhân...) là API của
  lõi cho cán bộ; việc định kỳ (nhắc việc, rà soát lưu trữ) do dịch vụ điều phối của lõi chạy.
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

## Đóng góp và báo lỗi

- Báo lỗi và đề xuất: [Issues](https://github.com/trangtho/commune-os/issues)
- Hướng dẫn đóng góp: [CONTRIBUTING.md](CONTRIBUTING.md)
- Lịch sử thay đổi: [CHANGELOG.md](CHANGELOG.md)

## Đội phát triển

Danh sách người đóng góp: [Contributors](https://github.com/trangtho/commune-os/graphs/contributors).
