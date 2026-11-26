# SPDX-FileCopyrightText: 2026 CommuneOS Contributors
# SPDX-License-Identifier: Apache-2.0

# Giai đoạn 1: cài đủ gói (kể cả gói chỉ dùng lúc build) rồi build.
FROM node:22-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci --no-audit --no-fund
RUN npm run build

# Giai đoạn 2: ảnh chạy, chỉ mang theo kết quả build.
FROM node:22-alpine
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=builder /app/.output ./.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]