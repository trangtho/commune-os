#!/bin/sh
# SPDX-FileCopyrightText: 2026 CommuneOS Contributors
# SPDX-License-Identifier: Apache-2.0
#
# Sao lưu CommuneOS vào backups/<ngày-giờ>/ (gọi bằng: make backup).
#   communeos.dump, keycloak.dump, flowable.dump  pg_dump dạng custom, nhất quán khi hệ thống đang chạy
#   storage-data.tgz                               kho đối tượng SeaweedFS (giấy tờ hồ sơ)
#   citizen-uploads.tgz                            tệp cũ của Kênh người dân (trước khi có kho đối tượng)
#   MANIFEST.txt, SHA256SUMS                       thông tin bản sao lưu và mã băm để kiểm tra khi khôi phục
# Không sao lưu mô hình AI (tải lại được) và tệp .env (giữ riêng, chứa mật khẩu).
# Bản sao lưu chứa dữ liệu cá nhân: cất ở nơi an toàn, không đưa lên kho mã (backups/ đã có trong .gitignore).
set -eu
COMPOSE="${COMPOSE:-docker compose}"
ROOT="${BACKUP_DIR:-backups}"
DEST="$ROOT/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DEST"
DEST_ABS=$(cd "$DEST" && pwd)
MAIN_DB=$($COMPOSE exec -T db sh -c 'printf %s "$POSTGRES_DB"')

echo "Sao lưu vào $DEST"
for db in "$MAIN_DB" keycloak flowable; do
  $COMPOSE exec -T db sh -c "pg_dump -U \"\$POSTGRES_USER\" -Fc -d $db" > "$DEST/$db.dump"
  echo "  Cơ sở dữ liệu $db: $(du -h "$DEST/$db.dump" | cut -f1)"
done

# Tên volume thật (có tiền tố dự án) lấy từ container đang gắn volume đó.
volume_of() { # volume_of <dịch vụ> <thư mục trong container>
  id=$($COMPOSE ps -aq "$1")
  [ -n "$id" ] || { echo ""; return; }
  docker inspect -f "{{range .Mounts}}{{if eq .Destination \"$2\"}}{{.Name}}{{end}}{{end}}" "$id"
}
archive() { # archive <volume> <tệp>
  # Trả quyền sở hữu tệp cho người chạy lệnh (container chạy bằng root).
  docker run --rm -v "$1":/data:ro -v "$DEST_ABS":/out node:22-alpine \
    sh -c "tar czf /out/$2 -C /data . && chown $(id -u):$(id -g) /out/$2"
  echo "  Volume $1: $(du -h "$DEST/$2" | cut -f1)"
}

STORAGE=$(volume_of storage /data)
if [ -n "$STORAGE" ]; then
  # Dừng kho đối tượng vài giây để bản sao nhất quán.
  $COMPOSE stop storage >/dev/null
  archive "$STORAGE" storage-data.tgz || { $COMPOSE start storage >/dev/null; exit 1; }
  $COMPOSE start storage >/dev/null
fi
UPLOADS=$(volume_of citizen /app/storage)
[ -n "$UPLOADS" ] && archive "$UPLOADS" citizen-uploads.tgz

{
  echo "CommuneOS - bản sao lưu"
  echo "Thời điểm: $(date -Iseconds)"
  echo "Mã nguồn: $(git rev-parse --short HEAD 2>/dev/null || echo 'không rõ')"
  echo "Cơ sở dữ liệu chính: $MAIN_DB"
  echo "Ảnh db: $(docker inspect -f '{{.Config.Image}}' "$($COMPOSE ps -q db)" 2>/dev/null)"
  echo "Không gồm: mô hình AI (tải lại bằng make up), tệp .env (giữ riêng)."
} > "$DEST/MANIFEST.txt"
(cd "$DEST" && sha256sum ./*.dump ./*.tgz MANIFEST.txt > SHA256SUMS)
echo "Xong. Khôi phục: make restore BACKUP=$DEST"
