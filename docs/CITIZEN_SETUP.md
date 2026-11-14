<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# Hướng dẫn chạy bản demo Công dân — CommuneOS

## 1. Mô tả phạm vi

Bản này bổ sung **ứng dụng Công dân** (`apps/citizen/`) trực tiếp vào
repository khung đã có; không xóa các thư mục lõi, ứng dụng xã, hay packs.
Giao diện dùng Nuxt 3 + Vue 3 + TypeScript + Tailwind CSS 3 và dựa trên mẫu
UI: header trắng, banner UBND nền xanh, quy trình từng bước, danh mục thủ tục
bên trái, nội dung chính theo thẻ bo góc, khu vực hỗ trợ bên phải.

Nguồn dữ liệu: PostgreSQL 17, `core/db/init/01-schema.sql` và
`core/db/seed/seed.sql`. **Toàn bộ dữ liệu seed là giả lập**. Không lưu số
định danh hoặc ảnh giấy tờ thật trong kho mã hay môi trường demo.

## 2. Chạy trên Ubuntu

Yêu cầu Docker Engine + `docker compose`, `make`, ít nhất 4 GB RAM cho
prototype (chưa có AI/Flowable/APISIX). Lệnh:

```bash
cd commune-os
cp .env.example .env
# Sửa các biến POSTGRES_PASSWORD và POSTGRES_APP_PASSWORD thành hai mật khẩu riêng.
# Sinh bí mật cookie ít nhất 32 ký tự: openssl rand -hex 32
# Gán SESSION_SECRET=<kết quả> vào .env
make up
docker compose ps
curl http://localhost:3000/api/health
```

Mở **http://localhost:3000**. Trang đăng nhập demo:

- Tên đăng nhập: `congdan.demo`
- Mật khẩu: `Demo@2026!`

Cấu hình Docker mặc định chỉ mở cổng trên `127.0.0.1`; dùng cho máy local,
**không public bản demo trực tiếp ra Internet**. Tên tài khoản, mật khẩu và
ảnh giấy tờ seed không có giá trị thật. Nếu thay đổi mật khẩu demo tại giao
diện, lần nạp lại seed **không reset** mật khẩu; chỉ reset volume thử nghiệm
khi đã sao lưu hoặc không còn cần dữ liệu.

Khi chạy, PostgreSQL tạo role `communeos_app` không có quyền superuser.
Nuxt Nitro kết nối bằng role này; mọi truy vấn dữ liệu Công dân chạy trong
transaction có `set_config('app.citizen_id'...)` và `tenant_id` để áp RLS.
Tuy nhiên **RLS ở mẫu này không thay thế hệ thống OIDC của lõi**.

### Sửa lỗi "Không tải được thủ tục từ PostgreSQL" (không mất dữ liệu)

Với phiên bản đã sửa, `docker compose up` sẽ chạy dịch vụ **db-setup** trước ứng dụng
Công dân. Dịch vụ này tạo/cập nhật role `communeos_app`, schema, quyền đọc và dữ liệu
mẫu kể cả khi volume PostgreSQL đã được tạo từ phiên bản trước. **Không cần xóa
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
  < core/db/init/01-schema.sql
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
| `/tro-ly` | Hỏi đáp FAQ theo từ khóa với liên kết nguồn (không phải RAG) |
| `/huong-dan` | Quy trình sử dụng, FAQ cơ bản |
| `/ho-so-ca-nhan` | Xem và sửa profile trong PostgreSQL |
| `/bao-mat` | Đổi mật khẩu mẫu, hash scrypt |
| `/lien-he` | Gửi phản hồi, lưu PostgreSQL |
| `/dang-nhap` | Đăng nhập công dân mô phỏng, cookie HMAC HttpOnly |

Phần UI trên gồm đủ luồng nghiệp vụ tương ứng bộ màn hình Công dân đã thiết kế;
một số bước dùng một trang wizard thay vì nhiều trang HTML lặp lại.

## 4. Các API chính

| API | Phương thức | Công dụng |
| --- | --- | --- |
| `/api/health` | GET | Kiểm tra kết nối database |
| `/api/auth/login` | POST | Đăng nhập demo bằng mật khẩu hash |
| `/api/auth/me` | GET | Tình trạng phiên và vai trò |
| `/api/auth/logout` | POST | Xóa cookie phiên |
| `/api/procedures` | GET | Danh sách thủ tục |
| `/api/procedures/:id` | GET | Chi tiết thủ tục và giấy tờ |
| `/api/applications` | GET/POST | Danh sách, tạo bản nháp |
| `/api/applications/:id` | GET | Hồ sơ đã giới hạn theo tài khoản |
| `/api/applications/:id/documents` | POST multipart | Tải tệp lên máy chủ, lưu metadata PostgreSQL |
| `/api/applications/:id/submit` | POST | Chặn nộp nếu thiếu giấy tờ |
| `/api/applications/:id/complete-supplement` | POST | Xác nhận bổ sung |
| `/api/documents/:id` | GET | Tải tài liệu đã kiểm tra quyền |
| `/api/notifications` | GET | Nhận thông báo |
| `/api/notifications/:id/read` | POST | Đánh dấu đã đọc |
| `/api/notifications/read-all` | POST | Đánh dấu tất cả |
| `/api/profile` | GET/PATCH | Hồ sơ công dân |
| `/api/profile/password` | POST | Đổi mật khẩu |
| `/api/chat` | POST | Tra lời từ bộ FAQ mô phỏng |
| `/api/support`, `/api/feedback` | POST | Gửi trao đổi, góp ý |

Mọi API riêng tư đều đọc **cookie phiên ký trên server**, không tin
`citizen_id` do client gửi. SQL sử dụng query có tham số, và PostgreSQL RLS
lọc theo `app.citizen_id` và `app.tenant_id`. Trong sản phẩm thật cần thay
cơ chế cookie demo bằng Keycloak OIDC với JWT do APISIX xác thực.

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

Bản seed cung cấp **hai công dân giả lập ở hai xã**: `congdan.demo` và
`congdan.khac` (cùng mật khẩu mẫu `Demo@2026!`). Chạy `make rls-test` sau
khi PostgreSQL khởi động để kiểm tra từng role chỉ đọc được hồ sơ của mình.
Có thể đăng nhập bằng công dân thứ hai và kiểm tra trực tiếp hồ sơ xã kia
không xuất hiện trong danh sách. Bài kiểm thử này chạy trên PostgreSQL thật.

`make test` hiện chạy **kiểm tra cấu trúc tĩnh**; không phải kiểm thử
end-to-end, kiểm thử tích hợp PostgreSQL hay kết quả build Docker.

## 6. Giới hạn và yêu cầu trước production

- Chưa triển khai hệ thống Keycloak/OIDC/JWT/APISIX/Flowable, không xác minh
  căn cước hoặc quyền thực hiện thủ tục ngoài cookie demo.
- Chưa quét virus ClamAV, không có OCR CCCD và không có chữ ký số.
- Trợ lý trong bản này là FAQ keyword, **không phải mô hình AI RAG**.
- Các số ngày, lệ phí và danh mục giấy tờ chưa đối chiếu quy định hành chính
  hiện hành, không dùng để ra quyết định thật.
- Tệp tải lên nằm ở Docker volume `citizen-uploads`, không phải S3/object
  storage của lõi đầy đủ. Cần kiểm soát nội dung, anti-virus, quota và bảo vệ
  tệp khi triển khai thực tế.
- Chưa có hệ thống phát hành kết quả được ký điện tử; trang kết quả chỉ in
  phiếu **mô phỏng**.
- Cần khóa exact dependency versions bằng lockfile (cài và commit khi có
  mạng), chạy kiểm thử e2e, audit và thử nghiệm sau triển khai.
- Cơ chế Poka-yoke ở API chỉ kiểm tra có đủ loại tệp bắt buộc, chưa thể
  xác nhận nội dung/chất lượng giấy tờ.
- Dữ liệu công dân demo phải được xóa trước khi chuyển sang môi trường thật.

Tất cả điều trên được xác định là **ngoài phạm vi** prototype hiện tại, không
được coi là đã triển khai.
