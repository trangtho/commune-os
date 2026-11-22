// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
//
// Dữ liệu của Kênh người dân là dữ liệu mật: dịch vụ xử lý dữ liệu (OCR, AI) chỉ được nằm trong mạng
// nội bộ của đơn vị. Chấp nhận tên dịch vụ Docker (không có dấu chấm), localhost và dải IP riêng;
// từ chối mọi tên miền, IP công khai, địa chỉ có kèm tài khoản.
export function isInternalEndpoint(url: URL): boolean {
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return false
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (host === 'localhost' || host === '::1') return true
  if (/^[a-z0-9-]+$/.test(host)) return true // tên dịch vụ trong mạng Docker, ví dụ "ocr"
  const ip = host.split('.').map(Number)
  if (ip.length !== 4 || ip.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false
  const [a, b] = ip as [number, number, number, number]
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
}
