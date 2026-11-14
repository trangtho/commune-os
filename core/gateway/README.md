<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# core/gateway — APISIX (Issues #3 và #6)

Cửa ngõ bảo vệ cả `/api/*` lẫn `/rest/*` bằng Keycloak JWT, xác minh chữ ký
RS256 qua JWKS và thời hạn token bằng plugin `openid-connect` (`bearer_only`,
`use_jwks`). Không token hoặc token sai → HTTP 401.

- `/api/ping`: tuyến kiểm tra riêng, proxy đến Keycloak.
- `/api/*`: proxy đến Kênh Công dân (`citizen:3000`), nhưng **không bỏ qua**
  xác thực và quyền riêng của các API Nuxt (session, citizen_id, tenant_id).
- `/rest/*`: bỏ tiền tố `/rest/`, chuyển đến `rest:3000` trong mạng Compose.
  Header Authorization giữ JWT đã được APISIX xác minh để PostgREST xác minh
  chữ ký một lần nữa và áp Row Level Security.

`config.yaml` bật standalone mode; `apisix.yaml` phải kết thúc bằng `#END`.
Lệnh kiểm chứng tích hợp sau khi chạy `make up`, `make seed`:

```bash
make test
curl -i http://localhost:9080/rest/dossiers   # 401
curl -i http://localhost:9080/api/health      # 401
```

Việc API trả 404 (không có route) **không phải** là bằng chứng JWT bị từ chối.
