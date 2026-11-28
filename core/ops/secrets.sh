#!/bin/sh
# SPDX-FileCopyrightText: 2026 CommuneOS Contributors
# SPDX-License-Identifier: Apache-2.0
#
# make secrets: thay mọi bí mật còn để giá trị mẫu (hoặc trống, quá ngắn) trong .env bằng giá trị ngẫu nhiên.
# Chưa có .env thì chép từ .env.example. Không đụng giá trị đã đặt đúng. Bản sao .env cũ: .env.bak-<thời điểm>.
#
# Máy đã cài (đã có dữ liệu PostgreSQL): các bí mật chỉ dùng lúc khởi tạo không đổi tự động được, vì dữ liệu đã tạo
# bằng giá trị cũ (POSTGRES_PASSWORD, KEYCLOAK_ADMIN_PASSWORD, FLOWABLE_ADMIN_PASSWORD, S3_SECRET_KEY); script chỉ
# báo lại. Các bí mật khác được áp lại ở lần make up kế tiếp.
set -eu
ENV_FILE="${1:-.env}"
COMPOSE="${COMPOSE:-docker compose}"

if [ ! -f "$ENV_FILE" ]; then
  cp .env.example "$ENV_FILE"
  echo "Đã tạo $ENV_FILE từ .env.example."
fi

rand() { # rand <số byte> → chuỗi hex
  if command -v openssl >/dev/null 2>&1; then openssl rand -hex "$1"
  else od -An -tx1 -N"$1" /dev/urandom | tr -d ' \n'; fi
}
val() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2-; }
weak() { # weak <tên> <độ dài tối thiểu>
  v=$(val "$1")
  case "$v" in ''|doi-*|THAY_BANG*|changeme*|change-me*|secret*|password*|12345*|quantri*|admin*) return 0 ;; esac
  [ "${#v}" -lt "$2" ]
}
BACKUP=""
set_val() { # set_val <tên> <giá trị>: sửa dòng đã có, chưa có thì thêm cuối tệp (lần sửa đầu: sao lưu .env)
  if [ -z "$BACKUP" ]; then BACKUP="$ENV_FILE.bak-$(date +%Y%m%d-%H%M%S)"; cp "$ENV_FILE" "$BACKUP"; fi
  if grep -qE "^$1=" "$ENV_FILE"; then
    sed -i.tmp "s|^$1=.*|$1=$2|" "$ENV_FILE" && rm -f "$ENV_FILE.tmp"
  else
    printf '%s=%s\n' "$1" "$2" >> "$ENV_FILE"
  fi
}

# Đã có dữ liệu chưa: volume db-data của dự án (tên dự án theo docker compose).
PROJECT=$($COMPOSE config 2>/dev/null | sed -n 's/^name: //p' | head -1)
INSTALLED=false
if [ -n "$PROJECT" ] && docker volume ls -q --filter "label=com.docker.compose.project=$PROJECT" \
     --filter "label=com.docker.compose.volume=db-data" 2>/dev/null | grep -q .; then
  INSTALLED=true
fi

changed=""; kept=""
for item in POSTGRES_PASSWORD:12:24:init KEYCLOAK_ADMIN_PASSWORD:12:24:init FLOWABLE_ADMIN_PASSWORD:12:24:init \
            S3_SECRET_KEY:16:24:init POSTGRES_APP_PASSWORD:12:24:run POSTGRES_REST_PASSWORD:12:24:run \
            WORKFLOW_TOKEN:32:32:run FILES_SERVICE_TOKEN:16:24:run KEYCLOAK_ACCOUNTS_SECRET:16:24:run \
            CITIZEN_KEYCLOAK_SECRET:16:24:run SESSION_SECRET:32:32:run; do
  name=$(echo "$item" | cut -d: -f1); min=$(echo "$item" | cut -d: -f2)
  bytes=$(echo "$item" | cut -d: -f3); kind=$(echo "$item" | cut -d: -f4)
  weak "$name" "$min" || continue
  if [ "$kind" = init ] && [ "$INSTALLED" = true ]; then kept="$kept $name"; continue; fi
  set_val "$name" "$(rand "$bytes")"; changed="$changed $name"
done

# Mật khẩu quản trị hệ thống: có cả chữ và số, đủ 10 ký tự; in ra để người cài đăng nhập lần đầu.
if weak COMMUNEOS_ADMIN_PASSWORD 10; then
  admin_pass="Qt$(rand 6)$(od -An -tu1 -N1 /dev/urandom | tr -d ' ' | cut -c1)x"
  set_val COMMUNEOS_ADMIN_PASSWORD "$admin_pass"
  changed="$changed COMMUNEOS_ADMIN_PASSWORD"
fi
[ -n "$(val COMMUNEOS_ADMIN_USERNAME)" ] || set_val COMMUNEOS_ADMIN_USERNAME quantri

# Bật HTTPS (COMPOSE_PROFILES có https): Keycloak và ba ứng dụng đi qua proxy; địa chỉ công khai theo cổng của proxy
# (core/ops/Caddyfile). Ứng dụng so khớp Origin của trình duyệt với *_PORTAL_PUBLIC_ORIGIN để chặn gọi chéo trang.
case ",$(val COMPOSE_PROFILES)," in *,https,*)
  domain=$(val COMMUNEOS_DOMAIN); domain=${domain:-localhost}
  for pair in KEYCLOAK_PUBLIC_URL=https://$domain:8446 CITIZEN_PORTAL_PUBLIC_ORIGIN=https://$domain \
              COMMUNE_PORTAL_PUBLIC_ORIGIN=https://$domain:8443 ADMIN_PORTAL_PUBLIC_ORIGIN=https://$domain:8444; do
    name=${pair%%=*}; want=${pair#*=}
    if [ "$(val "$name")" != "$want" ]; then set_val "$name" "$want"; changed="$changed $name"; fi
  done ;;
esac

if [ -n "$changed" ]; then
  echo "Đã đặt giá trị mới cho:$changed (bản sao .env cũ: $BACKUP)"
else
  echo "Mọi bí mật trong $ENV_FILE đã được đặt; không đổi gì."
fi
if [ -n "${admin_pass:-}" ]; then
  echo "Tài khoản quản trị hệ thống: $(val COMMUNEOS_ADMIN_USERNAME) / $admin_pass (lưu trong $ENV_FILE)"
fi
if [ -n "$kept" ]; then
  echo "Máy đã có dữ liệu nên giữ nguyên:$kept"
  echo "Các bí mật này chỉ dùng lúc khởi tạo; đổi theo hướng dẫn trong core/ops/README.md."
fi
[ -n "$changed" ] && echo "Áp dụng: make up"
exit 0
