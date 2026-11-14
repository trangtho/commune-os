<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# core/rest — API PostgREST sau Gateway (Issues #5, #6, #23)

Đường đi: `Keycloak JWT` → `APISIX /rest/*` → `PostgREST` (xác minh JWT qua
khóa JWKS của Keycloak, chuyển vai theo `azp = commune-app`) → PostgreSQL.
Dịch vụ `rest` **không có `ports:`** trong Docker Compose, nên không thể gọi
PostgREST trực tiếp từ máy ngoài. Khi không cấu hình anonymous role, PostgREST
cũng từ chối yêu cầu không mang JWT.

Vai trò được tách ở PostgreSQL:

- `receptionist`/`officer`/`leader` mang claim `tenant_id` hợp lệ (mã xã `xa-a`,
  `xa-b`) chỉ đọc hồ sơ thuộc xã đang hoạt động. Số điện thoại được che.
- `supervisor` và `sys_admin` **không** được đọc hồ sơ (403 nhờ pre-request,
  RLS cũng không cấp quyền xem các dòng). `sys_admin` chỉ được quản trị danh sách xã.
- Những API khác tiếp tục dùng quyền cơ sở dữ liệu riêng của Kênh Công dân.

Các API đang có:

| API | Chức năng |
| --- | --- |
| `GET /rest/dossiers` | Danh sách hồ sơ của xã đã lọc, ẩn số điện thoại |
| `GET /rest/dossier_events` | Lịch sử của hồ sơ được phép xem |
| `GET /rest/dossier_documents` | Metadata giấy tờ thuộc hồ sơ, **không lộ** `storage_key` |
| `GET /rest/procedure_documents` | Giấy tờ cần nộp theo thủ tục |
| `GET /rest/procedures` | Thủ tục đã công bố |
| `GET /rest/tenants` | Danh sách xã: `sys_admin` thấy tất cả; cán bộ thấy xã của mình |
| `POST /rest/rpc/add_tenant` | Thêm xã, chỉ `sys_admin` |
| `POST /rest/rpc/set_tenant_status` | Khóa / mở xã, chỉ `sys_admin` |

Giao diện quản trị gọi API ở `core/admin/app/composables/useApi.ts` và
`useTenants.ts`; trang Nuxt chuyển tiếp `/rest/**` tới APISIX tránh lỗi CORS.

## Chạy thử

```bash
make up
make seed
make test
# Bảng quản trị trong quá trình phát triển:
cd core/admin && npm install && npm run dev -- --port 3001
```

`core/rest/fetch-jwks.mjs` lấy public keys khi khởi động; nếu Keycloak luân
chuyển khóa, chạy lại các dịch vụ sau để lấy khóa mới:

```bash
docker compose up -d --force-recreate rest-keys rest
```

Để nạp lại các thay đổi SQL cho một volume **đang tồn tại**, chạy `make up`
(mặc định chạy lại `db-setup`) hoặc `make repair-db` mà không xóa volume.
