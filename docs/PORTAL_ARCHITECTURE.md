<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
# Hợp đồng kiến trúc ba kênh

- Ba ứng dụng Nuxt độc lập gọi lõi qua APISIX. RPC/PostgREST và RLS kiểm tra quyền theo xã; Flowable điều phối thay đổi trạng thái hồ sơ. Kênh cán bộ không có credential PostgreSQL; ngoại lệ LISTEN của kênh công dân giữ nguyên.
- Cán bộ và quản trị dùng cookie HttpOnly, SameSite=Lax, mã hóa AES-GCM, khóa riêng theo kênh, refresh Keycloak. Công dân giữ luồng OIDC và cookie hiện tại. Sau nâng cấp, đăng nhập lại kênh cán bộ/quản trị; xóa token quản trị cũ trong sessionStorage. Các API quản trị đi qua BFF `/api/core/*`, không trả bearer token cho trình duyệt. Triển khai thực tế cần HTTPS và cấu hình reverse proxy đúng nguồn.
- `/api/health` trả `ok`, `service`, `core`; HTTP 503 nếu lõi không sẵn sàng. Công dân vẫn yêu cầu có danh mục đã công bố. Healthcheck không thay thế kiểm thử các dịch vụ khác.
- Docker dùng `npm ci` theo lockfile. Giữ phiên bản Nuxt 3 (công dân/cán bộ) và Nuxt 4 (quản trị) để tránh nâng cấp phá tương thích. Đã bỏ dependency pg và @types/pg của kênh cán bộ.
- `packages/auth` và `packages/ui` là nguồn chuẩn; bản sao trong mỗi app cho phép giữ Docker build context độc lập. Khi sửa nguồn chuẩn, chạy `node packages/sync-shared.mjs`; `make test-architecture` phát hiện lệch. Giữ màu riêng, layout riêng và CSS responsive hiện có. Chưa thay thế toàn bộ component bằng thư viện UI chung.
- Cập nhật DB bằng `docker compose run --rm db-setup` sau khi sao lưu. Không xóa volume. Dựng lại orchestrator và ba ứng dụng. Kiểm tra `make test-architecture`, `make test-citizen`, `make test-commune`, `make test-sql`; môi trường demo: `DEMO_PASSWORD=... make demo`, `DEMO_PASSWORD=... make portal-smoke`.
- Các bài kiểm thử tĩnh không thay thế build Nuxt, E2E, kiểm thử làm mới token và đồng thời trên hệ thống chạy thực tế.
