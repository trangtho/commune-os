#!/bin/sh
# SPDX-FileCopyrightText: 2026 CommuneOS Contributors
# SPDX-License-Identifier: Apache-2.0
#
# Dựng cấu trúc cơ sở dữ liệu: lõi trước, rồi từng gói nghiệp vụ, cuối cùng các tệp 9x của lõi.
#   1. core/db/init/0*-* đến 8*-* (.sql chạy bằng psql, .sh chạy bằng sh) theo thứ tự tên tệp.
#   2. Mỗi gói trong COMMUNEOS_MODULES (cách nhau bằng dấu phẩy hoặc khoảng trắng, theo thứ tự ghi):
#      các tệp trong mục "db" của modules/<gói>/module.json, đúng thứ tự khai báo; nạp tài liệu tri thức (mục
#      "knowledge") vào kho tri thức của lõi; xong thì ghi vào core_modules.
#   3. core/db/init/9*-* (mô tả API của lõi; gói có thể đã tạo lại bảng ảo của lõi).
# Mọi tệp đều chạy lại được (idempotent); db-setup chạy script này mỗi lần make up.
# Biến: PG* (kết nối), POSTGRES_USER, POSTGRES_DB, COMMUNEOS_MODULES, CORE_DIR, MODULES_DIR.
set -eu

CORE_DIR="${CORE_DIR:-/setup/core/init}"
MODULES_DIR="${MODULES_DIR:-/setup/modules}"
MODULES=$(echo "${COMMUNEOS_MODULES:-}" | tr ',' ' ')
# Bỏ các NOTICE "đã có, bỏ qua" khi chạy lại; cảnh báo và lỗi vẫn hiện.
export PGOPTIONS="${PGOPTIONS:--c client_min_messages=warning}"

run() {
  case "$1" in
    *.sql) psql -q -v ON_ERROR_STOP=1 -f "$1" ;;
    *.sh) sh "$1" ;;
    *) echo "Bỏ qua $1 (chỉ chạy .sql, .sh)" ;;
  esac
}

echo "Lõi: $CORE_DIR"
for f in "$CORE_DIR"/[0-8]*; do run "$f"; done

for m in $MODULES; do
  case "$m" in *[!a-z0-9-]*|'') echo "Tên gói không hợp lệ: '$m'" >&2; exit 1 ;; esac
  manifest="$MODULES_DIR/$m/module.json"
  [ -f "$manifest" ] || { echo "Không có gói '$m' ($manifest)" >&2; exit 1; }
  # Đọc module.json bằng PostgreSQL (ảnh postgres không có jq): tên, phiên bản, danh sách tệp db.
  info=$(psql -At -v ON_ERROR_STOP=1 -v manifest="$(cat "$manifest")" <<'SQL'
SELECT (:'manifest'::json ->> 'name') || '|' || (:'manifest'::json ->> 'version') || '|' || (:'manifest'::json ->> 'title');
SQL
)
  name=$(echo "$info" | cut -d'|' -f1)
  [ "$name" = "$m" ] || { echo "module.json của '$m' khai báo tên '$name'" >&2; exit 1; }
  echo "Gói $m ($(echo "$info" | cut -d'|' -f2))"
  files=$(psql -At -v ON_ERROR_STOP=1 -v manifest="$(cat "$manifest")" <<'SQL'
SELECT f FROM json_array_elements_text(coalesce(:'manifest'::json -> 'db', '[]'::json)) AS f;
SQL
)
  for f in $files; do
    case "$f" in /*|*..*) echo "Đường dẫn không hợp lệ trong $manifest: $f" >&2; exit 1 ;; esac
    run "$MODULES_DIR/$m/$f"
  done
  # Tài liệu tri thức của gói (mục "knowledge": [{ "file": "kb/...md", "audience": "staff" | "public" }]) cho trợ lý AI.
  docs=$(psql -At -v ON_ERROR_STOP=1 -v manifest="$(cat "$manifest")" <<'SQL'
SELECT (k ->> 'file') || '|' || coalesce(k ->> 'audience', 'staff')
FROM json_array_elements(coalesce(:'manifest'::json -> 'knowledge', '[]'::json)) AS k;
SQL
)
  sources=""
  for d in $docs; do
    f=${d%%|*}; aud=${d#*|}
    case "$f" in /*|*..*|*,*|'') echo "Tệp tri thức không hợp lệ trong $manifest: $f" >&2; exit 1 ;; esac
    psql -q -v ON_ERROR_STOP=1 -v m="$m" -v f="$f" -v a="$aud" -v doc="$(cat "$MODULES_DIR/$m/$f")" >/dev/null <<'SQL'
SELECT public.knowledge_load_module_doc(:'m', :'f', :'a', :'doc');
SQL
    sources="${sources:+$sources,}$f"
  done
  psql -q -v ON_ERROR_STOP=1 -v m="$m" -v s="$sources" >/dev/null <<'SQL'
SELECT public.knowledge_prune_module(:'m', string_to_array(nullif(:'s', ''), ','));
SQL
  # Hàm khách chưa đăng nhập được gọi qua /public/rpc (mục "publicRpc"); rest_pre_request() chặn mọi hàm khác.
  psql -q -v ON_ERROR_STOP=1 -v m="$m" -v manifest="$(cat "$manifest")" >/dev/null <<'SQL'
SELECT public.public_rpc_sync(:'m', :'manifest'::json -> 'publicRpc');
SQL
  # Vai trò của gói (mục "roles"); identity-setup tạo vai trò "<gói>:<vai trò>" trong Keycloak.
  psql -q -v ON_ERROR_STOP=1 -v m="$m" -v manifest="$(cat "$manifest")" >/dev/null <<'SQL'
SELECT public.module_roles_sync(:'m', :'manifest'::json -> 'roles');
SQL
  psql -q -v ON_ERROR_STOP=1 -v manifest="$(cat "$manifest")" <<'SQL'
INSERT INTO core_modules (name, title, version)
VALUES (:'manifest'::json ->> 'name', :'manifest'::json ->> 'title', :'manifest'::json ->> 'version')
ON CONFLICT (name) DO UPDATE SET title = EXCLUDED.title, version = EXCLUDED.version, updated_at = now();
SQL
done

# Gói không còn trong COMMUNEOS_MODULES: chỉ xóa khỏi danh sách đã cài (và đóng hàm công khai của gói), KHÔNG xóa dữ liệu.
list=$(echo "$MODULES" | tr ' ' '\n' | sed '/^$/d' | sed "s/.*/'&'/" | paste -sd, -)
psql -q -v ON_ERROR_STOP=1 -c "DELETE FROM core_modules WHERE name NOT IN (${list:-''})"
psql -q -v ON_ERROR_STOP=1 -c "DELETE FROM core_public_rpc WHERE module <> 'core' AND module NOT IN (${list:-''})"

for f in "$CORE_DIR"/9*; do [ -e "$f" ] && run "$f"; done
psql -q -v ON_ERROR_STOP=1 -c "NOTIFY pgrst, 'reload schema'"
echo "Gói đã cài: $(psql -At -c "SELECT string_agg(name || ' ' || version, ', ' ORDER BY name) FROM core_modules")"
