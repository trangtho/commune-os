// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Kênh người dân KHÔNG đọc ghi dữ liệu trực tiếp: mọi thao tác dữ liệu gọi API của lõi qua cổng APISIX
// (utils/identity.ts: citizenRpc, publicRpc, serviceRpc). Kết nối duy nhất còn lại tới PostgreSQL là để nhận tín hiệu
// thay đổi (LISTEN communeos_citizen_changes) cho thông báo thời gian thực (utils/live-changes.ts), bằng vai trò
// communeos_app đã bị thu hồi mọi quyền trên bảng và hàm (core/db/init/34-citizen-direct-access.sql).
import pg from 'pg'
let singleton: pg.Pool | undefined
export function db() {
  if (!singleton) {
    const config = useRuntimeConfig()
    singleton = new pg.Pool({
      host: String(config.dbHost), port: Number(config.dbPort), database: String(config.dbName),
      user: String(config.dbUser), password: String(config.dbPassword), max: 2,
      idleTimeoutMillis: 15_000, connectionTimeoutMillis: 5_000
    })
  }
  return singleton
}
