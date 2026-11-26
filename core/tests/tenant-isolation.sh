#!/bin/sh
# SPDX-FileCopyrightText: 2026 CommuneOS Contributors
# SPDX-License-Identifier: Apache-2.0
#
# Kiểm thử cách ly dữ liệu giữa 2 xã qua đường thật: Keycloak → APISIX → PostgREST → PostgreSQL (RLS).
# Cần: docker compose up đang chạy và đã chạy make demo, curl, python3.
# Dùng các tài khoản do make demo tạo (cán bộ, lãnh đạo, công dân congdan.demo / congdan.khac; mật khẩu DEMO_PASSWORD,
# mặc định Demo@2026!) và tài khoản quản trị hệ thống trong .env (COMMUNEOS_ADMIN_USERNAME / COMMUNEOS_ADMIN_PASSWORD).
set -u

KC="${KEYCLOAK_URL:-http://localhost:8080}"
GW="${GATEWAY_URL:-http://localhost:${GATEWAY_PORT:-9080}}"
PASS="${DEMO_PASSWORD:-Demo@2026!}"
CITIZEN_PASS="${CITIZEN_DEMO_PASSWORD:-$PASS}"
# Biến lấy từ môi trường, không có thì đọc tệp .env.
from_env() { sed -n "s/^$1=//p" .env 2>/dev/null | tail -1; }
CITIZEN_SECRET="${CITIZEN_KEYCLOAK_SECRET:-$(from_env CITIZEN_KEYCLOAK_SECRET)}"
ADMIN_USER="${COMMUNEOS_ADMIN_USERNAME:-$(from_env COMMUNEOS_ADMIN_USERNAME)}"
ADMIN_PASS="${COMMUNEOS_ADMIN_PASSWORD:-$(from_env COMMUNEOS_ADMIN_PASSWORD)}"
FAIL=0

ok()   { echo "  ĐẠT  $1"; }
fail() { echo "  LỖI  $1"; FAIL=1; }

token() { # token <tên đăng nhập> [mật khẩu, mặc định DEMO_PASSWORD]
  curl -s -X POST "$KC/realms/communeos/protocol/openid-connect/token" \
    -d grant_type=password -d client_id=commune-app --data-urlencode username="$1" --data-urlencode password="${2:-$PASS}" |
    python3 -c 'import json,sys; print(json.load(sys.stdin).get("access_token",""))'
}
jfield() { python3 -c "import json,sys
try: d=json.load(sys.stdin)
except Exception: d={}
print(d.get('$1','') if isinstance(d,dict) else '')"; }

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
  fail "Không lấy được token (Keycloak chưa chạy, chưa chạy make demo hoặc sai DEMO_PASSWORD)"; exit 1
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

# Xử lý hồ sơ qua động cơ quy trình (chỉ thử các trường hợp bị từ chối nên không đổi dữ liệu).
wf() {
  curl -s -o /dev/null -w '%{http_code}' -X POST -H "Authorization: Bearer $1" \
    -H 'Content-Type: application/json' -d "$3" "$GW/workflow/dossiers/$2/actions"
}
code=$(wf "$TB" HS-2026-001210 '{"action":"processing"}')
[ "$code" = "404" ] && ok "Cán bộ xã B không xử lý được hồ sơ xã A (404)" || fail "Xã B xử lý hồ sơ xã A phải 404, nhận $code"

code=$(wf "$TA" HS-2026-001210 '{"action":"processing"}')
[ "$code" = "409" ] && ok "Hồ sơ đã hoàn thành không mở lại được (409)" || fail "Chuyển trạng thái sai phải 409, nhận $code"

code=$(wf "$TA" HS-2026-001197 '{"action":"rejected"}')
[ "$code" = "400" ] && ok "Từ chối không ghi lý do bị chặn (400)" || fail "Từ chối thiếu lý do phải 400, nhận $code"

actions=$(curl -s -H "Authorization: Bearer $TA" "$GW/workflow/dossiers/HS-2026-001197/actions" |
  python3 -c 'import json,sys; print(",".join(sorted(json.load(sys.stdin).get("actions", []))))')
[ "$actions" = "completed,rejected,supplement" ] && ok "Sơ đồ BPMN trả đúng các bước đi tiếp ($actions)" || fail "Bước đi tiếp từ BPMN sai: '$actions'"

code=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H "Authorization: Bearer $TA" -H 'Content-Type: application/json' \
  -d '{"dossier_id":"HS-2026-001197","status":"completed"}' "$GW/rest/rpc/set_dossier_status")
[ "$code" = "403" ] && ok "Không bỏ qua được động cơ quy trình: gọi thẳng API ghi bị chặn (403)" || fail "Gọi thẳng set_dossier_status phải 403, nhận $code"

# Sổ ghi nhận: chuỗi mã băm của xã A phải nguyên vẹn, và xã A không thấy sổ của xã khác.
ledger=$(curl -s -X POST -H "Authorization: Bearer $TA" -H 'Content-Type: application/json' -d '{}' \
  "$GW/rest/rpc/verify_ledger" |
  python3 -c 'import json,sys; d=json.load(sys.stdin); print(",".join("%s:%s" % (r["tenant_code"], r["ok"]) for r in d))')
[ "$ledger" = "xa-a:True" ] && ok "Sổ ghi nhận của xã A nguyên vẹn, không lộ sổ xã khác" || fail "Kiểm tra sổ ghi nhận: '$ledger'"

# Lưu trữ tệp: cán bộ xã A đính kèm và tải về đúng mã băm; cán bộ xã B không tải được.
printf '%%PDF-1.4\n%% tep kiem thu tu tao\n%%%%EOF\n' > /tmp/communeos-thu.pdf
doc=$(curl -s -X POST -H "Authorization: Bearer $TA" -H 'Content-Type: application/pdf' \
  --data-binary @/tmp/communeos-thu.pdf "$GW/files/dossiers/HS-2026-001248/documents?code=ket-qua&name=kiem-thu.pdf" |
  python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("id","-"), d.get("sha256","-"))')
id=${doc% *}; sum=${doc#* }
[ "$id" != "-" ] && ok "Cán bộ xã A lưu được tệp vào kho đối tượng" || fail "Không lưu được tệp qua /files"

got=$(curl -s -H "Authorization: Bearer $TA" "$GW/files/documents/$id" | sha256sum | cut -d' ' -f1)
[ "$got" = "$sum" ] && ok "Tải về đúng nội dung (SHA-256 khớp)" || fail "Tệp tải về không khớp mã băm"

code=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $TB" "$GW/files/documents/$id")
[ "$code" = "404" ] && ok "Cán bộ xã B không tải được tệp của xã A (404)" || fail "Xã B tải tệp xã A phải 404, nhận $code"

code=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H "Authorization: Bearer $TA" -H 'Content-Type: application/pdf' \
  --data-binary 'khong phai pdf' "$GW/files/dossiers/HS-2026-001248/documents?code=ket-qua")
[ "$code" = "415" ] && ok "Tệp giả định dạng bị từ chối (415)" || fail "Tệp giả phải 415, nhận $code"

# Thủ tục theo xã: cán bộ thấy danh mục của xã mình nhưng không tự bật/tắt được.
n=$(curl -s -H "Authorization: Bearer $TA" "$GW/rest/procedures?select=id" |
  python3 -c 'import json,sys; print(len(json.load(sys.stdin)))')
[ "$n" -gt 0 ] && ok "Cán bộ xã A thấy $n thủ tục xã mình đang mở" || fail "Cán bộ xã A không thấy thủ tục nào"

code=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H "Authorization: Bearer $TA" -H 'Content-Type: application/json' \
  -d '{"tenant_code":"xa-a","procedure_id":"khai-sinh","enabled":false}' "$GW/rest/rpc/set_tenant_procedure")
[ "$code" = "403" ] && ok "Cán bộ xã không tự bật/tắt thủ tục được (403)" || fail "Cán bộ bật/tắt thủ tục phải 403, nhận $code"

# Quản lý cán bộ: chỉ lãnh đạo xã, chỉ cán bộ xử lý cùng xã (chỉ thử các trường hợp bị từ chối).
LA=$(token lanhdao.xa-a); LB=$(token lanhdao.xa-b)
staff_ids() {
  curl -s -H "Authorization: Bearer $1" "$GW/accounts/staff" |
    python3 -c 'import json,sys; print(" ".join("%s=%s" % (u["username"], u["id"]) for u in json.load(sys.stdin)))'
}
code=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $TA" "$GW/accounts/staff")
[ "$code" = "403" ] && ok "Cán bộ xử lý không vào được quản lý cán bộ (403)" || fail "Cán bộ xem danh sách cán bộ phải 403, nhận $code"

SA=$(staff_ids "$LA"); SB=$(staff_ids "$LB")
case "$SA" in *canbo.xa-a=*) case "$SA" in *xa-b*) fail "Lãnh đạo xã A thấy người xã B: $SA";; *) ok "Lãnh đạo xã A thấy cán bộ xã mình, không thấy xã B";; esac;;
  *) fail "Lãnh đạo xã A không thấy canbo.xa-a: '$SA'";; esac

idb=$(echo "$SB" | tr ' ' '\n' | sed -n 's/^canbo\.xa-b=//p')
code=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH -H "Authorization: Bearer $LA" -H 'Content-Type: application/json' \
  -d '{"enabled":false}' "$GW/accounts/staff/$idb/status")
[ "$code" = "404" ] && ok "Lãnh đạo xã A không khóa được cán bộ xã B (404)" || fail "Khóa cán bộ xã khác phải 404, nhận $code"

ida=$(echo "$SA" | tr ' ' '\n' | sed -n 's/^lanhdao\.xa-a=//p')
code=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH -H "Authorization: Bearer $LA" -H 'Content-Type: application/json' \
  -d '{"enabled":false}' "$GW/accounts/staff/$ida/status")
[ "$code" = "403" ] && ok "Lãnh đạo không tự khóa được chính mình (403)" || fail "Tự khóa mình phải 403, nhận $code"

# Hồ sơ cá nhân và hai cấp duyệt.
n=$(curl -s -H "Authorization: Bearer $TA" "$GW/rest/staff_requests" |
  python3 -c 'import json,sys; print(len(json.load(sys.stdin)))')
[ "$n" = "0" ] && ok "Cán bộ xử lý không xem được yêu cầu của người khác" || fail "Cán bộ xử lý thấy $n yêu cầu của cả xã"

code=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H "Authorization: Bearer $TA" -H 'Content-Type: application/json' \
  -d '{"request_id":"00000000-0000-0000-0000-000000000000","approve":true}' "$GW/rest/rpc/decide_staff_request")
[ "$code" = "403" ] && ok "Cán bộ xử lý không duyệt được yêu cầu (403)" || fail "Cán bộ duyệt yêu cầu phải 403, nhận $code"

code=$(wf "$TA" HS-2026-001197 '{"action":"completed","note":"kiem thu"}')
[ "$code" = "400" ] && ok "Cán bộ xử lý không tự trả kết quả khi lãnh đạo chưa duyệt (400)" || fail "Trả kết quả chưa duyệt phải 400, nhận $code"

# Công dân: token của client bí mật citizen-app, RLS theo công dân qua cổng /rest.
citizen_token() {
  secret=""; [ "$1" = "citizen-app" ] && secret="$CITIZEN_SECRET"
  curl -s -X POST "$KC/realms/communeos/protocol/openid-connect/token" \
    -d grant_type=password -d client_id="$1" --data-urlencode client_secret="$secret" \
    -d username="$2" --data-urlencode password="$3" |
    python3 -c 'import json,sys; print(json.load(sys.stdin).get("access_token",""))'
}
rpc() { # rpc <token|-> <tên hàm> <json>  → in mã HTTP; "-" là khách, gọi qua /public
  if [ "$1" = "-" ]; then
    curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d "$3" "$GW/public/rpc/$2"
  else
    curl -s -o /dev/null -w '%{http_code}' -X POST -H "Authorization: Bearer $1" -H 'Content-Type: application/json' -d "$3" "$GW/rest/rpc/$2"
  fi
}
logins() {
  curl -s -H "Authorization: Bearer $1" "$GW/rest/my_citizen_profile?select=login_name" |
    python3 -c 'import json,sys; d=json.load(sys.stdin); print(",".join(r["login_name"] for r in d) if isinstance(d,list) else "LOI")'
}
CA=$(citizen_token citizen-app congdan.demo "$CITIZEN_PASS"); CB=$(citizen_token citizen-app congdan.khac "$CITIZEN_PASS")
[ "$(logins "$CA")" = "congdan.demo" ] && [ "$(logins "$CB")" = "congdan.khac" ] &&
  ok "Công dân qua cổng /rest chỉ thấy hồ sơ cá nhân của mình" || fail "Công dân thấy sai hồ sơ cá nhân (A='$(logins "$CA")', B='$(logins "$CB")')"

code=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $CA" "$GW/rest/dossiers")
[ "$code" = "403" ] && ok "Token công dân không đọc được hồ sơ của cán bộ (403)" || fail "Công dân đọc dossiers phải 403, nhận $code"

CX=$(citizen_token commune-app congdan.demo "$CITIZEN_PASS")
[ -n "$CX" ] && [ "$(ids "$CX")" = "" ] && ok "Công dân lấy token qua client cán bộ cũng không thấy hồ sơ của xã" ||
  fail "Công dân dùng client cán bộ thấy hồ sơ: '$(ids "$CX")'"

SC=$(citizen_token citizen-app canbo.xa-a "$PASS")
[ "$(logins "$SC")" = "" ] && ok "Cán bộ dùng client công dân không thấy hồ sơ công dân nào" || fail "Cán bộ dùng client công dân thấy: '$(logins "$SC")'"

code=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H "Authorization: Bearer $CA" -H 'Content-Type: application/json' \
  -d '{"currentPassword":"sai-mat-khau","newPassword":"MatKhauMoi2026"}' "$GW/accounts/me/password")
[ "$code" = "403" ] && ok "Đổi mật khẩu với mật khẩu hiện tại sai bị từ chối (403)" || fail "Đổi mật khẩu sai mật khẩu cũ phải 403, nhận $code"

nosecret=$(curl -s -X POST "$KC/realms/communeos/protocol/openid-connect/token" -d grant_type=password -d client_id=citizen-app \
  -d username=congdan.demo --data-urlencode password="$CITIZEN_PASS" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("access_token",""))')
[ -z "$nosecret" ] && ok "Không có client secret thì không xin được token công dân" || fail "Xin được token công dân mà không cần client secret"

# Khởi tạo tài khoản theo vai trò (core/db/init/35-account-onboarding.sql, dịch vụ accounts):
# quản trị hệ thống tạo xã kèm lãnh đạo; lãnh đạo mới phải đổi mật khẩu tạm; người dân tự đăng ký.
QT=$(token "$ADMIN_USER" "$ADMIN_PASS")
[ -n "$QT" ] && ok "Quản trị hệ thống đăng nhập bằng tài khoản trong .env" || fail "Quản trị $ADMIN_USER không đăng nhập được bằng mật khẩu trong .env"
post() { # post <token|-> <đường dẫn> <json> → in "mã HTTP<TAB>nội dung"
  auth=""; [ "$1" != "-" ] && auth="Authorization: Bearer $1"
  curl -s -w '\t%{http_code}' -X POST -H "$auth" -H 'Content-Type: application/json' -d "$3" "$GW$2" |
    python3 -c 'import sys; b,_,c=sys.stdin.read().rpartition("\t"); print(c+"\t"+b)'
}
code=$(post "$LA" /accounts/tenants '{"code":"xa-kt","name":"Thử","leaderUsername":"ld.kt","leaderFullName":"A B"}' | cut -f1)
[ "$code" = "403" ] && ok "Lãnh đạo xã không tạo được xã (403)" || fail "Lãnh đạo tạo xã phải 403, nhận $code"

KT="xa-kt-$(date +%s)"; KTL="ld.$KT"
r=$(post "$QT" /accounts/tenants "{\"code\":\"$KT\",\"name\":\"Xã kiểm thử\",\"leaderUsername\":\"$KTL\",\"leaderFullName\":\"Kiểm Thử\"}")
tmp=$(echo "$r" | cut -f2- | python3 -c 'import json,sys; print(json.load(sys.stdin).get("leader",{}).get("temporaryPassword",""))' 2>/dev/null)
early=$(token "$KTL" "$tmp")
changed=$(post - /accounts/first-password "{\"username\":\"$KTL\",\"currentPassword\":\"$tmp\",\"newPassword\":\"KiemThu2026x\"}" | cut -f1)
LK=$(token "$KTL" KiemThu2026x)
tenant_of() { echo "$1" | cut -d. -f2 | python3 -c 'import base64,json,sys; s=sys.stdin.read().strip(); print(json.loads(base64.urlsafe_b64decode(s+"="*(-len(s)%4))).get("tenant_id",""))'; }
[ "$(echo "$r" | cut -f1)" = "201" ] && [ -n "$tmp" ] && [ -z "$early" ] && [ "$changed" = "200" ] && [ -n "$LK" ] && [ "$(tenant_of "$LK")" = "$KT" ] &&
  ok "Quản trị tạo xã kèm lãnh đạo; lãnh đạo phải đổi mật khẩu tạm rồi mới đăng nhập, token mang đúng xã" ||
  fail "Tạo xã kèm lãnh đạo: $(echo "$r" | cut -c1-160), đăng nhập bằng mật khẩu tạm '${early:+được}', đổi mật khẩu $changed"

r=$(post "$QT" /accounts/tenants '{"code":"xa-kt-trung","name":"Thử","leaderUsername":"ld.kt-trung","leaderFullName":"A B","leaderEmail":"lanhdao.xa-a@example.com"}')
left=$(curl -s -H "Authorization: Bearer $QT" "$GW/rest/tenants?code=eq.xa-kt-trung&select=code" | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))')
[ "$(echo "$r" | cut -f1)" = "409" ] && [ "$left" = "0" ] && ok "Tạo tài khoản lãnh đạo lỗi (email trùng) thì xã vừa tạo bị hủy" ||
  fail "Tạo xã khi tài khoản lãnh đạo lỗi: $(echo "$r" | cut -c1-120), xã còn lại $left"

LDB=$(curl -s -H "Authorization: Bearer $QT" "$GW/accounts/tenants/xa-b/leaders" | python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["id"])' 2>/dev/null)
c1=$(post "$QT" "/accounts/tenants/xa-a/leaders/$LDB/reset-password" '{}' | cut -f1)
c2=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $LA" "$GW/accounts/tenants/xa-a/leaders")
[ "$c1" = "404" ] && [ "$c2" = "403" ] && ok "Lãnh đạo xã B không bị cấp lại mật khẩu qua xã A (404); lãnh đạo không xem được danh sách lãnh đạo (403)" ||
  fail "Quản lý lãnh đạo: cấp lại qua xã khác $c1, lãnh đạo xem danh sách $c2"

REG="dk.$(date +%s)"
r1=$(post - /public/accounts/register "{\"fullName\":\"Người Đăng Ký\",\"username\":\"$REG\",\"phone\":\"0912345678\",\"tenantCode\":\"xa-a\",\"password\":\"DangKy2026x\",\"consent\":true}" | cut -f1)
CR=$(citizen_token citizen-app "$REG" DangKy2026x)
r2=$(post - /public/accounts/register "{\"fullName\":\"Người Đăng Ký\",\"username\":\"$REG.x\",\"phone\":\"0912345678\",\"tenantCode\":\"xa-a\",\"password\":\"DangKy2026x\"}" | cut -f1)
r3=$(post - /public/accounts/register "{\"fullName\":\"Người Đăng Ký\",\"username\":\"$REG.y\",\"phone\":\"0912345678\",\"tenantCode\":\"xa-a\",\"password\":\"12345678\",\"consent\":true}" | cut -f1)
r4=$(post - /public/accounts/register '{"fullName":"Người Đăng Ký","username":"congdan.demo","phone":"0912345678","tenantCode":"xa-a","password":"DangKy2026x","consent":true}' | cut -f1)
[ "$r1" = "201" ] && [ "$(logins "$CR")" = "$REG" ] && [ "$r2" = "400" ] && [ "$r3" = "400" ] && [ "$r4" = "409" ] &&
  ok "Người dân tự đăng ký được và chỉ thấy hồ sơ của mình; thiếu đồng ý, mật khẩu yếu, trùng tên bị từ chối" ||
  fail "Đăng ký công dân: tạo $r1 (hồ sơ '$(logins "$CR")'), không đồng ý $r2, mật khẩu yếu $r3, trùng tên $r4"

# Dọn dữ liệu kiểm thử: xóa tài khoản trong Keycloak bằng quản trị Keycloak (.env), hủy xã vừa tạo.
KC_ADMIN_TOKEN=$(curl -s -X POST "$KC/realms/master/protocol/openid-connect/token" -d grant_type=password -d client_id=admin-cli \
  --data-urlencode username="${KEYCLOAK_ADMIN:-$(from_env KEYCLOAK_ADMIN)}" --data-urlencode password="${KEYCLOAK_ADMIN_PASSWORD:-$(from_env KEYCLOAK_ADMIN_PASSWORD)}" | jfield access_token)
kc_delete() { # kc_delete <tên đăng nhập> → in mã công dân (nếu có) của tài khoản vừa xóa
  curl -s -H "Authorization: Bearer $KC_ADMIN_TOKEN" "$KC/admin/realms/communeos/users?exact=true&username=$1" |
    python3 -c 'import json,sys; d=json.load(sys.stdin); print(d[0]["id"]+" "+(d[0].get("attributes",{}).get("citizen_id",[""])[0]) if d else "")' |
    { read -r uid cid; [ -n "$uid" ] && curl -s -o /dev/null -X DELETE -H "Authorization: Bearer $KC_ADMIN_TOKEN" "$KC/admin/realms/communeos/users/$uid"; echo "$cid"; }
}
kc_delete "$KTL" >/dev/null
curl -s -o /dev/null -X POST -H "Authorization: Bearer $QT" -H 'Content-Type: application/json' -d "{\"p_code\":\"$KT\"}" "$GW/rest/rpc/remove_new_tenant"
kc_delete "$REG" >/dev/null
# Hồ sơ công dân giữ lại (nhật ký đồng ý không xóa được), chỉ giải phóng tên đăng nhập như api.system_unregister_citizen.
docker compose exec -T db sh -c 'psql -q -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<SQL
UPDATE citizens SET login_name = 'huy-' || id::text, display_name = 'Đăng ký không hoàn tất', email = NULL, phone = NULL
WHERE login_name = '$REG';
SQL

# Kênh người dân qua API của lõi.
n=$(curl -s -X POST -H 'Content-Type: application/json' -d '{}' "$GW/public/rpc/procedure_catalog" |
  python3 -c 'import json,sys; d=json.load(sys.stdin); print(len(d) if isinstance(d,list) else -1)')
code=$(rpc - citizen_profile '{}')
[ "$n" -gt 0 ] && [ "$code" = "404" ] && ok "Khách xem được danh mục thủ tục qua /public, không gọi được hàm của công dân" ||
  fail "Danh mục công khai trả $n thủ tục, hàm công dân qua /public trả $code"

c1=$(rpc - public_knowledge_status '{}'); c2=$(rpc - citizen_receivers '{"p_procedure_id":"khai-sinh"}')
c3=$(rpc - citizen_vault '{}'); c4=$(rpc "$CA" public_procedure_channels '{"p_procedure_id":"khai-sinh"}')
[ "$c1" = "200" ] && [ "$c2" = "404" ] && [ "$c3" = "404" ] && [ "$c4" = "200" ] &&
  ok "Cổng /public chỉ mở các hàm public_* đã liệt kê; hàm của công dân không gọi được khi chưa đăng nhập" ||
  fail "Cổng /public: hàm công khai $c1, hàm công dân $c2 / $c3, công dân gọi hàm công khai bằng token $c4"

APP_A=$(curl -s -X POST -H "Authorization: Bearer $CA" -H 'Content-Type: application/json' -d '{}' "$GW/rest/rpc/citizen_applications" |
  python3 -c 'import json,sys; d=json.load(sys.stdin); print(d[0]["id"] if isinstance(d,list) and d else "")')
codeA=$(rpc "$CA" citizen_application "{\"p_application_id\":\"$APP_A\"}")
codeB=$(rpc "$CB" citizen_application "{\"p_application_id\":\"$APP_A\"}")
[ -n "$APP_A" ] && [ "$codeA" = "200" ] && [ "$codeB" = "404" ] && ok "Công dân B không đọc được hồ sơ của công dân A qua API lõi (404)" ||
  fail "Đọc hồ sơ $APP_A: chủ hồ sơ $codeA, người khác $codeB"

code=$(rpc "$CB" citizen_application_submit "{\"p_application_id\":\"$APP_A\",\"p_expected_updated_at\":\"2026-01-01T00:00:00Z\"}")
[ "$code" = "404" ] && ok "Công dân B không nộp được hồ sơ của công dân A (404)" || fail "Nộp hồ sơ của người khác phải 404, nhận $code"

code=$(rpc "$TA" citizen_applications '{}')
[ "$code" = "403" ] && ok "Token cán bộ không gọi được API của công dân (403)" || fail "Cán bộ gọi API công dân phải 403, nhận $code"

# Phần việc cán bộ phát sinh từ Kênh người dân (core/db/init/26-citizen-staff-api.sql): xã, vai trò lấy từ token.
c1=$(rpc "$TA" citizen_support_tickets '{}'); c2=$(rpc "$CA" citizen_support_tickets '{}')
c3=$(rpc "$TA" citizen_privacy_requests '{}'); c4=$(rpc "$LA" citizen_privacy_requests '{}')
c5=$(rpc "$LA" publish_procedure_version '{"p_data":{}}')
[ "$c1" = "200" ] && [ "$c2" = "403" ] && [ "$c3" = "403" ] && [ "$c4" = "200" ] && [ "$c5" = "403" ] &&
  ok "API cán bộ cho Kênh người dân: cán bộ xem hỗ trợ, công dân bị chặn, dữ liệu cá nhân chỉ lãnh đạo, công bố thủ tục chỉ quản trị" ||
  fail "API cán bộ cho Kênh người dân: cán bộ $c1, công dân $c2, cán bộ xem dữ liệu cá nhân $c3, lãnh đạo $c4, lãnh đạo công bố $c5"

# Tình trạng dịch vụ lõi qua cổng (trang Tình trạng hệ thống của bảng quản trị): kiểm tra cả thành phần phía sau.
QT=$(token "$ADMIN_USER" "$ADMIN_PASS")
codes=""
for p in workflow/health files/health accounts/health; do
  codes="$codes $(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $QT" "$GW/$p")"
done
noauth=$(curl -s -o /dev/null -w '%{http_code}' "$GW/files/health")
[ "$codes" = " 200 200 200" ] && [ "$noauth" = "401" ] &&
  ok "Tình trạng quy trình, kho tệp, tài khoản đọc được qua cổng; không token bị chặn" ||
  fail "Tình trạng dịch vụ lõi:$codes, không token $noauth"

# Thông báo cho cán bộ: theo xã, chỉ lãnh đạo gửi được thông báo cho công dân.
na=$(curl -s -H "Authorization: Bearer $TA" "$GW/rest/staff_notifications?select=id" | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))')
nb=$(curl -s -H "Authorization: Bearer $TB" "$GW/rest/staff_notifications?select=application_id" |
  python3 -c 'import json,sys; print(",".join(n["application_id"] or "" for n in json.load(sys.stdin)))')
case ",$nb," in *",$(echo "$A" | cut -d, -f1),"*) leak=1 ;; *) leak=0 ;; esac
code=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $CA" "$GW/rest/staff_notifications")
[ "$na" -gt 0 ] && [ "$leak" = "0" ] && [ "$code" = "403" ] && ok "Thông báo cán bộ: xã A có thông báo, xã B không thấy của xã A, công dân không đọc được (403)" ||
  fail "Thông báo cán bộ: xã A $na, xã B '$nb', công dân $code"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H "Authorization: Bearer $TA" -H 'Content-Type: application/json' \
  -d '{"title":"Thử","body":"Thử nghiệm"}' "$GW/rest/rpc/broadcast_citizen_notice")
[ "$code" = "403" ] && ok "Cán bộ xử lý không gửi được thông báo cho công dân (403)" || fail "Cán bộ gửi thông báo cho công dân phải 403, nhận $code"

# Trí tuệ nhân tạo chạy cục bộ (core/ai). Bỏ qua khi dịch vụ AI không chạy (ví dụ CI không tải mô hình).
skip() { echo "  BỎ QUA  $1"; }
if [ "$(curl -s "$GW/public/ai/ready" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("ready", False))' 2>/dev/null)" = "True" ]; then
  code=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{"question":"khai sinh"}' "$GW/ai/ask")
  [ "$code" = "401" ] && ok "Trợ lý AI: không token bị chặn ở /ai/ask (401)" || fail "/ai/ask không token phải 401, nhận $code"

  r=$(curl -s -m 120 -X POST -H "Authorization: Bearer $CA" -H 'Content-Type: application/json' \
    -d '{"question":"Em bé vừa chào đời cần làm thủ tục gì, số tôi 0912345678","select":false}' "$GW/ai/ask" |
    python3 -c 'import json,sys; d=json.load(sys.stdin); c=d.get("chunks",[]); print("%s %s %s" % (c[0].get("procedure_id") if c else "", d.get("masked"), any(x.get("matched")!="text" for x in c)))')
  [ "$r" = "khai-sinh True True" ] && ok "Trợ lý AI: tìm đúng thủ tục theo nghĩa, che số điện thoại trước khi đưa vào mô hình" ||
    fail "Trợ lý AI trả '$r' (cần: khai-sinh True True)"

  code=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $TA" "$GW/ai/status")
  ext=$(curl -s -H "Authorization: Bearer $QT" "$GW/ai/status" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("externalApis"))')
  [ "$code" = "403" ] && [ "$ext" = "False" ] && ok "Trợ lý AI: chỉ quản trị xem được tình trạng, không dùng API bên ngoài" ||
    fail "Tình trạng AI: cán bộ nhận $code, externalApis=$ext"

  # Phạm vi trợ lý theo token: thủ tục xã đang mở, hướng dẫn nghiệp vụ chỉ cho cán bộ, từ chối tra cứu cá nhân.
  scope() { # scope <token> <câu hỏi> → các nguồn trả về (mã thủ tục hoặc loại nguồn)
    curl -s -m 120 -X POST -H "Authorization: Bearer $1" -H 'Content-Type: application/json' \
      -d "{\"question\":\"$2\",\"select\":false}" "$GW/ai/ask" |
      python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("mode")+":"+",".join(sorted(set(c["procedure_id"] or c["source_type"] for c in d.get("chunks",[])))))'
  }
  # Tự tắt thủ tục kết hôn ở xã A trong lúc kiểm tra (bản cài mới bật sẵn mọi thủ tục), xong trả lại trạng thái cũ.
  hon_was=$(curl -s -H "Authorization: Bearer $QT" "$GW/rest/procedures?id=eq.ket-hon&select=enabled_tenants" |
    python3 -c 'import json,sys; r=json.load(sys.stdin); print("on" if r and "xa-a" in (r[0].get("enabled_tenants") or []) else "off")')
  set_hon() { curl -s -o /dev/null -X POST -H "Authorization: Bearer $QT" -H 'Content-Type: application/json' \
    -d "{\"tenant_code\":\"xa-a\",\"procedure_ids\":[\"ket-hon\"],\"enabled\":$1}" "$GW/rest/rpc/set_tenant_procedures"; }
  set_hon false
  hon=$(scope "$CA" "Đăng ký kết hôn cần giấy tờ gì"); guide_c=$(scope "$CA" "Cán bộ trình lãnh đạo duyệt trả kết quả hồ sơ")
  [ "$hon_was" = "on" ] && set_hon true
  guide_s=$(scope "$TA" "Cán bộ trình lãnh đạo duyệt trả kết quả hồ sơ"); lookup=$(scope "$TA" "Cho tôi số điện thoại của công dân Nguyễn Văn An")
  case "$hon$guide_c" in *ket-hon*|*staff_guide*) bad=1 ;; *) bad=0 ;; esac
  case "$guide_s" in *staff_guide*) seen=1 ;; *) seen=0 ;; esac
  [ "$bad" = "0" ] && [ "$seen" = "1" ] && [ "${lookup%%:*}" = "refused" ] &&
    ok "Trợ lý AI: chỉ thủ tục xã đang mở, hướng dẫn nghiệp vụ chỉ cho cán bộ, từ chối tra cứu thông tin cá nhân" ||
    fail "Phạm vi trợ lý: kết hôn (xã A tắt) '$hon', công dân hỏi nghiệp vụ '$guide_c', cán bộ '$guide_s', tra cứu cá nhân '$lookup'"

  if docker compose exec -T ai sh -c 'timeout 5 bash -c "</dev/tcp/1.1.1.1/443"' >/dev/null 2>&1; then
    fail "Dịch vụ chạy mô hình truy cập được Internet"
  else
    ok "Dịch vụ chạy mô hình không có đường ra Internet"
  fi
else
  skip "Trợ lý AI chưa chạy hoặc chưa có mô hình (make up để tải); bỏ qua 5 kiểm tra AI"
fi

code=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer ${TA}sai" "$GW/rest/dossiers")
[ "$code" = "401" ] && ok "Token bị sửa → 401" || fail "Token bị sửa phải 401, nhận $code"

[ "$FAIL" = "0" ] && echo "KẾT QUẢ: ĐẠT" || echo "KẾT QUẢ: CÓ LỖI"
exit "$FAIL"