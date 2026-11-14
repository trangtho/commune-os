#!/bin/sh
# SPDX-FileCopyrightText: 2026 CommuneOS Contributors
# SPDX-License-Identifier: Apache-2.0
#
# Kiểm thử cách ly dữ liệu giữa 2 xã qua đường thật: Keycloak → APISIX → PostgREST → PostgreSQL (RLS).
# Cần: docker compose up đang chạy, curl, python3.
# Dùng 2 tài khoản mẫu canbo.xa-a / canbo.xa-b. Mật khẩu lấy từ biến DEMO_PASSWORD (mặc định 12345).
set -u

KC="${KEYCLOAK_URL:-http://localhost:8080}"
GW="${GATEWAY_URL:-http://localhost:${GATEWAY_PORT:-9080}}"
PASS="${DEMO_PASSWORD:-12345}"
FAIL=0

ok()   { echo "  ĐẠT  $1"; }
fail() { echo "  LỖI  $1"; FAIL=1; }

token() {
  curl -s -X POST "$KC/realms/communeos/protocol/openid-connect/token" \
    -d grant_type=password -d client_id=commune-app -d username="$1" -d password="$PASS" |
    python3 -c 'import json,sys; print(json.load(sys.stdin).get("access_token",""))'
}

# Lấy danh sách mã hồ sơ, nối bằng dấu phẩy, đã sắp xếp.
ids() {
  curl -s -H "Authorization: Bearer $1" "$GW/rest/dossiers?select=id&order=id" |
    python3 -c 'import json,sys; print(",".join(r["id"] for r in json.load(sys.stdin)))'
}

echo "Kiểm thử cách ly xã ($GW)"

code=$(curl -s -o /dev/null -w '%{http_code}' "$GW/rest/dossiers")
[ "$code" = "401" ] && ok "Không có token → 401" || fail "Không có token phải 401, nhận $code"

TA=$(token canbo.xa-a); TB=$(token canbo.xa-b)
if [ -z "$TA" ] || [ -z "$TB" ]; then
  fail "Không lấy được token (Keycloak chưa chạy hoặc sai DEMO_PASSWORD)"; exit 1
fi

A=$(ids "$TA"); B=$(ids "$TB")
case ",$A," in *",HS-2026-008888,"*) fail "Xã A nhìn thấy hồ sơ của xã B";; *) ok "Xã A không thấy hồ sơ xã B";; esac
[ -n "$A" ] && ok "Xã A thấy hồ sơ của mình ($A)" || fail "Xã A không thấy hồ sơ nào"
[ "$B" = "HS-2026-008888" ] && ok "Xã B chỉ thấy đúng hồ sơ của mình" || fail "Xã B thấy: '$B'"

n=$(curl -s -H "Authorization: Bearer $TA" "$GW/rest/dossiers?id=eq.HS-2026-008888" |
  python3 -c 'import json,sys; print(len(json.load(sys.stdin)))')
[ "$n" = "0" ] && ok "Xã A gọi thẳng mã hồ sơ xã B → rỗng" || fail "Xã A đọc được hồ sơ xã B khi gọi thẳng mã"

phone=$(curl -s -H "Authorization: Bearer $TA" "$GW/rest/dossiers?select=applicant_phone&limit=1" |
  python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["applicant_phone"] or "")')
case "$phone" in *"*"*) ok "Số điện thoại đã được che ($phone)";; *) fail "Số điện thoại chưa được che: $phone";; esac

code=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE -H "Authorization: Bearer $TA" "$GW/rest/procedures?id=eq.khai-sinh")
case "$code" in 2*) fail "Cán bộ xóa được dữ liệu qua API ($code)";; *) ok "API chỉ đọc: xóa bị từ chối ($code)";; esac

code=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H "Authorization: Bearer $TA" \
  -H 'Content-Type: application/json' -d '{"code":"xa-thu","name":"Thử"}' "$GW/rest/rpc/add_tenant")
[ "$code" = "403" ] && ok "Cán bộ xã không thêm được xã (403)" || fail "Cán bộ xã thêm xã phải 403, nhận $code"

code=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer ${TA}sai" "$GW/rest/dossiers")
[ "$code" = "401" ] && ok "Token bị sửa → 401" || fail "Token bị sửa phải 401, nhận $code"

[ "$FAIL" = "0" ] && echo "KẾT QUẢ: ĐẠT" || echo "KẾT QUẢ: CÓ LỖI"
exit "$FAIL"