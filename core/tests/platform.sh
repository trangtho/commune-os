#!/bin/sh
# SPDX-FileCopyrightText: 2026 CommuneOS Contributors
# SPDX-License-Identifier: Apache-2.0
#
# Kiểm thử phần lõi dùng chung qua đường thật Keycloak → APISIX → PostgREST → PostgreSQL. Không dùng dữ liệu của
# gói nào, nên chạy được cả trên bản cài chỉ có lõi (COMMUNEOS_MODULES không có "xa"; CI chạy cách này).
# Cần: docker compose up đang chạy, curl, python3; tài khoản quản trị hệ thống và quản trị Keycloak trong .env.
set -u

KC="${KEYCLOAK_URL:-http://localhost:8080}"
GW="${GATEWAY_URL:-http://localhost:${GATEWAY_PORT:-9080}}"
COMPOSE="${COMPOSE:-docker compose}"
from_env() { sed -n "s/^$1=//p" .env 2>/dev/null | tail -1; }
ADMIN_USER="${COMMUNEOS_ADMIN_USERNAME:-$(from_env COMMUNEOS_ADMIN_USERNAME)}"
ADMIN_PASS="${COMMUNEOS_ADMIN_PASSWORD:-$(from_env COMMUNEOS_ADMIN_PASSWORD)}"
MODULES="${COMMUNEOS_MODULES:-$(from_env COMMUNEOS_MODULES)}"
MODULES=$(echo "${MODULES:-xa,doanh-nghiep}" | tr ', ' '\n\n' | sed '/^$/d' | sort | paste -sd, -)
FAIL=0

ok()   { echo "  ĐẠT  $1"; }
fail() { echo "  LỖI  $1"; FAIL=1; }
jget() { python3 -c "import json,sys
try:
  d=json.load(sys.stdin); print($1)
except Exception: print('')"; }
token() {
  curl -s -X POST "$KC/realms/communeos/protocol/openid-connect/token" -d grant_type=password -d client_id=commune-app \
    --data-urlencode username="$1" --data-urlencode password="$2" | jget 'd.get("access_token","")'
}
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
sql() { $COMPOSE exec -T db sh -c 'psql -At -U "$POSTGRES_USER" -d "$POSTGRES_DB"' ; }

echo "Kiểm thử lõi dùng chung ($GW), gói cần có: $MODULES"

# 1. Gói đã cài: đúng danh sách COMMUNEOS_MODULES; xem được khi chưa đăng nhập (cổng dùng để kiểm tra sức khỏe).
got=$(curl -s "$GW/public/rpc/public_platform" | jget '",".join(sorted(m["name"] for m in d["modules"]))')
[ "$got" = "$MODULES" ] && ok "Gói đã cài khớp COMMUNEOS_MODULES ($got), xem công khai qua /public/rpc/public_platform" ||
  fail "Gói đã cài '$got', cần '$MODULES'"

# 2. Không có token thì không đọc được API dữ liệu; quản trị hệ thống đọc được danh sách gói, đơn vị.
QT=$(token "$ADMIN_USER" "$ADMIN_PASS")
c1=$(code "$GW/rest/tenants"); c2=$(code -H "Authorization: Bearer $QT" "$GW/rest/modules")
c3=$(code -H "Authorization: Bearer $QT" "$GW/rest/tenants")
[ "$c1" = "401" ] && [ "$c2" = "200" ] && [ "$c3" = "200" ] &&
  ok "Không token bị chặn (401); quản trị hệ thống đọc được /rest/modules, /rest/tenants" ||
  fail "Không token $c1, modules $c2, tenants $c3"

# 3. Đơn vị: quản trị tạo đơn vị kèm lãnh đạo qua dịch vụ tài khoản; token của lãnh đạo mang đúng đơn vị; đơn vị khác
#    không thấy nhau; hủy được đơn vị vừa tạo.
post() { curl -s -w '\t%{http_code}' -X POST -H "Authorization: Bearer $1" -H 'Content-Type: application/json' -d "$3" "$GW$2" |
  python3 -c 'import sys; b,_,c=sys.stdin.read().rpartition("\t"); print(c+"\t"+b)'; }
T="dv-kt-$(date +%s)"; L="ld.$T"; M1=$(echo "$MODULES" | cut -d, -f1)
r=$(post "$QT" /accounts/tenants "{\"code\":\"$T\",\"name\":\"Đơn vị kiểm thử\",\"modules\":[\"$M1\"],\"leaderUsername\":\"$L\",\"leaderFullName\":\"Kiểm Thử\"}")
tmp=$(echo "$r" | cut -f2- | jget 'd.get("leader",{}).get("temporaryPassword","")')
curl -s -o /dev/null -X POST -H 'Content-Type: application/json' \
  -d "{\"username\":\"$L\",\"currentPassword\":\"$tmp\",\"newPassword\":\"KiemThu2026x\"}" "$GW/accounts/first-password"
LT=$(token "$L" KiemThu2026x)
claim=$(echo "$LT" | cut -d. -f2 | python3 -c 'import base64,json,sys; s=sys.stdin.read().strip(); print(json.loads(base64.urlsafe_b64decode(s+"="*(-len(s)%4))).get("tenant_id",""))' 2>/dev/null)
seen=$(curl -s -H "Authorization: Bearer $LT" "$GW/rest/tenants?select=code" | jget '",".join(t["code"] for t in d)')
[ "$(echo "$r" | cut -f1)" = "201" ] && [ "$claim" = "$T" ] && [ "$seen" = "$T" ] &&
  ok "Tạo đơn vị kèm lãnh đạo qua API tài khoản; token mang đúng đơn vị; lãnh đạo chỉ thấy đơn vị mình" ||
  fail "Tạo đơn vị: $(echo "$r" | cut -f1), đơn vị trong token '$claim', thấy '$seen'"

# 3b. Gói theo đơn vị: đơn vị chỉ dùng gói được bật lúc tạo; tắt được; không bật được gói chưa cài.
mods() { curl -s -X POST -H "Authorization: Bearer $1" -H 'Content-Type: application/json' -d '{}' "$GW/rest/rpc/my_modules" | jget '",".join(d)'; }
setm() { curl -s -o /dev/null -w '%{http_code}' -X POST -H "Authorization: Bearer $1" -H 'Content-Type: application/json' \
  -d "{\"tenant_code\":\"$T\",\"module\":\"$2\",\"enabled\":$3}" "$GW/rest/rpc/set_tenant_module"; }
m1=$(mods "$LT"); c1=$(setm "$QT" "$M1" false); m2=$(mods "$LT"); c2=$(setm "$QT" khong-co true); c3=$(setm "$LT" "$M1" true)
[ "$m1" = "$M1" ] && [ "$c1" = "200" ] && [ "$m2" = "" ] && [ "$c2" = "400" ] && [ "$c3" = "403" ] &&
  ok "Gói theo đơn vị: đơn vị mới dùng đúng gói chọn khi tạo ($M1); tắt được; gói chưa cài bị từ chối (400); lãnh đạo không tự bật gói (403)" ||
  fail "Gói theo đơn vị: lúc tạo '$m1', tắt $c1 → '$m2', gói chưa cài $c2, lãnh đạo tự bật $c3"

# 4. Sổ ghi nhận: chuỗi của mọi đơn vị nguyên vẹn; không sửa được qua API.
bad=$(curl -s -X POST -H "Authorization: Bearer $QT" -H 'Content-Type: application/json' -d '{}' "$GW/rest/rpc/verify_ledger" |
  jget '",".join(r["tenant_code"] for r in d if not r["ok"]) if isinstance(d,list) else "LOI"')
c=$(code -X DELETE -H "Authorization: Bearer $QT" "$GW/rest/ledger?seq=eq.1")
[ "$bad" = "" ] && [ "$c" != "200" ] && [ "$c" != "204" ] && ok "Sổ ghi nhận của mọi đơn vị nguyên vẹn; không xóa được qua API" ||
  fail "Sổ ghi nhận hỏng ở '$bad', xóa qua API trả $c"

# 5. Quy trình: loại đối tượng chưa khai báo trong gói nào → 404; dịch vụ điều phối và Flowable chạy.
c1=$(code -H "Authorization: Bearer $QT" "$GW/workflow/khong-co/1/actions"); c2=$(code -H "Authorization: Bearer $QT" "$GW/workflow/health")
[ "$c1" = "404" ] && [ "$c2" = "200" ] && ok "Quy trình: loại chưa khai báo trả 404; dịch vụ điều phối, Flowable chạy" ||
  fail "Quy trình: loại lạ $c1, health $c2"

# 5b. Tệp đính kèm: loại đối tượng chưa khai báo trong gói nào → 404; không token → 401; gọi thẳng hàm ghi tệp bị chặn.
c1=$(code -X POST -H "Authorization: Bearer $QT" -H 'Content-Type: application/pdf' --data-binary '%PDF-1.4' "$GW/files/khong-co/1/attachments")
c2=$(code "$GW/files/attachments/00000000-0000-0000-0000-000000000000")
c3=$(code -X POST -H "Authorization: Bearer $LT" -H 'Content-Type: application/json' \
  -d '{"module":"x","resource":"x","ref_id":"1","original_name":"a","mime_type":"application/pdf","size_bytes":1,"sha256":"0","storage_key":"x"}' \
  "$GW/rest/rpc/attachment_register")
[ "$c1" = "404" ] && [ "$c2" = "401" ] && [ "$c3" = "403" ] &&
  ok "Tệp đính kèm: loại chưa khai báo trả 404; không token 401; gọi thẳng hàm ghi tệp bị chặn (403)" ||
  fail "Tệp đính kèm: loại lạ $c1, không token $c2, gọi thẳng $c3"

# 5c. Kho tri thức của lõi: người của đơn vị đọc được danh sách tài liệu; hàm tìm kiếm, tạo vector chỉ cho ai-gateway.
c1=$(code -H "Authorization: Bearer $QT" "$GW/rest/knowledge_documents")
c2=$(code -X POST -H "Authorization: Bearer $QT" -H 'Content-Type: application/json' -d '{"p_query":"x"}' "$GW/rest/rpc/core_knowledge_search")
c3=$(code -X POST -H "Authorization: Bearer $QT" -H 'Content-Type: application/json' -d '{"p_model":"x"}' "$GW/rest/rpc/core_knowledge_pending")
[ "$c1" = "200" ] && [ "$c2" = "403" ] && [ "$c3" = "403" ] &&
  ok "Kho tri thức: /rest/knowledge_documents đọc được; tìm kiếm, tạo vector chỉ dịch vụ AI gọi được (403)" ||
  fail "Kho tri thức: danh sách $c1, tìm kiếm $c2, tạo vector $c3"

# 6. Không cài gói xã thì lõi không có bảng, API nào của gói xã.
case ",$MODULES," in
  *,xa,*) echo "  BỎ QUA  Lõi không chứa bảng của gói xã (gói xã đang được cài)" ;;
  *)
    tables=$(echo "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename IN ('citizens','procedures','applications','application_events')" | sql)
    c=$(code -H "Authorization: Bearer $QT" "$GW/rest/dossiers")
    [ "$tables" = "0" ] && [ "$c" = "404" ] && ok "Không cài gói xã: không có bảng công dân, thủ tục, hồ sơ; /rest/dossiers không tồn tại (404)" ||
      fail "Không cài gói xã mà còn $tables bảng của gói xã, /rest/dossiers trả $c"
    ;;
esac

# Dọn: xóa tài khoản lãnh đạo (quản trị Keycloak trong .env), hủy đơn vị vừa tạo.
KA=$(curl -s -X POST "$KC/realms/master/protocol/openid-connect/token" -d grant_type=password -d client_id=admin-cli \
  --data-urlencode username="${KEYCLOAK_ADMIN:-$(from_env KEYCLOAK_ADMIN)}" \
  --data-urlencode password="${KEYCLOAK_ADMIN_PASSWORD:-$(from_env KEYCLOAK_ADMIN_PASSWORD)}" | jget 'd.get("access_token","")')
uid=$(curl -s -H "Authorization: Bearer $KA" "$KC/admin/realms/communeos/users?exact=true&username=$L" | jget 'd[0]["id"] if d else ""')
[ -n "$uid" ] && curl -s -o /dev/null -X DELETE -H "Authorization: Bearer $KA" "$KC/admin/realms/communeos/users/$uid"
c=$(code -X POST -H "Authorization: Bearer $QT" -H 'Content-Type: application/json' -d "{\"p_code\":\"$T\"}" "$GW/rest/rpc/remove_new_tenant")
[ "$c" = "200" ] && ok "Hủy được đơn vị vừa tạo (chưa có dữ liệu)" || fail "Hủy đơn vị vừa tạo trả $c"

[ "$FAIL" = "0" ] && echo "KẾT QUẢ: ĐẠT" || { echo "KẾT QUẢ: CÓ LỖI"; exit 1; }
