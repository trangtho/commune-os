#!/bin/sh
# SPDX-FileCopyrightText: 2026 CommuneOS Contributors
# SPDX-License-Identifier: Apache-2.0
#
# make check-env (chạy trước make up, make demo): kiểm tra .env ngoài việc đủ biến.
#   * Tài khoản quản trị hệ thống: core/identity/check-admin-env.sh.
#   * Bí mật còn để giá trị mẫu (doi-mat-khau-nay...) hoặc quá ngắn:
#       - máy phát triển (COMMUNEOS_DOMAIN=localhost, PORTAL_BIND_ADDRESS=127.0.0.1, không bật https): chỉ cảnh báo;
#       - máy chủ (mở cho máy khác, hoặc bật https): dừng lại, đề nghị chạy make secrets.
#   * Bật HTTPS (COMPOSE_PROFILES có https): địa chỉ công khai của Keycloak và ba ứng dụng phải theo cổng của proxy
#     (KEYCLOAK_PUBLIC_URL, *_PORTAL_PUBLIC_ORIGIN; make secrets tự đặt).
set -u
ENV_FILE="${1:-.env}"
DIR=$(dirname "$0")
val() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2-; }

sh "$DIR/../identity/check-admin-env.sh" "$ENV_FILE" || exit 1

DOMAIN=$(val COMMUNEOS_DOMAIN); DOMAIN=${DOMAIN:-localhost}
BIND=$(val PORTAL_BIND_ADDRESS); BIND=${BIND:-127.0.0.1}
PROFILES=$(val COMPOSE_PROFILES)
HTTPS=false; case ",$PROFILES," in *,https,*) HTTPS=true ;; esac
SERVER=false
{ [ "$DOMAIN" != localhost ] && [ "$DOMAIN" != 127.0.0.1 ]; } && SERVER=true
[ "$BIND" != 127.0.0.1 ] && SERVER=true
[ "$HTTPS" = true ] && SERVER=true

# Bí mật và độ dài tối thiểu (mật khẩu cơ sở dữ liệu, khóa nội bộ, bí mật client Keycloak, khóa phiên).
weak=""
for item in POSTGRES_PASSWORD:12 KEYCLOAK_ADMIN_PASSWORD:12 POSTGRES_APP_PASSWORD:12 POSTGRES_REST_PASSWORD:12 \
            FLOWABLE_ADMIN_PASSWORD:12 WORKFLOW_TOKEN:32 S3_SECRET_KEY:16 FILES_SERVICE_TOKEN:16 \
            KEYCLOAK_ACCOUNTS_SECRET:16 CITIZEN_KEYCLOAK_SECRET:16 SESSION_SECRET:32; do
  name=${item%%:*}; min=${item#*:}; v=$(val "$name")
  case "$v" in
    ''|doi-*|THAY_BANG*|changeme*|change-me*|secret*|password*|12345*) weak="$weak $name" ;;
    *) [ "${#v}" -lt "$min" ] && weak="$weak $name" ;;
  esac
done
if [ -n "$weak" ]; then
  if [ "$SERVER" = true ]; then
    echo "Máy chủ mở cho máy khác (COMMUNEOS_DOMAIN=$DOMAIN, PORTAL_BIND_ADDRESS=$BIND${PROFILES:+, COMPOSE_PROFILES=$PROFILES}) nhưng .env"
    echo "còn bí mật mẫu hoặc quá ngắn:$weak"
    echo "Chạy: make secrets   (tự sinh giá trị ngẫu nhiên vào .env; xem core/ops/README.md)"
    exit 1
  fi
  echo "Cảnh báo: .env còn bí mật mẫu ($weak ). Chỉ dùng trên máy phát triển; máy chủ thật: make secrets."
fi

if [ "$HTTPS" = true ]; then
  bad=""
  for pair in KEYCLOAK_PUBLIC_URL=https://$DOMAIN:8446 CITIZEN_PORTAL_PUBLIC_ORIGIN=https://$DOMAIN \
              COMMUNE_PORTAL_PUBLIC_ORIGIN=https://$DOMAIN:8443 ADMIN_PORTAL_PUBLIC_ORIGIN=https://$DOMAIN:8444; do
    name=${pair%%=*}; want=${pair#*=}
    [ "$(val "$name")" = "$want" ] || bad="$bad\n  $name=$want"
  done
  if [ -n "$bad" ]; then
    printf 'Đang bật HTTPS (COMPOSE_PROFILES=%s): .env cần các dòng sau (địa chỉ qua proxy HTTPS), hoặc chạy make secrets để tự đặt:%b\n' "$PROFILES" "$bad"
    exit 1
  fi
  [ "$BIND" != 127.0.0.1 ] && echo "Lưu ý: PORTAL_BIND_ADDRESS=$BIND vẫn mở các cổng http (3000-3002, 8080, 9080) cho máy khác; khi đã có HTTPS nên để 127.0.0.1."
elif [ "$BIND" != 127.0.0.1 ] && [ "$(val PORTAL_ALLOW_LOCAL_HTTP)" != true ]; then
  echo "Lưu ý: mở cổng http cho máy khác (PORTAL_BIND_ADDRESS=$BIND) mà không bật HTTPS: đặt PORTAL_ALLOW_LOCAL_HTTP=true"
  echo "(chỉ mạng nội bộ) để đăng nhập được qua http, hoặc bật HTTPS (COMPOSE_PROFILES=https, xem core/ops/README.md)."
fi
exit 0
