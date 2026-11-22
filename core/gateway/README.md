<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# core/gateway

Cửa ngõ API của lõi, dùng Apache APISIX ở chế độ đọc cấu hình từ tệp.

- `config.yaml`: chế độ chạy (không dùng etcd).
- `apisix.yaml`: các tuyến đường. APISIX tự nạp lại khi tệp thay đổi; tệp phải
  kết thúc bằng dòng `#END`.

| Tuyến | Chuyển tới | Ghi chú |
| --- | --- | --- |
| `/rest/*` | PostgREST (`core/rest`) | Bắt buộc JWT Keycloak |
| `/workflow/*` | Dịch vụ điều phối (`core/orchestrator`) | Bắt buộc JWT |
| `/files/*` | Dịch vụ tệp (`core/files`) | Bắt buộc JWT |
| `/accounts/*` | Dịch vụ tài khoản (`core/accounts`) | Bắt buộc JWT |
| `/accounts/first-password` | Dịch vụ tài khoản | Không cần token, giới hạn số lần thử |
| `/public/rpc/procedure_catalog`, `/public/rpc/procedure_detail` | PostgREST, vai trò `web_anon` | Không cần token (header `Authorization` bị bỏ), giới hạn 120 lần/phút; khách xem danh mục thủ tục |
| `/api/ping` | Keycloak | Tuyến thử |

Các tuyến bắt buộc JWT dùng plugin `openid-connect` (kiểm chữ ký bằng JWKS và kiểm nơi cấp);
PostgREST và các dịch vụ phía sau kiểm tra lại token một lần nữa.

## Thử nhanh

```bash
# không có token: 401
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:9080/api/ping

# có token: 200
TOKEN=$(curl -s -X POST "http://localhost:8080/realms/communeos/protocol/openid-connect/token" \
  -d "grant_type=password" -d "client_id=commune-app" \
  -d "username=canbo.xa-a" -d "password=12345" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $TOKEN" http://localhost:9080/api/ping
```

Tuyến `/api/ping` là tuyến thử, tạm chuyển tiếp tới Keycloak.
