#!/bin/sh
# SPDX-FileCopyrightText: 2026 CommuneOS Contributors
# SPDX-License-Identifier: Apache-2.0
#
# Tạo 2 vai trò cho API dữ liệu (PostgREST):
#   authenticator : PostgREST đăng nhập bằng vai trò này, tự nó không đọc được bảng nào.
#   "commune-app" : vai trò PostgREST chuyển sang sau khi kiểm tra token Keycloak
#                   (lấy từ claim "azp" của token). Chỉ đọc được schema api.
# Chạy lại nhiều lần không lỗi; mật khẩu được đồng bộ theo .env.
set -eu
: "${POSTGRES_REST_PASSWORD:?Thiếu POSTGRES_REST_PASSWORD trong .env}"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v restpass="$POSTGRES_REST_PASSWORD" <<'SQL'
SELECT 'CREATE ROLE authenticator LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') \gexec
SELECT format('ALTER ROLE authenticator PASSWORD %L', :'restpass') \gexec
SELECT 'CREATE ROLE "commune-app" NOLOGIN'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'commune-app') \gexec
SELECT 'GRANT "commune-app" TO authenticator'
WHERE NOT pg_has_role('authenticator', 'commune-app', 'MEMBER') \gexec
SQL