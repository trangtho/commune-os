#!/bin/sh
# SPDX-FileCopyrightText: 2026 CommuneOS Contributors
# SPDX-License-Identifier: Apache-2.0
#
# make check-env: tài khoản quản trị hệ thống do người cài tự đặt trong .env (COMMUNEOS_ADMIN_USERNAME,
# COMMUNEOS_ADMIN_PASSWORD). Từ chối tên không hợp lệ, mật khẩu để trống, mật khẩu mẫu hoặc yếu.
ENV_FILE="${1:-.env}"
user=$(grep -E '^COMMUNEOS_ADMIN_USERNAME=' "$ENV_FILE" | tail -1 | cut -d= -f2-)
pass=$(grep -E '^COMMUNEOS_ADMIN_PASSWORD=' "$ENV_FILE" | tail -1 | cut -d= -f2-)
if ! printf '%s' "$user" | grep -qE '^[a-z0-9][a-z0-9._-]{2,49}$'; then
  echo "COMMUNEOS_ADMIN_USERNAME trong .env: 3–50 ký tự, chữ thường không dấu, số, dấu chấm, gạch."
  exit 1
fi
case "$pass" in
  doi-mat-khau-nay|changeme|password*|Password*|12345*|admin*|quantri*)
    echo "COMMUNEOS_ADMIN_PASSWORD trong .env đang là mật khẩu mẫu hoặc quá dễ đoán: đặt mật khẩu riêng."
    exit 1 ;;
esac
if [ "${#pass}" -lt 10 ]; then
  echo "COMMUNEOS_ADMIN_PASSWORD trong .env phải có ít nhất 10 ký tự."
  exit 1
fi
if ! printf '%s' "$pass" | grep -q '[A-Za-z]' || ! printf '%s' "$pass" | grep -q '[0-9]'; then
  echo "COMMUNEOS_ADMIN_PASSWORD trong .env phải có cả chữ và số."
  exit 1
fi
