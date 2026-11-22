#!/bin/sh
# SPDX-FileCopyrightText: 2026 CommuneOS Contributors
# SPDX-License-Identifier: Apache-2.0
#
# Khôi phục CommuneOS từ một bản sao lưu (gọi bằng: make restore BACKUP=backups/<ngày-giờ>).
# GHI ĐÈ toàn bộ dữ liệu hiện tại: cơ sở dữ liệu, kho tệp. Phải gõ xác nhận (hoặc đặt CONFIRM=co).
# Các bước: kiểm tra mã băm → dừng dịch vụ đang ghi → khôi phục cơ sở dữ liệu và volume
# → chạy lại db-setup (bản sao lưu cũ vẫn khớp lược đồ mới nhất) → khởi động lại toàn bộ.
set -eu
COMPOSE="${COMPOSE:-docker compose}"
SRC="${1:-}"
[ -n "$SRC" ] && [ -d "$SRC" ] || { echo "Cách dùng: make restore BACKUP=backups/<ngày-giờ>"; exit 2; }
SRC_ABS=$(cd "$SRC" && pwd)

echo "Kiểm tra mã băm của bản sao lưu..."
(cd "$SRC" && sha256sum -c --quiet SHA256SUMS) || { echo "Bản sao lưu bị hỏng hoặc bị sửa, dừng lại."; exit 1; }
sed 's/^/  /' "$SRC/MANIFEST.txt"

if [ "${CONFIRM:-}" != "co" ]; then
  printf 'Khôi phục sẽ GHI ĐÈ toàn bộ dữ liệu hiện tại. Gõ "co" để tiếp tục: '
  read -r answer
  [ "$answer" = "co" ] || { echo "Đã hủy."; exit 1; }
fi

# Dừng mọi dịch vụ đọc ghi dữ liệu, chỉ để db chạy.
WRITERS="citizen commune admin gateway ai-gateway accounts files orchestrator workflow-engine rest identity"
$COMPOSE stop $WRITERS >/dev/null 2>&1 || true
$COMPOSE up -d db >/dev/null
until $COMPOSE exec -T db pg_isready -q; do sleep 1; done
MAIN_DB=$($COMPOSE exec -T db sh -c 'printf %s "$POSTGRES_DB"')

for db in "$MAIN_DB" keycloak flowable; do
  [ -f "$SRC/$db.dump" ] || { echo "  Thiếu $db.dump, bỏ qua"; continue; }
  $COMPOSE exec -T db sh -c "dropdb -U \"\$POSTGRES_USER\" --if-exists --force $db && createdb -U \"\$POSTGRES_USER\" $db"
  $COMPOSE exec -T db sh -c "pg_restore -U \"\$POSTGRES_USER\" -d $db --exit-on-error" < "$SRC/$db.dump"
  echo "  Đã khôi phục cơ sở dữ liệu $db"
done

volume_of() {
  id=$($COMPOSE ps -aq "$1")
  [ -n "$id" ] || { echo ""; return; }
  docker inspect -f "{{range .Mounts}}{{if eq .Destination \"$2\"}}{{.Name}}{{end}}{{end}}" "$id"
}
restore_volume() { # restore_volume <dịch vụ> <thư mục trong container> <tệp>
  [ -f "$SRC/$3" ] || return 0
  vol=$(volume_of "$1" "$2")
  [ -n "$vol" ] || { echo "  Chưa có volume của $1 (chạy make up trước), bỏ qua $3"; return 0; }
  $COMPOSE stop "$1" >/dev/null 2>&1 || true
  docker run --rm -v "$vol":/data -v "$SRC_ABS":/in:ro node:22-alpine \
    sh -c "find /data -mindepth 1 -delete && tar xzf /in/$3 -C /data"
  echo "  Đã khôi phục volume $vol"
}
restore_volume storage /data storage-data.tgz
restore_volume citizen /app/storage citizen-uploads.tgz

echo "Áp lại lược đồ mới nhất (db-setup) và khởi động lại..."
LOG="$SRC_ABS/restore-db-setup.log"
$COMPOSE run --rm db-setup >"$LOG" 2>&1 || { tail -20 "$LOG"; echo "db-setup lỗi, xem $LOG"; exit 1; }
# RESTORE_START=khong: không khởi động lại toàn bộ (dùng khi diễn tập khôi phục trên bản thử chỉ có db).
[ "${RESTORE_START:-co}" = "co" ] && $COMPOSE up -d >/dev/null
echo "Khôi phục xong. Kiểm tra: make test, hoặc trang Tình trạng hệ thống của bảng quản trị."
