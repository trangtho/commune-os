FROM node:22-alpine AS builder
WORKDIR /app
COPY apps/commune/package*.json ./
RUN npm install --no-audit --no-fund
COPY apps/commune/ ./
RUN npm run build
FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/.output ./.output
ENV HOST=0.0.0.0 PORT=3000
EXPOSE 3000
CMD ["node",".output/server/index.mjs"]
