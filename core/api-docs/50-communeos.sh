#!/bin/sh
# SPDX-FileCopyrightText: 2026 CommuneOS Contributors
# SPDX-License-Identifier: Apache-2.0
#
# Chạy trong container api-docs sau script cấu hình mặc định của Swagger UI (40-swagger-ui.sh):
# thay tệp khởi tạo bằng cấu hình của CommuneOS, chép đặc tả dịch vụ lõi và đặc tả của các gói đang bật
# (modules/<gói>/api-docs.yaml) vào thư mục web; modules.json liệt kê đặc tả của gói cho swagger-initializer.js.
set -e
HTML=/usr/share/nginx/html
cp /communeos/swagger-initializer.js "$HTML/swagger-initializer.js"
cp /communeos/core-services.yaml "$HTML/core-services.yaml"
mkdir -p "$HTML/modules"
rm -f "$HTML"/modules/*.yaml
list=""
for m in $(echo "${COMMUNEOS_MODULES:-}" | tr ',' ' '); do
  case "$m" in *[!a-z0-9-]*|'') continue ;; esac
  spec="/modules/$m/api-docs.yaml"
  [ -f "$spec" ] || continue
  cp "$spec" "$HTML/modules/$m.yaml"
  # Tên hiển thị: dòng "  title: ..." đầu tiên của đặc tả (bỏ nháy, ký tự " và \ để giữ JSON hợp lệ).
  title=$(sed -n 's/^  title: *//p' "$spec" | head -1 | tr -d '"\\' | sed "s/^'//; s/'\$//")
  list="${list:+$list,}{\"url\":\"./modules/$m.yaml\",\"name\":\"${title:-Gói $m}\"}"
done
echo "[$list]" > "$HTML/modules.json"
# Ảnh nginx phục vụ sẵn bản nén .gz nếu có; xóa bản nén cũ của tệp khởi tạo để không trả cấu hình mặc định.
rm -f "$HTML/swagger-initializer.js.gz"
