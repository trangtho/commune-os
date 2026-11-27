#!/bin/sh
# SPDX-FileCopyrightText: 2026 CommuneOS Contributors
# SPDX-License-Identifier: Apache-2.0
#
# Ví dụ doanh nghiệp trên cùng lõi: "Công ty A" duyệt đơn nghỉ phép.
# Mọi bước đi đường thật Keycloak → APISIX → (orchestrator → Flowable) → PostgREST → PostgreSQL, như gói nghiệp vụ xã.
# Cần: make up, curl, python3; chạy qua make example-enterprise. Có gói xã và make demo thì kiểm tra thêm cách ly với xã A.
# Lần đầu tạo đơn vị cong-ty-a, giám đốc giamdoc.cong-ty-a, nhân viên nhanvien.cong-ty-a, trưởng phòng
# truongphong.cong-ty-a (vai trò của gói "doanh-nghiep:truong-phong") qua API của lõi
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
QT=$(token "$ADMIN_USER" "$ADMIN_PASS")
LG=$(token "$LEADER" "$PASS")
if [ -z "$LG" ]; then
  r=$(call POST "$QT" /accounts/tenants "{\"code\":\"$CODE\",\"name\":\"Công ty A\",\"modules\":[\"doanh-nghiep\"],\"leaderUsername\":\"$LEADER\",\"leaderFullName\":\"Giám đốc Công ty A\"}")
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
# Công ty A dùng gói doanh nghiệp (bật lại nếu quản trị đã tắt; đơn vị tạo ở trên đã bật sẵn).
call POST "$QT" /rest/rpc/set_tenant_module "{\"tenant_code\":\"$CODE\",\"module\":\"doanh-nghiep\",\"enabled\":true}" >/dev/null
tenant_of() { echo "$1" | cut -d. -f2 | python3 -c 'import base64,json,sys; s=sys.stdin.read().strip(); print(json.loads(base64.urlsafe_b64decode(s+"="*(-len(s)%4))).get("tenant_id",""))'; }
if [ -n "$LG" ] && [ -n "$NV" ] && [ "$(tenant_of "$LG")" = "$CODE" ] && [ "$(tenant_of "$NV")" = "$CODE" ]; then
  ok "Đơn vị Công ty A, giám đốc và nhân viên tạo qua API tài khoản của lõi; token mang đúng đơn vị"
else
  fail "Không có tài khoản Công ty A (giám đốc '${LG:+có}', nhân viên '${NV:+có}'). Đơn vị đã có từ trước với mật khẩu khác DEMO_PASSWORD?"
  echo "KẾT QUẢ: CÓ LỖI"; exit 1
fi

# 1b. Vai trò của gói (module.json "roles"): giám đốc tạo trưởng phòng, gán vai trò "doanh-nghiep:truong-phong" qua dịch vụ
#     tài khoản; không gán được vai trò của gói đơn vị không bật hay vai trò lạ; nhân viên không gán được.
TPU=truongphong.cong-ty-a
TP=$(token "$TPU" "$PASS")
if [ -z "$TP" ]; then
  r=$(call POST "$LG" /accounts/staff "{\"username\":\"$TPU\",\"firstName\":\"Trưởng phòng\",\"lastName\":\"Công ty A\"}")
  tmp=$(body_of "$r" | jfield temporaryPassword)
  [ -n "$tmp" ] && first_password "$TPU" "$tmp"
fi
TPID=$(call GET "$LG" /accounts/staff | cut -f2- | python3 -c "import json,sys
try: print(next(u['id'] for u in json.load(sys.stdin) if u['username']=='$TPU'))
except Exception: print('')")
setroles() { code_of "$(call PUT "$1" "/accounts/staff/$TPID/roles" "{\"roles\":$2}")"; }
c_xa=$(setroles "$LG" '["xa:can-bo"]'); c_nv=$(setroles "$NV" '["doanh-nghiep:truong-phong"]'); c_ok=$(setroles "$LG" '["doanh-nghiep:truong-phong"]')
TP=$(token "$TPU" "$PASS")
has_tp=$(echo "$TP" | cut -d. -f2 | python3 -c 'import base64,json,sys; s=sys.stdin.read().strip(); print("doanh-nghiep:truong-phong" in json.loads(base64.urlsafe_b64decode(s+"="*(-len(s)%4))).get("realm_access",{}).get("roles",[]))' 2>/dev/null)
nroles=$(call GET "$LG" /rest/module_roles | cut -f2- | python3 -c 'import json,sys
try: print(",".join(r["role"] for r in json.load(sys.stdin)))
except Exception: print("LOI")')
[ -n "$TPID" ] && [ "$c_xa" = "400" ] && [ "$c_nv" = "403" ] && [ "$c_ok" = "200" ] && [ "$has_tp" = "True" ] && [ "$nroles" = "doanh-nghiep:truong-phong" ] &&
  ok "Vai trò của gói: giám đốc gán doanh-nghiep:truong-phong cho trưởng phòng, token mang vai trò; vai trò gói khác bị từ chối (400); nhân viên không gán được (403)" ||
  fail "Vai trò của gói: tài khoản '$TPID', gói khác $c_xa, nhân viên gán $c_nv, gán $c_ok, token có vai trò '$has_tp', vai trò gán được '$nroles'"

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
[ "$acts" = "Chờ trưởng phòng duyệt dept_approved,rejected" ] && ok "Sơ đồ BPMN duyệt nghỉ phép trả đúng bước đầu và các nhánh (dept_approved, rejected)" ||
  fail "GET /workflow/leave-requests/<mã>/actions trả $(code_of "$r") '$acts'. Chưa make up lại sau khi thêm gói?"

code=$(code_of "$(call POST "$NV" "/workflow/leave-requests/$ID/actions" '{"action":"dept_approved"}')")
[ "$code" = "403" ] && ok "Nhân viên không tự duyệt được đơn (403)" || fail "Nhân viên duyệt đơn phải 403, nhận $code"

code=$(code_of "$(call POST "$LG" /rest/rpc/set_leave_request_status "{\"request_id\":\"$ID\",\"status\":\"approved\"}")")
[ "$code" = "403" ] && ok "Không bỏ qua được động cơ quy trình: gọi thẳng hàm đổi trạng thái bị chặn (403)" ||
  fail "Gọi thẳng set_leave_request_status phải 403, nhận $code"

# 4. Cách ly giữa các đơn vị: cán bộ xã A (gói xã, cần make demo) không thấy đơn của Công ty A, và ngược lại.
#    Bản cài không có gói xã (hoặc chưa make demo) thì bỏ qua.
TA=$(token canbo.xa-a "$PASS")
if [ -z "$TA" ]; then
  echo "  BỎ QUA  Cách ly với xã A (không có tài khoản canbo.xa-a: chưa cài gói xã hoặc chưa make demo)"
else
  n=$(call GET "$TA" "/rest/leave_requests?id=eq.$ID" | cut -f2- | python3 -c 'import json,sys
try: print(len(json.load(sys.stdin)))
except Exception: print(-1)')
  code=$(code_of "$(call GET "$TA" "/workflow/leave-requests/$ID/actions")")
  nd=$(call GET "$LG" "/rest/dossiers?select=id" | cut -f2- | python3 -c 'import json,sys
try: print(len(json.load(sys.stdin)))
except Exception: print(-1)')
  [ "$n" = "0" ] && [ "$code" = "404" ] && [ "$nd" = "0" ] &&
    ok "Xã A không thấy đơn của Công ty A (rỗng, quy trình 404); Công ty A không thấy hồ sơ của xã nào" ||
    fail "Cách ly đơn vị: xã A thấy $n đơn, quy trình trả $code; Công ty A thấy $nd hồ sơ"
fi

# 4b. Tệp đính kèm dùng chung của lõi (dịch vụ files, mục "attachments" của module.json): nhân viên đính kèm giấy tờ
#     vào đơn đang chờ duyệt; giám đốc tải về đúng nội dung; đơn vị khác không tải được; tệp giả định dạng bị từ chối.
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
printf '%%PDF-1.4\n%% Giay kham benh (mau kiem thu)\n%%%%EOF\n' > "$TMP/giay.pdf"; printf 'khong phai anh' > "$TMP/gia.png"
upload() { # upload <token> <tệp> <content-type> → "mã HTTP<TAB>nội dung"
  curl -s -w '\t%{http_code}' -X POST -H "Authorization: Bearer $1" -H "Content-Type: $3" --data-binary @"$2" \
    "$GW/files/leave-requests/$ID/attachments?name=giay-kham-benh.pdf" | python3 -c 'import sys; b,_,c=sys.stdin.read().rpartition("\t"); print(c+"\t"+b)'
}
r=$(upload "$NV" "$TMP/giay.pdf" application/pdf); AID=$(body_of "$r" | jfield id)
fake=$(code_of "$(upload "$NV" "$TMP/gia.png" image/png)")
n=$(call GET "$LG" "/files/leave-requests/$ID/attachments" | cut -f2- | python3 -c 'import json,sys
try: print(len(json.load(sys.stdin)))
except Exception: print(-1)')
got=$(curl -s -H "Authorization: Bearer $LG" "$GW/files/attachments/$AID" | sha256sum | cut -d' ' -f1)
want=$(sha256sum "$TMP/giay.pdf" | cut -d' ' -f1)
[ "$(code_of "$r")" = "201" ] && [ "$fake" = "415" ] && [ "$n" = "1" ] && [ "$got" = "$want" ] &&
  ok "Tệp đính kèm dùng chung: nhân viên đính kèm vào đơn, giám đốc thấy và tải về đúng nội dung (SHA-256 khớp); tệp giả định dạng bị từ chối (415)" ||
  fail "Đính kèm: tải lên $(code_of "$r"), tệp giả $fake, giám đốc thấy $n tệp, mã băm khớp $( [ "$got" = "$want" ] && echo có || echo không)"
if [ -n "$TA" ]; then
  c1=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $TA" "$GW/files/attachments/$AID")
  c2=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $TA" "$GW/files/leave-requests/$ID/attachments")
  [ "$c1" = "404" ] && [ "$c2" = "404" ] && ok "Cán bộ xã A không xem, không tải được tệp của Công ty A (404)" ||
    fail "Tệp của Công ty A với cán bộ xã A: tải $c1, danh sách $c2"
fi

# 5. Hai bước duyệt qua quy trình: trưởng phòng rồi giám đốc; giám đốc không bỏ qua được bước trưởng phòng; trưởng phòng
#    không duyệt được bước của giám đốc; kết thúc rồi không xử lý tiếp được.
act() { call POST "$1" "/workflow/leave-requests/$ID/actions" "$2"; }
skip=$(code_of "$(act "$LG" '{"action":"approved"}')")
r1=$(act "$TP" '{"action":"dept_approved","note":"Phòng đã sắp xếp người thay"}'); s1=$(body_of "$r1" | jfield status)
step2=$(call GET "$NV" "/workflow/leave-requests/$ID/actions" | cut -f2- | python3 -c 'import json,sys
try: d=json.load(sys.stdin); print(d.get("step"), ",".join(sorted(d.get("actions",[]))))
except Exception: print("")')
tp2=$(code_of "$(act "$TP" '{"action":"approved"}')")
[ "$skip" = "409" ] && [ "$(code_of "$r1")" = "200" ] && [ "$s1" = "dept_approved" ] && [ "$step2" = "Chờ giám đốc duyệt approved,rejected" ] && [ "$tp2" = "403" ] &&
  ok "Trưởng phòng duyệt bước đầu (vai trò của gói); giám đốc không bỏ qua được bước này (409); trưởng phòng không duyệt thay giám đốc (403)" ||
  fail "Bước trưởng phòng: giám đốc bỏ qua $skip, trưởng phòng duyệt $(code_of "$r1") '$s1', bước sau '$step2', trưởng phòng duyệt bước 2 $tp2"
code=$(code_of "$(act "$LG" '{"action":"rejected"}')")
r=$(act "$LG" '{"action":"approved","note":"Đồng ý"}')
st=$(body_of "$r" | jfield status)
again=$(code_of "$(act "$LG" '{"action":"rejected","note":"Đổi ý"}')")
seen=$(call GET "$NV" "/rest/leave_requests?id=eq.$ID&select=status,decided_by" | cut -f2- | python3 -c 'import json,sys
try: d=json.load(sys.stdin); print(d[0]["status"] if d else "")
except Exception: print("")')
[ "$code" = "400" ] && [ "$(code_of "$r")" = "200" ] && [ "$st" = "approved" ] && [ "$again" = "409" ] && [ "$seen" = "approved" ] &&
  ok "Không đồng ý mà thiếu lý do bị chặn (400); giám đốc duyệt bước cuối, nhân viên thấy kết quả; đơn đã kết thúc không xử lý lại (409)" ||
  fail "Duyệt: thiếu lý do $code, duyệt $(code_of "$r") '$st', xử lý lại $again, nhân viên thấy '$seen'"

late=$(code_of "$(upload "$NV" "$TMP/giay.pdf" application/pdf)")
[ "$late" = "409" ] && ok "Đơn đã duyệt không nhận thêm tệp (409, uploadStatuses của gói)" || fail "Đính kèm sau khi duyệt phải 409, nhận $late"

# 6. Sổ ghi nhận của lõi: chuỗi riêng của Công ty A, nguyên vẹn, có đủ các bước của đơn (cả tệp đính kèm).
steps=$(call GET "$LG" "/rest/ledger?dossier_id=eq.$ID&select=action&order=seq" | cut -f2- | python3 -c 'import json,sys
try: print(",".join(r["action"] for r in json.load(sys.stdin)))
except Exception: print("")')
chain=$(call POST "$LG" /rest/rpc/verify_ledger "{\"only_tenant\":\"$CODE\"}" | cut -f2- | python3 -c 'import json,sys
try: d=json.load(sys.stdin); print(d[0]["ok"] if len(d)==1 else "")
except Exception: print("")')
[ "$steps" = "submitted,attachment,dept_approved,approved" ] && [ "$chain" = "True" ] &&
  ok "Sổ ghi nhận của lõi ghi đủ các bước của đơn (nộp, đính kèm tệp, trưởng phòng duyệt, giám đốc duyệt), chuỗi băm của Công ty A nguyên vẹn" ||
  fail "Sổ ghi nhận: các bước '$steps', chuỗi nguyên vẹn '$chain'"

# 7. Gói theo đơn vị: Công ty A chỉ dùng gói doanh nghiệp, không dùng được chức năng của gói xã.
mods=$(call POST "$LG" /rest/rpc/my_modules '{}' | cut -f2- | python3 -c 'import json,sys
try: print(",".join(json.load(sys.stdin)))
except Exception: print("LOI")')
if echo "$(curl -s "$GW/public/rpc/public_platform")" | grep -q '"name" : "xa"\|"name":"xa"'; then
  reg=$(call POST - /public/rpc/public_registration_tenants '{}' | cut -f2- | python3 -c 'import json,sys
try: print(",".join(t["code"] for t in json.load(sys.stdin)))
except Exception: print("LOI")')
  np=$(call GET "$LG" "/rest/procedures?select=id" | cut -f2- | python3 -c 'import json,sys
try: print(len(json.load(sys.stdin)))
except Exception: print(-1)')
  open=$(code_of "$(call POST "$QT" /rest/rpc/set_tenant_procedures "{\"tenant_code\":\"$CODE\",\"procedure_ids\":[\"khai-sinh\"],\"enabled\":true}")")
  case ",$reg," in *",$CODE,"*) inreg=1 ;; *) inreg=0 ;; esac
  [ "$mods" = "doanh-nghiep" ] && [ "$inreg" = "0" ] && [ "$np" = "0" ] && [ "$open" = "400" ] &&
    ok "Công ty A chỉ dùng gói doanh nghiệp: không có trong danh sách đăng ký công dân, không thấy thủ tục, không mở được thủ tục xã (400)" ||
    fail "Gói theo đơn vị: gói '$mods', trong danh sách đăng ký $inreg, thấy $np thủ tục, mở thủ tục trả $open"
else
  [ "$mods" = "doanh-nghiep" ] && ok "Công ty A chỉ dùng gói doanh nghiệp (my_modules)" || fail "Gói của Công ty A: '$mods'"
fi

# 8. Tắt gói doanh nghiệp cho Công ty A: API của gói không trả gì, không nộp được đơn; bật lại thì thấy lại đơn cũ.
setmod() { code_of "$(call POST "$QT" /rest/rpc/set_tenant_module "{\"tenant_code\":\"$CODE\",\"module\":\"doanh-nghiep\",\"enabled\":$1}")"; }
count() { call GET "$LG" "/rest/leave_requests?id=eq.$ID" | cut -f2- | python3 -c 'import json,sys
try: print(len(json.load(sys.stdin)))
except Exception: print(-1)'; }
off=$(setmod false); n_off=$(count)
c_off=$(code_of "$(call POST "$NV" /rest/rpc/leave_request_create '{"from_date":"2026-12-28","to_date":"2026-12-28","reason":"Thử khi tắt gói"}')")
on=$(setmod true); n_on=$(count)
bad=$(code_of "$(call POST "$QT" /rest/rpc/set_tenant_module "{\"tenant_code\":\"$CODE\",\"module\":\"khong-co\",\"enabled\":true}")")
[ "$off" = "200" ] && [ "$n_off" = "0" ] && [ "$c_off" = "403" ] && [ "$on" = "200" ] && [ "$n_on" = "1" ] && [ "$bad" = "400" ] &&
  ok "Tắt gói cho Công ty A: không thấy đơn, không nộp được (403); bật lại thấy lại đơn; không bật được gói chưa cài (400)" ||
  fail "Tắt/bật gói: tắt $off (thấy $n_off đơn, nộp $c_off), bật $on (thấy $n_on đơn), gói chưa cài $bad"

# 9. Kho tri thức dùng chung của lõi (trợ lý AI): tài liệu của gói (kb/quy-che-nghi-phep.md, nạp khi cài gói) và tài
#    liệu riêng do giám đốc nạp; chỉ người của đơn vị dùng gói thấy; không gọi thẳng được hàm tìm kiếm của trợ lý.
kdocs() { call GET "$1" "/rest/knowledge_documents?select=module,scope,title" | cut -f2- | python3 -c "import json,sys
try: d=json.load(sys.stdin); print(sum(1 for x in d if x['module']=='doanh-nghiep' and x['scope']=='$2'))
except Exception: print(-1)"; }
r=$(call POST "$LG" /rest/rpc/knowledge_add '{"module":"doanh-nghiep","title":"Quy định làm thêm giờ của Công ty A","content":"## Đăng ký làm thêm giờ\nNhân viên đăng ký làm thêm giờ với giám đốc trước 16 giờ cùng ngày; làm thêm giờ ngày thường được trả 150% lương giờ."}')
DOC=$(body_of "$r" | jfield document)
g=$(kdocs "$NV" goi); u=$(kdocs "$NV" don-vi)
c_nv=$(code_of "$(call POST "$NV" /rest/rpc/knowledge_add '{"module":"doanh-nghiep","title":"Thử","content":"Nhân viên không được nạp tài liệu"}')")
c_direct=$(code_of "$(call POST "$LG" /rest/rpc/core_knowledge_search '{"p_query":"nghỉ phép","p_tenant_code":"cong-ty-a","p_audience":"staff"}')")
xa_seen=0; [ -n "$TA" ] && xa_seen=$(kdocs "$TA" goi)
[ "$(code_of "$r")" = "200" ] && [ "$g" -ge 4 ] && [ "$u" -ge 1 ] && [ "$c_nv" = "403" ] && [ "$c_direct" = "403" ] && [ "$xa_seen" = "0" ] &&
  ok "Kho tri thức của lõi: quy chế của gói ($g mục) và tài liệu giám đốc nạp ($u mục); nhân viên không nạp được (403); xã A không thấy; không gọi thẳng được hàm tìm kiếm (403)" ||
  fail "Kho tri thức: nạp $(code_of "$r"), mục của gói $g, của đơn vị $u, nhân viên nạp $c_nv, gọi thẳng $c_direct, xã A thấy $xa_seen"

# 9b. Trợ lý AI (chỉ khi dịch vụ AI chạy, có mô hình): trả lời từ đúng tài liệu của Công ty A, không lẫn sang đơn vị khác.
if [ "$(curl -s "$GW/public/ai/ready" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("ready", False))' 2>/dev/null)" = "True" ]; then
  srcs() { curl -s -m 120 -X POST -H "Authorization: Bearer $1" -H 'Content-Type: application/json' -d "{\"question\":\"$2\",\"select\":false}" "$GW/ai/ask" |
    python3 -c 'import json,sys
try: print(",".join((c.get("source_type") or "")+":"+(c.get("field") or "") for c in json.load(sys.stdin).get("chunks",[])))
except Exception: print("LOI")'; }
  a1=$(srcs "$NV" "Nghỉ ốm hai ngày cần nộp giấy tờ gì"); a2=$(srcs "$NV" "Làm thêm giờ ngày thường được trả bao nhiêu")
  a3=""; [ -n "$TA" ] && a3=$(srcs "$TA" "Nghỉ ốm hai ngày cần nộp giấy tờ gì")
  case "$a1" in module_doc:doanh-nghiep*) t1=1 ;; *) t1=0 ;; esac
  case "$a2" in *tenant_doc:doanh-nghiep*) t2=1 ;; *) t2=0 ;; esac
  case "$a3" in *doanh-nghiep*) t3=0 ;; *) t3=1 ;; esac
  [ "$t1" = "1" ] && [ "$t2" = "1" ] && [ "$t3" = "1" ] &&
    ok "Trợ lý AI: nhân viên Công ty A hỏi quy chế thì trích quy chế của gói, hỏi quy định riêng thì trích tài liệu của Công ty A; cán bộ xã A không thấy" ||
    fail "Trợ lý AI: nghỉ ốm '$a1', làm thêm giờ '$a2', xã A '$a3'"
else
  echo "  BỎ QUA  Trợ lý AI chưa chạy hoặc chưa có mô hình (kho tri thức vẫn được kiểm tra ở trên)"
fi
[ -n "$DOC" ] && call POST "$LG" /rest/rpc/knowledge_remove "{\"document\":\"$DOC\"}" >/dev/null

[ "$FAIL" = "0" ] && echo "KẾT QUẢ: ĐẠT" || { echo "KẾT QUẢ: CÓ LỖI"; exit 1; }
