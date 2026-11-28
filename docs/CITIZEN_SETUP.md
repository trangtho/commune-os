<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# Hướng dẫn chạy bản demo Công dân — CommuneOS

## 1. Mô tả phạm vi

Tài liệu này hướng dẫn chạy và kiểm tra **ứng dụng Công dân** (`apps/citizen/`).
Giao diện dùng Nuxt 3 + Vue 3 + TypeScript + Tailwind CSS 3 và dựa trên mẫu
UI: header trắng, banner UBND nền xanh, quy trình từng bước, danh mục thủ tục
bên trái, nội dung chính theo thẻ bo góc, khu vực hỗ trợ bên phải.

Nguồn dữ liệu: PostgreSQL 17, `modules/xa/db/01-schema.sql`, danh mục `modules/xa/db/seed.sql` và dữ liệu mẫu
`make demo` (`modules/xa/demo`). **Toàn bộ dữ liệu mẫu là giả lập**. Không lưu số
định danh hoặc ảnh giấy tờ thật trong kho mã hay môi trường demo.

## 2. Chạy trên Ubuntu

Yêu cầu Docker Engine + `docker compose`, `make`, khoảng 6 GB RAM vì `make up`
dựng toàn bộ lõi (Keycloak, APISIX, PostgREST, Flowable, SeaweedFS) cùng ba ứng dụng. Lệnh:

```bash
cd commune-os
cp .env.example .env
# Sửa các biến POSTGRES_PASSWORD và POSTGRES_APP_PASSWORD thành hai mật khẩu riêng.
# Sinh bí mật cookie ít nhất 32 ký tự: openssl rand -hex 32
# Gán SESSION_SECRET=<kết quả> vào .env
# Đặt COMMUNEOS_ADMIN_PASSWORD (tài khoản quản trị hệ thống, tối thiểu 10 ký tự, có chữ và số).
make up
make demo
docker compose ps
curl http://localhost:3000/api/health
```

Mở **http://localhost:3000**. Người dân tự tạo tài khoản ở `/dang-ky`; tài khoản demo do `make demo` tạo:

- Tên đăng nhập: `congdan.demo`
- Mật khẩu: `Demo@2026!`

Cấu hình Docker mặc định chỉ mở cổng trên `127.0.0.1` (`PORTAL_BIND_ADDRESS`); dùng cho máy local,
**không public bản demo trực tiếp ra Internet** (máy chủ thật: HTTPS theo `core/ops/README.md`). Tên tài khoản, mật khẩu và
ảnh giấy tờ seed không có giá trị thật. Nếu thay đổi mật khẩu demo tại giao
diện, lần nạp lại seed **không reset** mật khẩu; chỉ reset volume thử nghiệm
khi đã sao lưu hoặc không còn cần dữ liệu.

Kênh người dân không đọc ghi dữ liệu trực tiếp: mọi thao tác gọi hàm `api.*` của lõi qua cổng APISIX bằng token
công dân; PostgREST chuyển sang vai trò `citizen-app`, `rest_pre_request()` đặt `app.citizen_id`, `app.tenant_id`
từ token để áp RLS. Role `communeos_app` (không superuser) chỉ còn dùng để nhận tín hiệu thay đổi (LISTEN) cho
thông báo thời gian thực và đã bị thu hồi mọi quyền trên bảng, hàm (`modules/xa/db/34-citizen-direct-access.sql`).
Đăng nhập: máy chủ Công dân gửi tên đăng nhập và mật khẩu tới Keycloak (client bí mật `citizen-app`), đọc
hồ sơ công dân qua cổng APISIX (`/rest/my_citizen_profile`), rồi tạo cookie phiên ký HMAC. Token
Keycloak giữ trong cookie HttpOnly mã hóa AES-256-GCM, tự gia hạn; trình duyệt không đọc được.
Mọi chức năng gọi các hàm `api.*` của lõi qua cổng APISIX (`/rest/rpc/...`; khách chưa đăng nhập dùng
`/public/rpc/procedure_catalog`, `procedure_detail` và các hàm `public_*` được liệt kê trong `core/gateway/apisix.yaml`);
xem `modules/xa/db/21-citizen-api-core-flow.sql` và `26-*.sql` đến `34-*.sql`. Danh sách đầy đủ ở trang `/docs/`.

### Sửa lỗi "Không tải được thủ tục từ PostgreSQL" (không mất dữ liệu)

Với phiên bản đã sửa, `docker compose up` sẽ chạy dịch vụ **db-setup** trước ứng dụng
Công dân. Dịch vụ này tạo/cập nhật các role (`citizen-app` cho API, `communeos_app` chỉ để nhận tín hiệu),
schema, các hàm API của lõi và dữ liệu mẫu kể cả khi volume PostgreSQL đã được tạo từ phiên bản trước. **Không cần xóa
volume** để sửa lỗi và tuyệt đối không dùng `docker compose down -v` nếu còn dữ liệu.

```bash
cd commune-os
make up                    # khởi động và tự nạp db-setup
make doctor                # xem PostgreSQL, bảng và role
curl -i http://localhost:3000/api/health
curl -i http://localhost:3000/api/procedures
```

Nếu dịch vụ đang chạy trên volume cũ, yêu cầu nạp lại rõ ràng:

```bash
make repair-db
# Nếu curl lỗi, xem nhật ký setup / web:
docker compose logs --tail=100 db-setup
docker compose logs --tail=100 citizen
docker compose logs --tail=100 db
```

API health bây giờ báo thêm `SCHEMA_MISSING`, `NO_PROCEDURES`,
`DATABASE_AUTH_FAILED`, `DATABASE_PERMISSION_DENIED` hoặc
`DATABASE_UNREACHABLE`, thay vì chỉ kiểm tra `SELECT 1`.

**Lưu ý:** Nếu đã dùng PostgreSQL trước đó, phải giữ đúng mật khẩu quản trị cũ
`POSTGRES_PASSWORD` và tên DB trong `.env`, vì đổi biến môi trường không tự
đổi mật khẩu của database đã khởi tạo. `POSTGRES_APP_PASSWORD` sẽ được đồng
bộ khi `make repair-db` chạy thành công. Sao lưu database trước khi cập nhật
một hệ thống có dữ liệu cần giữ; quy trình này bổ sung dữ liệu demo nên chỉ
nên áp dụng cho môi trường thử nghiệm, không phải production. Seed sửa lỗi
chỉ chèn thủ tục mẫu còn thiếu, không ghi đè thủ tục hiện có cùng mã.

### Volume PostgreSQL đã tồn tại trước đó

Postgres chỉ chạy các tệp `/docker-entrypoint-initdb.d/` khi **volume trống**.
Repo gốc đã có dịch vụ `db`; nếu bạn từng chạy nó, dữ liệu cũ sẽ không tự
có schema mới. Không xóa volume khi còn dữ liệu cần giữ.

Có thể thực hiện migration thủ công bằng tài khoản quản trị trên môi trường
phát triển (sao lưu trước):

```bash
# Vai trò app phải tồn tại trước khi chạy schema:
docker compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  < modules/xa/db/01-schema.sql
make seed
```

Nếu volume cũ chưa có `communeos_app`, chạy trên một volume thử nghiệm
**mới**, hoặc tạo role bằng cùng SQL/shell trong `00-create-app-role.sh`
trước khi áp schema. Không sử dụng `docker compose down -v` để 'sửa lỗi'
trên dữ liệu cần giữ vì lệnh này xóa toàn bộ volume dữ liệu.

## 3. Các màn hình chức năng

| Đường dẫn | Chức năng |
| --- | --- |
| `/` | Trang chủ, thống kê hồ sơ, thủ tục phổ biến, dịch vụ nhanh |
| `/thu-tuc` | Danh mục, tìm kiếm, lọc theo lĩnh vực |
| `/thu-tuc/:slug` | Thông tin thủ tục, danh sách giấy tờ mẫu, hướng dẫn |
| `/nop-ho-so/:slug` | Lưu bản nháp → tải giấy tờ → kiểm tra Poka-yoke → nộp |
| `/nop-thanh-cong/:id` | Thông báo mã hồ sơ vừa ghi nhận |
| `/ho-so` | Danh sách hồ sơ, trạng thái, lọc và tìm kiếm |
| `/ho-so/:id` | Chi tiết, thời gian xử lý, tệp, trao đổi |
| `/tra-cuu` | Tra cứu mã hồ sơ trong tài khoản hiện tại |
| `/ho-so/:id/bo-sung` | Bổ sung giấy tờ khi hồ sơ có trạng thái `supplement` |
| `/ho-so/:id/ket-qua` | Phiếu kết quả mô phỏng (không có giá trị pháp lý) |
| `/thong-bao` | Thông báo từ database, đánh dấu đã đọc |
| `/tro-ly` | Hỏi đáp thủ tục bằng AI của lõi (`core/ai`, mô hình chạy cục bộ): tìm kiếm lai toàn văn + ngữ nghĩa, trích dẫn nguyên văn có nguồn |
| `/huong-dan` | Quy trình sử dụng, FAQ cơ bản |
| `/ho-so-ca-nhan` | Xem và sửa profile trong PostgreSQL |
| `/bao-mat` | Đổi mật khẩu (lưu ở Keycloak, qua `/accounts/me/password` của lõi) |
| `/lien-he` | Gửi phản hồi, lưu PostgreSQL |
| `/dang-nhap` | Đăng nhập công dân qua Keycloak, cookie phiên HttpOnly |

Phần UI trên gồm đủ luồng nghiệp vụ tương ứng bộ màn hình Công dân đã thiết kế;
một số bước dùng một trang wizard thay vì nhiều trang HTML lặp lại.

## 4. Các API chính

| API | Phương thức | Công dụng |
| --- | --- | --- |
| `/api/health` | GET | Kiểm tra kết nối database |
| `/api/auth/login` | POST | Đăng nhập qua Keycloak, đọc hồ sơ qua `/rest` |
| `/api/auth/me` | GET | Tình trạng phiên và vai trò |
| `/api/auth/logout` | POST | Thu hồi phiên Keycloak, xóa cookie |
| `/api/procedures` | GET | Danh sách thủ tục (`api.procedure_catalog`) |
| `/api/procedures/:id` | GET | Chi tiết thủ tục và giấy tờ (`api.procedure_detail`) |
| `/api/applications` | GET/POST | Danh sách, tạo bản nháp (`api.citizen_applications`, `api.citizen_application_create`) |
| `/api/applications/:id` | GET | Hồ sơ đã giới hạn theo tài khoản |
| `/api/applications/:id/documents` | POST multipart | Gửi tệp tới dịch vụ `files` của lõi (kho S3, SHA-256), lưu metadata PostgreSQL |
| `/api/applications/:id/submit` | POST | Nộp hồ sơ; lõi chặn nếu thiếu giấy tờ (`api.citizen_application_submit`) |
| `/api/applications/:id/complete-supplement` | POST | Xác nhận bổ sung |
| `/api/documents/:id` | GET | Tải tài liệu đã kiểm tra quyền |
| `/api/notifications` | GET | Nhận thông báo |
| `/api/notifications/:id/read` | POST | Đánh dấu đã đọc |
| `/api/notifications/read-all` | POST | Đánh dấu tất cả |
| `/api/profile` | GET/PATCH | Hồ sơ công dân |
| `/api/profile/password` | POST | Đổi mật khẩu qua dịch vụ tài khoản của lõi |
| `/api/chat` | POST | Trả lời từ chỉ mục tri thức thủ tục (`citizen_knowledge_chunks`), có trích nguồn |
| `/api/support`, `/api/feedback` | POST | Gửi trao đổi, góp ý |

Mọi API riêng tư đều đọc **cookie phiên ký trên server**, không tin
`citizen_id` do client gửi. SQL sử dụng query có tham số, và PostgreSQL RLS
lọc theo `app.citizen_id` và `app.tenant_id`. Danh sách trên chỉ gồm các API cơ bản;
toàn bộ API nằm trong `apps/citizen/server/api/`.

## 5. Kiểm thử thủ công

1. Mở trang chủ; tìm từ `khai sinh`, chọn thủ tục.
2. Đăng nhập bằng tài khoản demo trước khi vào màn hình nộp.
3. Điền đủ tên người nộp, tên trẻ, ngày sinh → lưu bản nháp.
4. Ở bước giấy tờ, xác nhận không thể qua bước tiếp theo nếu thiếu một
   giấy tờ bắt buộc (Poka-yoke cả ở UI và API).
5. Tải các tệp **giả lập** PDF, JPG hoặc PNG hợp lệ dưới 5 MB.
6. Kiểm tra, xác nhận nộp; nhận mã `HS-<năm>-...` và xem hồ sơ trong
   `Hồ sơ của tôi`.
7. Kiểm tra danh sách, lọc, chi tiết hồ sơ, lịch sử xử lý và tải tài liệu.
8. Mở hồ sơ seed `HS-2026-001235` để thử bổ sung (khi có tệp giả).
9. Đọc thông báo, đánh dấu đã đọc, sửa hồ sơ cá nhân, gửi phản hồi.
10. Đổi mật khẩu demo và đăng nhập lại với mật khẩu mới.

### Kiểm tra RLS thủ công (cần quyền quản trị DB)

`make demo` tạo **hai công dân giả lập ở hai xã**: `congdan.demo` và
`congdan.khac` (cùng mật khẩu mẫu `Demo@2026!`). Chạy `make rls-test` sau
khi PostgreSQL khởi động để kiểm tra từng role chỉ đọc được hồ sơ của mình.
Có thể đăng nhập bằng công dân thứ hai và kiểm tra trực tiếp hồ sơ xã kia
không xuất hiện trong danh sách. Bài kiểm thử này chạy trên PostgreSQL thật.

Các lệnh kiểm thử liên quan:

- `make test-citizen`: kiểm thử đơn vị và cấu trúc của `apps/citizen` (Node 22 trong Docker).
- `make rls-test`, `make chat-history-test`, `make vault-autofill-test`, ...: kiểm thử RLS trên
  PostgreSQL thật, chạy trong transaction rồi `ROLLBACK` (`make help` để xem đủ).
- `make test-sql`: chạy tất cả các bài trên.
- `make test`: 54 kiểm tra của lõi qua gateway (cách ly xã, quy trình, tệp, tài khoản, công dân, AI).
- `make citizen-api-test`: tạo, nộp hồ sơ qua API của lõi, Poka-yoke thiếu giấy tờ, chống sửa hồ sơ đã nộp (ROLLBACK).
- `make e2e-citizen`: kiểm thử giao diện end-to-end bằng Playwright, chạy trong ảnh Playwright chính thức (cần
  `make up`; tự chạy `make demo`). Ảnh chụp, trace khi lỗi nằm ở `apps/citizen/test-results/`.

## 6. Giới hạn và yêu cầu trước production

- Tài khoản công dân do quản trị tạo trong Keycloak, chưa có trang tự đăng ký, chưa xác minh căn cước.
  Kết nối OIDC tới nhà cung cấp định danh được phê duyệt có sẵn nhưng tắt mặc định.
- Thông báo thời gian thực vẫn cần một kết nối PostgreSQL để nhận tín hiệu (LISTEN), bằng vai trò không có quyền
  dữ liệu. Cột `citizens.password_hash` không còn dùng để đăng nhập.
- Kiểm tra từng trường biểu mẫu (`shared/procedure-forms.ts`) chạy ở máy chủ Kênh người dân, chưa nằm
  trong lõi; vì vậy `citizen-app` là client bí mật để công dân không tự xin token gọi thẳng API lõi.
- Quét mã độc ClamAV là tùy chọn (`docker compose --profile antivirus up -d antivirus`,
  `CLAMAV_HOST=antivirus`). Chưa có OCR (biến `CITIZEN_OCR_ENDPOINT` để trống) và chưa có chữ ký số.
- Trợ lý dùng mô hình nhỏ chạy trên CPU của máy chủ (xem `core/ai/README.md`), không gửi dữ liệu ra API AI
  bên ngoài; mỗi câu hỏi mất vài giây đến khoảng 15 giây. Mô hình chỉ chọn trích dẫn, không tự viết nội dung.
- Các số ngày, lệ phí và danh mục giấy tờ chưa đối chiếu quy định hành chính
  hiện hành, không dùng để ra quyết định thật.
- Giấy tờ lưu trong kho đối tượng của lõi qua dịch vụ `files`; tệp cũ trước khi có dịch vụ này
  vẫn nằm ở volume `citizen-uploads`. Cần quota và chính sách lưu giữ khi chạy thật.
- Trang kết quả chỉ in phiếu **mô phỏng**, chưa được ký điện tử.
- Poka-yoke ở API kiểm tra đủ loại tệp bắt buộc và đúng định dạng, chưa xác nhận nội dung giấy tờ.
- Dữ liệu công dân demo phải được xóa trước khi chuyển sang môi trường thật.

Tất cả điều trên **chưa được triển khai**, không được mô tả là đã có.
