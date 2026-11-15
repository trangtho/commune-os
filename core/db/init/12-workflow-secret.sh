#!/bin/sh
# SPDX-FileCopyrightText: 2026 CommuneOS Contributors
# SPDX-License-Identifier: Apache-2.0
#
# Ghi mã băm của WORKFLOW_TOKEN vào cơ sở dữ liệu để hàm set_dossier_status
# nhận ra lời gọi từ dịch vụ điều phối. Bí mật gốc chỉ nằm trong .env.
# Chạy lại nhiều lần không lỗi; đổi WORKFLOW_TOKEN trong .env rồi chạy lại là cập nhật.
set -eu
: "${WORKFLOW_TOKEN:?Thiếu WORKFLOW_TOKEN trong .env}"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v token="$WORKFLOW_TOKEN" <<'SQL'
INSERT INTO core_settings (key, value)
VALUES ('workflow_token_sha256', encode(sha256(convert_to(:'token', 'UTF8')), 'hex'))
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
SQL
