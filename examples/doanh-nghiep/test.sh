#!/bin/sh
# SPDX-FileCopyrightText: 2026 CommuneOS Contributors
# SPDX-License-Identifier: Apache-2.0
#
# Ví dụ doanh nghiệp trên cùng lõi: "Công ty A" duyệt đơn nghỉ phép.
# Mọi bước đi đường thật Keycloak → APISIX → (orchestrator → Flowable) → PostgREST → PostgreSQL, như gói nghiệp vụ xã.
# Cần: make up, make demo (dùng cán bộ xã A để kiểm tra cách ly), curl, python3; chạy qua make example-enterprise.
# Lần đầu tạo đơn vị cong-ty-a, giám đốc giamdoc.cong-ty-a, nhân viên nhanvien.cong-ty-a qua API của lõi
# (mật khẩu DEMO_PASSWORD, mặc định Demo@2026!); các lần sau dùng lại.
set -u

KC="${KEYCLOAK_URL:-http://localhost:8080}"
GW="${GATEWAY_URL:-http://localhost:${GATEWAY_PORT:-9080}}"
PASS="${DEMO_PASSWORD:-Demo@2026!}"
from_env() { sed -n "s/^$1=//p" .env 2>/dev/null | tail -1; }
ADMIN_USER="${COMMUNEOS_ADMIN_USERNAME:-$(from_env COMMUNEOS_ADMIN_USERNAME)}"
ADMIN_PASS="${COMMUNEOS_ADMIN_PASSWORD:-$(from_env COMMUNEOS_ADMIN_PASSWORD)}"
CODE=cong-ty-a; LEADER=giamdoc.cong-ty-a; STAFF=nhanvien.cong-ty-a
FAIL=0

ok()   { echo "  ĐẠT  $1"; }
fail() { echo "  LỖI  $1"; FAIL=1; }
jfield() { python3 -c "import json,sys
try: print(json.load(sys.stdin).get('$1') or '')
except Exception: print('')"; }
token() { # token <tên đăng nhập> <mật khẩu>
  curl -s -X POST "$KC/realms/communeos/protocol/openid-connect/token" \
    -d grant_type=password -d client_id=commune-app --data-urlencode username="$1" --data-urlencode password="$2" | jfield access_token
}
call() { # call <GET|POST> <token|-> <đường dẫn> [json] → in "mã HTTP<TAB>nội dung"
  auth=""; [ "$2" != "-" ] && auth="Authorization: Bearer $2"
  if [ -n "${4:-}" ]; then
    curl -s -w '\t%{http_code}' -X "$1" -H "$auth" -H 'Content-Type: application/json' -d "$4" "$GW$3"
  else
    curl -s -w '\t%{http_code}' -X "$1" -H "$auth" "$GW$3"
  fi | python3 -c 'import sys; b,_,c=sys.stdin.read().rpartition("\t"); print(c+"\t"+b)'
}
code_of() { echo "$1" | cut -f1; }
body_of() { echo "$1" | cut -f2-; }
first_password() { # first_password <tên đăng nhập> <mật khẩu tạm>
  call POST - /accounts/first-password "{\"username\":\"$1\",\"currentPassword\":\"$2\",\"newPassword\":\"$PASS\"}" >/dev/null
}

echo "Ví dụ doanh nghiệp trên cùng lõi: Công ty A duyệt đơn nghỉ phép ($GW)"

# 1. Đơn vị và tài khoản: dùng đúng API của lõi như khi tạo xã (dịch vụ accounts, Keycloak).
LG=$(token "$LEADER" "$PASS")
if [ -z "$LG" ]; then
  QT=$(token "$ADMIN_USER" "$ADMIN_PASS")
  r=$(call POST "$QT" /accounts/tenants "{\"code\":\"$CODE\",\"name\":\"Công ty A\",\"leaderUsername\":\"$LEADER\",\"leaderFullName\":\"Giám đốc Công ty A\"}")
  tmp=$(body_of "$r" | python3 -c 'import json,sys
try: print(json.load(sys.stdin).get("leader",{}).get("temporaryPassword",""))
except Exception: print("")')
  [ -n "$tmp" ] && first_password "$LEADER" "$tmp"
  LG=$(token "$LEADER" "$PASS")
fi
NV=$(token "$STAFF" "$PASS")
if [ -z "$NV" ] && [ -n "$LG" ]; then
  r=$(call POST "$LG" /accounts/staff "{\"username\":\"$STAFF\",\"firstName\":\"Nhân viên\",\"lastName\":\"Công ty A\"}")
  tmp=$(body_of "$r" | jfield temporaryPassword)
  [ -n "$tmp" ] && first_password "$STAFF" "$tmp"
  NV=$(token "$STAFF" "$PASS")
fi
tenant_of() { echo "$1" | cut -d. -f2 | python3 -c 'import base64,json,sys; s=sys.stdin.read().strip(); print(json.loads(base64.urlsafe_b64decode(s+"="*(-len(s)%4))).get("tenant_id",""))'; }
if [ -n "$LG" ] && [ -n "$NV" ] && [ "$(tenant_of "$LG")" = "$CODE" ] && [ "$(tenant_of "$NV")" = "$CODE" ]; then
  ok "Đơn vị Công ty A, giám đốc và nhân viên tạo qua API tài khoản của lõi; token mang đúng đơn vị"
else
  fail "Không có tài khoản Công ty A (giám đốc '${LG:+có}', nhân viên '${NV:+có}'). Đơn vị đã có từ trước với mật khẩu khác DEMO_PASSWORD?"
  echo "KẾT QUẢ: CÓ LỖI"; exit 1
fi

# 2. Nhân viên nộp đơn (API dữ liệu /rest, RLS theo đơn vị).
r=$(call POST "$NV" /rest/rpc/leave_request_create '{"from_date":"2026-12-21","to_date":"2026-12-23","reason":"Về quê có việc gia đình"}')
ID=$(body_of "$r" | jfield id)
[ "$(code_of "$r")" = "200" ] && [ -n "$ID" ] && ok "Nhân viên nộp đơn nghỉ phép qua /rest ($ID)" ||
  fail "Nộp đơn phải 200, nhận $(code_of "$r"): $(body_of "$r")"

# 3. Quy trình BPMN của gói (workflow.json + bpmn/duyet-nghi-phep) chạy trên dịch vụ điều phối của lõi.
r=$(call GET "$NV" "/workflow/leave-requests/$ID/actions")
acts=$(body_of "$r" | python3 -c 'import json,sys
try: d=json.load(sys.stdin); print(d.get("step"), ",".join(sorted(d.get("actions",[]))))
except Exception: print("")')
[ "$acts" = "Chờ giám đốc duyệt approved,rejected" ] && ok "Sơ đồ BPMN duyệt nghỉ phép trả đúng bước và các nhánh (approved, rejected)" ||
  fail "GET /workflow/leave-requests/<mã>/actions trả $(code_of "$r") '$acts'. Chưa make up lại sau khi thêm gói?"

code=$(code_of "$(call POST "$NV" "/workflow/leave-requests/$ID/actions" '{"action":"approved"}')")
[ "$code" = "403" ] && ok "Nhân viên không tự duyệt được đơn (403)" || fail "Nhân viên duyệt đơn phải 403, nhận $code"

code=$(code_of "$(call POST "$LG" /rest/rpc/set_leave_request_status "{\"request_id\":\"$ID\",\"status\":\"approved\"}")")
[ "$code" = "403" ] && ok "Không bỏ qua được động cơ quy trình: gọi thẳng hàm đổi trạng thái bị chặn (403)" ||
  fail "Gọi thẳng set_leave_request_status phải 403, nhận $code"

# 4. Cách ly giữa các đơn vị: cán bộ xã A (gói nghiệp vụ xã) không thấy đơn của Công ty A, và ngược lại.
TA=$(token canbo.xa-a "$PASS")
n=$(call GET "$TA" "/rest/leave_requests?id=eq.$ID" | cut -f2- | python3 -c 'import json,sys
try: print(len(json.load(sys.stdin)))
except Exception: print(-1)')
code=$(code_of "$(call GET "$TA" "/workflow/leave-requests/$ID/actions")")
nd=$(call GET "$LG" "/rest/dossiers?select=id" | cut -f2- | python3 -c 'import json,sys
try: print(len(json.load(sys.stdin)))
except Exception: print(-1)')
[ -n "$TA" ] && [ "$n" = "0" ] && [ "$code" = "404" ] && [ "$nd" = "0" ] &&
  ok "Xã A không thấy đơn của Công ty A (rỗng, quy trình 404); Công ty A không thấy hồ sơ của xã nào" ||
  fail "Cách ly đơn vị: xã A thấy $n đơn, quy trình trả $code; Công ty A thấy $nd hồ sơ (cần make demo)"

# 5. Giám đốc duyệt qua quy trình; kết thúc rồi không xử lý tiếp được.
code=$(code_of "$(call POST "$LG" "/workflow/leave-requests/$ID/actions" '{"action":"rejected"}')")
r=$(call POST "$LG" "/workflow/leave-requests/$ID/actions" '{"action":"approved","note":"Đồng ý"}')
st=$(body_of "$r" | jfield status)
again=$(code_of "$(call POST "$LG" "/workflow/leave-requests/$ID/actions" '{"action":"rejected","note":"Đổi ý"}')")
seen=$(call GET "$NV" "/rest/leave_requests?id=eq.$ID&select=status,decided_by" | cut -f2- | python3 -c 'import json,sys
try: d=json.load(sys.stdin); print(d[0]["status"] if d else "")
except Exception: print("")')
[ "$code" = "400" ] && [ "$(code_of "$r")" = "200" ] && [ "$st" = "approved" ] && [ "$again" = "409" ] && [ "$seen" = "approved" ] &&
  ok "Không đồng ý mà thiếu lý do bị chặn (400); giám đốc duyệt qua quy trình, nhân viên thấy kết quả; đơn đã kết thúc không xử lý lại (409)" ||
  fail "Duyệt: thiếu lý do $code, duyệt $(code_of "$r") '$st', xử lý lại $again, nhân viên thấy '$seen'"

# 6. Sổ ghi nhận của lõi: chuỗi riêng của Công ty A, nguyên vẹn, có đủ hai bước của đơn.
steps=$(call GET "$LG" "/rest/ledger?dossier_id=eq.$ID&select=action&order=seq" | cut -f2- | python3 -c 'import json,sys
try: print(",".join(r["action"] for r in json.load(sys.stdin)))
except Exception: print("")')
chain=$(call POST "$LG" /rest/rpc/verify_ledger "{\"only_tenant\":\"$CODE\"}" | cut -f2- | python3 -c 'import json,sys
try: d=json.load(sys.stdin); print(d[0]["ok"] if len(d)==1 else "")
except Exception: print("")')
[ "$steps" = "submitted,approved" ] && [ "$chain" = "True" ] &&
  ok "Sổ ghi nhận của lõi ghi đủ các bước của đơn, chuỗi băm của Công ty A nguyên vẹn" ||
  fail "Sổ ghi nhận: các bước '$steps', chuỗi nguyên vẹn '$chain'"

[ "$FAIL" = "0" ] && echo "KẾT QUẢ: ĐẠT" || { echo "KẾT QUẢ: CÓ LỖI"; exit 1; }
