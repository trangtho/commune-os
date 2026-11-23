#!/bin/sh
# SPDX-FileCopyrightText: 2026 CommuneOS Contributors
# SPDX-License-Identifier: Apache-2.0
#
# Chạy trong container api-docs sau script cấu hình mặc định của Swagger UI (40-swagger-ui.sh):
# thay tệp khởi tạo bằng cấu hình của CommuneOS và chép đặc tả dịch vụ lõi vào thư mục web.
set -e
HTML=/usr/share/nginx/html
cp /communeos/swagger-initializer.js "$HTML/swagger-initializer.js"
cp /communeos/core-services.yaml "$HTML/core-services.yaml"
# Ảnh nginx phục vụ sẵn bản nén .gz nếu có; xóa bản nén cũ của tệp khởi tạo để không trả cấu hình mặc định.
rm -f "$HTML/swagger-initializer.js.gz"
