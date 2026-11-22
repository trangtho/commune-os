#!/bin/sh
# SPDX-FileCopyrightText: 2026 CommuneOS Contributors
# SPDX-License-Identifier: Apache-2.0
#
# Kiểm thử cách ly dữ liệu giữa 2 xã qua đường thật: Keycloak → APISIX → PostgREST → PostgreSQL (RLS).
# Cần: docker compose up đang chạy, curl, python3.
# Dùng các tài khoản mẫu cán bộ (mật khẩu DEMO_PASSWORD, mặc định 12345) và công dân
# congdan.demo / congdan.khac (mật khẩu CITIZEN_DEMO_PASSWORD, mặc định Demo@2026!).
set -u

KC="${KEYCLOAK_URL:-http://localhost:8080}"
GW="${GATEWAY_URL:-http://localhost:${GATEWAY_PORT:-9080}}"
PASS="${DEMO_PASSWORD:-12345}"
CITIZEN_PASS="${CITIZEN_DEMO_PASSWORD:-Demo@2026!}"
# Bí mật của client citizen-app: lấy từ biến môi trường, không có thì đọc tệp .env.
CITIZEN_SECRET="${CITIZEN_KEYCLOAK_SECRET:-$(sed -n 's/^CITIZEN_KEYCLOAK_SECRET=//p' .env 2>/dev/null | tail -1)}"
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

# Kênh người dân qua API của lõi.
n=$(curl -s -X POST -H 'Content-Type: application/json' -d '{}' "$GW/public/rpc/procedure_catalog" |
  python3 -c 'import json,sys; d=json.load(sys.stdin); print(len(d) if isinstance(d,list) else -1)')
code=$(rpc - citizen_profile '{}')
[ "$n" -gt 0 ] && [ "$code" = "404" ] && ok "Khách xem được danh mục thủ tục qua /public, không gọi được hàm của công dân" ||
  fail "Danh mục công khai trả $n thủ tục, hàm công dân qua /public trả $code"

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

code=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer ${TA}sai" "$GW/rest/dossiers")
[ "$code" = "401" ] && ok "Token bị sửa → 401" || fail "Token bị sửa phải 401, nhận $code"

[ "$FAIL" = "0" ] && echo "KẾT QUẢ: ĐẠT" || echo "KẾT QUẢ: CÓ LỖI"
exit "$FAIL"