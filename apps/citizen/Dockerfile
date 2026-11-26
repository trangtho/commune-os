# SPDX-FileCopyrightText: 2026 CommuneOS Contributors
# SPDX-License-Identifier: Apache-2.0
FROM node:22-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci --no-audit --no-fund
RUN npm run build

FROM node:22-alpine
# Local QR encoder; no verification token is sent to a third-party QR service.
RUN apk add --no-cache libqrencode-tools
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
