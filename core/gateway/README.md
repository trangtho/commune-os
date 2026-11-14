<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# core/gateway

Cửa ngõ API của lõi, dùng Apache APISIX ở chế độ đọc cấu hình từ tệp.

- `config.yaml`: chế độ chạy (không dùng etcd).
- `apisix.yaml`: các tuyến đường. APISIX tự nạp lại khi tệp thay đổi; tệp phải
  kết thúc bằng dòng `#END`.

Mọi tuyến `/api/*` yêu cầu JWT do Keycloak cấp (plugin `openid-connect`,
kiểm chữ ký bằng JWKS và kiểm nơi cấp).

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
