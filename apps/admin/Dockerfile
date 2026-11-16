# SPDX-FileCopyrightText: 2026 CommuneOS Contributors
# SPDX-License-Identifier: Apache-2.0

# Giai đoạn 1: cài gói và build.
FROM node:22-alpine AS builder
WORKDIR /app
# Địa chỉ cổng APISIX mà bảng quản trị chuyển tiếp /rest tới (cố định lúc build).
ARG GATEWAY_URL=http://gateway:9080
ENV GATEWAY_URL=${GATEWAY_URL}
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

# Giai đoạn 2: ảnh chạy, chỉ mang theo kết quả build.
FROM node:22-alpine
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=builder /app/.output ./.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]