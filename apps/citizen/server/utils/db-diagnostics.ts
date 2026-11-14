// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Never return raw database errors, SQL statements, hostnames or credentials to browsers.
type PgIssue = { code?: string; cause?: { code?: string } }
export function dbIssue(error: unknown): { code: string; message: string } {
  const err = error as PgIssue | null
  const code = err?.code || err?.cause?.code || ''
  switch (code) {
    case '42P01': return { code: 'SCHEMA_MISSING', message: 'Chưa có bảng dữ liệu thủ tục. Chạy make repair-db.' }
    case '42501': return { code: 'DATABASE_PERMISSION_DENIED', message: 'Vai trò PostgreSQL chưa được cấp quyền. Chạy make repair-db.' }
    case '28P01': case '28000': return { code: 'DATABASE_AUTH_FAILED', message: 'Mật khẩu tài khoản PostgreSQL không đúng. Kiểm tra .env và chạy make repair-db.' }
    case 'ECONNREFUSED': case 'ENOTFOUND': case 'EHOSTUNREACH': case 'ETIMEDOUT':
      return { code: 'DATABASE_UNREACHABLE', message: 'Không kết nối được PostgreSQL. Kiểm tra docker compose ps.' }
    default: return { code: 'DATABASE_ERROR', message: 'PostgreSQL chưa sẵn sàng. Xem log db-setup và citizen để xác định lỗi.' }
  }
}
