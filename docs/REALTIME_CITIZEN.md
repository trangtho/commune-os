# Tự cập nhật dữ liệu kênh Công dân (PostgreSQL → Nuxt)

Khi thủ tục, hồ sơ, giấy tờ, tiến trình hoặc thông báo thay đổi, PostgreSQL phát `NOTIFY communeos_citizen_changes` qua trigger. Nitro dùng một kết nối `LISTEN` dùng chung để gửi **SSE** đến các trình duyệt đang mở. Vue gọi `refreshNuxtData` theo khóa và cập nhật UI **không tải lại cả trang**, không làm cuộn nội dung về đầu.

- Thay đổi `procedures` và `procedure_documents`: cập nhật danh mục/thông tin thủ tục đang mở (công khai).
- Thay đổi `applications`, `application_events`, `application_documents`: cập nhật danh sách và chi tiết hồ sơ chỉ cho đúng công dân/xã.
- Thay đổi `citizen_notifications`: cập nhật trang thông báo đúng chủ sở hữu.
- Thay đổi `citizens`: cập nhật hồ sơ cá nhân; không ghi đè trường người dùng đang chỉnh chưa lưu.
- Không gửi dữ liệu cá nhân qua SSE. API bảo vệ hồ sơ vẫn áp dụng session và PostgreSQL RLS.
- Khi mất kết nối SSE, ứng dụng kiểm tra lại khoảng 15 giây/lần. Khi quay lại tab, dữ liệu cũng được làm mới.

## Cập nhật PostgreSQL cũ, không xóa dữ liệu

```bash
make repair-db
# hoặc để cập nhật bảng/trigger mà không build lại toàn bộ:
# docker compose run --rm db-setup
# docker compose up -d --build --no-deps citizen
```

## Kiểm tra trực tiếp

Mở hai tab trong trình duyệt (đăng nhập tài khoản `congdan.demo`), thử thao tác gửi hồ sơ hoặc đánh dấu thông báo đã đọc ở tab A. Tab B sẽ tự cập nhật, không F5.

Thử thay đổi thủ tục (chỉ áp dụng trên CSDL mô phỏng):

```bash
docker compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'SQL'
UPDATE procedures SET summary = summary || ' (cập nhật thử)' WHERE id='khai-sinh';
SQL
```

Nếu trang danh mục/chi tiết thủ tục đang mở, nội dung sẽ tự cập nhật. Có thể hoàn tác phần thử bằng SQL tương ứng sau khi kiểm tra.

Kiểm tra SSE đã kết nối (có tín hiệu `status` và `heartbeat`):

```bash
curl -N http://localhost:3000/api/live
```

Kiểm tra trigger (7 bảng):

```bash
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'SQL'
SELECT tgrelid::regclass FROM pg_trigger
WHERE tgname = 'communeos_realtime_changed' ORDER BY 1;
SQL
```

**Giới hạn:** Bản demo chưa thực hiện tự đồng bộ tài liệu chưa tải xong hoặc thao tác form đang nhập dở; các thay đổi được áp dụng vào dữ liệu đã lưu. Khi các dịch vụ sau này cập nhật PostgreSQL, chỉ cần cập nhật các bảng trên theo giao dịch thông thường để phát tín hiệu.
