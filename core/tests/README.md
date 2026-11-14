<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Kiểm thử lõi — Issues #3, #6, #11, #5, #23

`make test` yêu cầu Docker Compose đang chạy và đã nạp tài khoản thử bằng `make seed`. Gồm ba lớp:

1. `test_config_contracts.py`: kiểm tra tĩnh (Python stdlib) các route APISIX JWT,
   quyền PostgREST, endpoint và tất cả bảng có `tenant_id`.
2. `tenant-isolation.sh` → `api-integration.py`: gọi **thực** Keycloak → APISIX →
   PostgREST. Kiểm HTTP status và JSON, không thể nhầm một phản hồi lỗi 404/500
   với dữ liệu danh sách hợp lệ. Bao gồm: không token 401 trên cả `/api/*` và
   `/rest/*`, có JWT hợp lệ, token hỏng 401, hai xã không thấy hồ sơ của nhau,
   `supervisor` và `sys_admin` bị từ chối hồ sơ 403, endpoint giấy tờ, quyền quản trị.
3. `core/db/tests/api-rls.sql`: test RLS trong PostgreSQL (BEGIN/ROLLBACK), tự phát
   hiện tất cả bảng có `tenant_id` chưa bật/ép RLS; mô phỏng claim được PostgREST
   gửi xuống, chuyển vai thật `commune-app`, truy vấn qua view **và bảng gốc**.

## Chạy trên máy phát triển

```bash
cp .env.example .env   # lần đầu; thay các mật khẩu và SESSION_SECRET
make up
make seed
make test
```

`make seed` tạo 2 người dùng demo `supervisor.xa-a`, `quantri` nếu chưa tồn tại,
đồng thời giữ hai tài khoản `canbo.xa-a` / `canbo.xa-b` từ realm mẫu. Mật khẩu demo
mặc định `12345` hoặc giá trị `DEMO_PASSWORD` (nếu đặt lúc chạy seed). Không tự
đổi mật khẩu của người dùng đã tồn tại trong Keycloak. Nếu thông tin đăng nhập
khác nhau giữa test và seed, `make test` sẽ thất bại.

Để xác nhận **riêng** đường xử lý token đã hết hạn nhưng vẫn giữ chữ ký Keycloak,
cung cấp token đã hết hạn thật:

```bash
EXPIRED_TEST_TOKEN='eyJ...expired.signature...' make test
```

Không sử dụng token tự sửa `exp` rồi xem đó là bằng chứng độc lập về TTL: thay
payload cũng làm chữ ký sai. Nếu chưa đặt `EXPIRED_TEST_TOKEN`, tình huống hết
hạn được ghi rõ là *chưa kiểm thử tích hợp*, không báo là PASS.

Lệnh kiểm tra tĩnh độc lập (không cần Docker, không cần `.env`):

```bash
python3 -m unittest discover -s core/tests -p 'test_*.py' -v
```

## Xử lý lỗi

- `404` trên `/rest/dossiers` hoặc `/api/health` thường là route APISIX chưa được
  nạp: chạy `docker compose up -d --force-recreate --no-deps gateway`, kiểm tra
  `core/gateway/apisix.yaml`, dòng cuối `#END`, và `docker compose logs gateway`.
- Đăng nhập demo thất bại: xem lỗi `invalid_grant` trong test. Keycloak 26
  có thể yêu cầu các trường profile; `make seed` sẽ điền trường còn thiếu cho
  hai tài khoản demo, nhưng không đổi mật khẩu người dùng đã tồn tại.
- `401` với token hợp lệ: kiểm tra JWKS, issuer và thời gian máy chủ.
- `403` cho tài khoản cán bộ khi xem hồ sơ: kiểm tra claim `tenant_id`, realm
  role `receptionist`/`officer`/`leader`, mã xã trong bảng `tenants`, và
  `docker compose logs rest`.
- `500` từ REST: kiểm tra việc cập nhật schema trên volume cũ bằng `make repair-db`.
- `docker compose config --quiet` để kiểm tra cú pháp/biến môi trường Compose.

`make test` là kiểm thử tích hợp, không thay thế kiểm tra quyền trong giao diện.
