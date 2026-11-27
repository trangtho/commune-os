#!/bin/sh
# SPDX-FileCopyrightText: 2026 CommuneOS Contributors
# SPDX-License-Identifier: Apache-2.0
#
# Chờ các dịch vụ docker compose sẵn sàng: dịch vụ có healthcheck phải "healthy", dịch vụ chạy một lần
# (db-setup, identity-setup, rest-keys) phải kết thúc với mã 0. Dùng sau make up và trong CI.
# docker compose up --wait không dùng được vì coi dịch vụ chạy một lần đã kết thúc là lỗi.
#
# Cách dùng: sh core/tests/wait-ready.sh [số giây tối đa, mặc định 600]
# ai-models (tải mô hình AI lần đầu, khoảng 2,6 GB) không phải chờ: trợ lý AI tự dùng được khi tải xong.
set -u
COMPOSE="${COMPOSE:-docker compose}"
LIMIT="${1:-600}"
START=$(date +%s)

while :; do
  # Mỗi dòng: dịch vụ|trạng thái|sức khỏe|mã thoát
  status=$($COMPOSE ps -a --format '{{.Service}}|{{.State}}|{{.Health}}|{{.ExitCode}}' 2>/dev/null)
  failed=$(echo "$status" | awk -F'|' '
    ($1=="db-setup" || $1=="identity-setup" || $1=="rest-keys" || $1=="gateway-setup") && $2=="exited" && $4!="0" { print $1 " kết thúc lỗi (mã " $4 ")" }
    $1!="db-setup" && $1!="identity-setup" && $1!="rest-keys" && $1!="gateway-setup" && $1!="ai-models" && ($2=="exited" || $2=="dead") { print $1 " đã dừng" }')
  waiting=$(echo "$status" | awk -F'|' '
    $1=="ai-models" { next }
    ($1=="db-setup" || $1=="identity-setup" || $1=="rest-keys" || $1=="gateway-setup") { if ($2!="exited") print $1; next }
    $2=="running" && $3!="" && $3!="healthy" { print $1 " (" $3 ")" }
    $2=="created" || $2=="restarting" { print $1 " (" $2 ")" }')
  if [ -n "$failed" ]; then
    echo "Dịch vụ lỗi:"; echo "$failed" | sed 's/^/  /'
    echo "Xem nhật ký: docker compose logs <tên dịch vụ>"
    exit 1
  fi
  if [ -z "$waiting" ]; then
    echo "Các dịch vụ đã sẵn sàng."
    echo "$status" | grep -q '^ai-models|running' && echo "Đang tải mô hình AI lần đầu; trợ lý AI dùng được khi tải xong (docker compose logs -f ai-models)."
    exit 0
  fi
  elapsed=$(( $(date +%s) - START ))
  if [ "$elapsed" -ge "$LIMIT" ]; then
    echo "Quá ${LIMIT} giây, vẫn chờ:"; echo "$waiting" | sed 's/^/  /'
    echo "Xem nhật ký: docker compose logs <tên dịch vụ>"
    exit 1
  fi
  sleep 5
done
