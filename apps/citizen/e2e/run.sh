#!/bin/sh
# SPDX-FileCopyrightText: 2026 CommuneOS Contributors
# SPDX-License-Identifier: Apache-2.0
#
# make e2e-citizen: chạy kiểm thử giao diện Kênh người dân (Playwright) trong ảnh Playwright chính thức, không cần cài
# trình duyệt hay node_modules trên máy. Cần stack đang chạy (make up) và dữ liệu mẫu (make demo).
# Kiểm thử tạo dữ liệu thật trên tài khoản congdan.demo (yêu cầu hỗ trợ, nhóm hồ sơ...): chỉ chạy trên máy thử.
# Tham số chuyển cho playwright test, ví dụ: sh apps/citizen/e2e/run.sh rag-assistant
# Kết quả khi lỗi (ảnh chụp, trace): apps/citizen/test-results/
set -eu
APP="$(cd "$(dirname "$0")/.." && pwd)"
VERSION=$(sed -n '/"node_modules\/@playwright\/test": {/{n;s/.*"version": "\([^"]*\)".*/\1/p;q}' "$APP/package-lock.json")
[ -n "$VERSION" ] || { echo "Không đọc được phiên bản @playwright/test trong package-lock.json"; exit 1; }
BASE_URL="${E2E_BASE_URL:-http://localhost:${CITIZEN_PORT:-3000}}"
# Chạy bằng người dùng hiện tại để tệp kết quả không thuộc root; chỉ cài @playwright/test (spec không dùng gói khác).
exec docker run --rm --network host --user "$(id -u):$(id -g)" -e HOME=/tmp \
  -e E2E_BASE_URL="$BASE_URL" -e E2E_USERNAME -e E2E_PASSWORD="${E2E_PASSWORD:-${DEMO_PASSWORD:-Demo@2026!}}" \
  -v "$APP/e2e:/src/e2e:ro" -v "$APP/playwright.config.ts:/src/playwright.config.ts:ro" -v "$APP:/app" \
  "mcr.microsoft.com/playwright:v$VERSION-noble" sh -c '
    mkdir -p /tmp/w && cp -r /src/. /tmp/w && cd /tmp/w && echo "{\"type\":\"module\",\"private\":true}" > package.json &&
    npm install --silent --no-audit --no-fund "@playwright/test@'"$VERSION"'" >/dev/null &&
    npx playwright test --output=/app/test-results "$@"' playwright "$@"
