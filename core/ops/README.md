<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# core/ops – cài và vận hành trên máy chủ

| Tệp            | Việc                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| `secrets.sh`   | `make secrets`: tạo `.env` (nếu chưa có) và sinh ngẫu nhiên mọi mật khẩu, khóa bí mật còn để giá trị mẫu |
| `check-env.sh` | `make check-env` (chạy trước `make up`): chặn bí mật mẫu khi máy chủ mở cho máy khác, kiểm tra cấu hình HTTPS |
| `Caddyfile`    | Proxy HTTPS (dịch vụ `https`, Caddy), bật bằng `COMPOSE_PROFILES=https`                                  |

## Ba cách chạy

| Cách                    | Ai truy cập                      | Cấu hình trong `.env`                                                    |
| ----------------------- | -------------------------------- | ------------------------------------------------------------------------ |
| Máy phát triển (mặc định) | Chỉ chính máy đó, qua `http://localhost` | Giữ nguyên `COMMUNEOS_DOMAIN=localhost`, `PORTAL_BIND_ADDRESS=127.0.0.1` |
| Mạng nội bộ, http       | Máy cán bộ cùng mạng LAN         | `COMMUNEOS_DOMAIN=<IP máy chủ>`, `PORTAL_BIND_ADDRESS=<IP máy chủ>`, `PORTAL_ALLOW_LOCAL_HTTP=true` |
| HTTPS (khuyên dùng)     | Máy cán bộ, người dân qua Internet | `COMMUNEOS_DOMAIN=<IP hoặc tên miền>`, `COMPOSE_PROFILES=https`, rồi `make secrets` |

Khi máy chủ mở cho máy khác (hai cách sau), `make check-env` dừng lại nếu `.env` còn mật khẩu, khóa bí mật mẫu.
Dữ liệu hồ sơ là dữ liệu cá nhân: chỉ dùng http trong mạng nội bộ tin cậy (`PORTAL_ALLOW_LOCAL_HTTP=true` chỉ nhận
localhost và IP nội bộ RFC1918), đưa ra Internet thì luôn dùng HTTPS.

## Cài mới trên máy chủ (HTTPS)

Cần Docker Engine, Docker Compose, GNU Make, Git; khoảng 8 GB RAM.

```bash
git clone https://github.com/trangtho/commune-os.git
cd commune-os
cp .env.example .env
# Sửa .env: COMMUNEOS_DOMAIN=192.168.1.10 (IP máy chủ) hoặc tên miền, bỏ dấu # ở dòng COMPOSE_PROFILES=https
make secrets     # sinh mọi bí mật; tự đặt KEYCLOAK_PUBLIC_URL, *_PORTAL_PUBLIC_ORIGIN; in mật khẩu quản trị hệ thống
make up          # dựng, khởi động, chờ tới khi mọi dịch vụ sẵn sàng
```

Không chạy `make demo` trên máy chủ thật (tài khoản mẫu dùng chung một mật khẩu công khai).

Sau khi chạy xong, người dùng mở:

| Địa chỉ                    | Dùng cho                                         |
| -------------------------- | ------------------------------------------------ |
| `https://<địa chỉ>`        | Kênh người dân của gói xã (`http://<địa chỉ>` tự chuyển sang) |
| `https://<địa chỉ>:8443`   | Màn hình cán bộ xã (gói xã)                       |
| `https://<địa chỉ>:8444`   | Bảng quản trị hệ thống: tạo đơn vị và lãnh đạo     |
| `https://<địa chỉ>:8445/docs/` | Tài liệu API của lõi                          |
| `https://<địa chỉ>:8446`   | Keycloak (trang quản trị định danh)               |

Tường lửa của máy chủ cần mở các cổng 80, 443, 8443–8446. Giữ `PORTAL_BIND_ADDRESS=127.0.0.1` để các cổng http
(3000–3002, 8080, 9080) chỉ dùng được trên chính máy chủ.

### Chứng chỉ

- **Tên miền công khai** trỏ về máy chủ, cổng 80 và 443 mở ra Internet: Caddy tự xin chứng chỉ Let's Encrypt và tự
  gia hạn; trình duyệt không cảnh báo.
- **Địa chỉ IP hoặc tên nội bộ** (mạng LAN): Caddy tự cấp chứng chỉ bằng CA nội bộ. Trình duyệt cảnh báo tới khi
  máy cán bộ tin CA này. Lấy chứng chỉ gốc: `make https-ca` (tạo tệp `communeos-https-ca.crt`), rồi trên mỗi máy:
  - Windows: bấm đúp tệp → Install Certificate → Local Machine → "Trusted Root Certification Authorities".
  - Ubuntu: `sudo cp communeos-https-ca.crt /usr/local/share/ca-certificates/ && sudo update-ca-certificates`.
  - Firefox dùng kho chứng chỉ riêng: Settings → Privacy & Security → Certificates → View Certificates → Import.

Chứng chỉ và CA nằm trong volume `https-data`; sao lưu volume này để không phải cài lại CA trên các máy cán bộ.

## Bí mật trong `.env`

`make secrets` chỉ thay giá trị còn là mẫu (`doi-mat-khau-nay`, `THAY_BANG...`), trống hoặc quá ngắn; giá trị đã đặt
đúng được giữ nguyên, và tệp `.env` cũ được sao ra `.env.bak-<thời điểm>`.

| Loại                    | Biến                                                                                         | Đổi sau khi đã cài |
| ----------------------- | -------------------------------------------------------------------------------------------- | ------------------ |
| Áp lại mỗi lần `make up` | `POSTGRES_APP_PASSWORD`, `POSTGRES_REST_PASSWORD`, `WORKFLOW_TOKEN`, `FILES_SERVICE_TOKEN`, `KEYCLOAK_ACCOUNTS_SECRET`, `CITIZEN_KEYCLOAK_SECRET`, `SESSION_SECRET`, `COMMUNEOS_ADMIN_PASSWORD` | Sửa `.env` (hoặc `make secrets`), rồi `make up` |
| Chỉ dùng lúc khởi tạo    | `POSTGRES_PASSWORD`, `KEYCLOAK_ADMIN_PASSWORD`, `FLOWABLE_ADMIN_PASSWORD`, `S3_SECRET_KEY`   | Xem dưới đây       |

Đổi `SESSION_SECRET` làm mọi người phải đăng nhập lại. Bí mật chỉ dùng lúc khởi tạo đã ghi vào dữ liệu, nên
`make secrets` không tự đổi trên máy đã cài; đổi bằng tay (sao lưu trước: `make backup`):

- `POSTGRES_PASSWORD`: mở `docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d postgres'`, gõ `\password`
  và nhập mật khẩu mới hai lần, `\q` để thoát; sửa `POSTGRES_PASSWORD` trong `.env` cho khớp, rồi `make up`.
- `KEYCLOAK_ADMIN_PASSWORD`: đổi ở trang quản trị Keycloak (realm master → Users → admin → Credentials), rồi sửa `.env`.
- `FLOWABLE_ADMIN_PASSWORD`, `S3_SECRET_KEY`: cài mới thì để `make secrets` sinh; máy đang chạy với giá trị mẫu nên cài
  lại trên máy mới rồi khôi phục bản sao lưu (`make restore`).

## Cập nhật phiên bản

```bash
make backup      # sao lưu cơ sở dữ liệu và kho tệp
git pull
make up          # check-env báo nếu .env thiếu biến mới; migration chạy lại được; chờ dịch vụ sẵn sàng
```
