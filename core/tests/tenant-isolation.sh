#!/bin/sh
# SPDX-FileCopyrightText: 2026 CommuneOS Contributors
# SPDX-License-Identifier: Apache-2.0
# Lối vào tương thích với Makefile cũ; Python3 dùng HTTP thực và kiểm tra status/JSON.
set -eu
exec python3 "$(dirname "$0")/api-integration.py"
