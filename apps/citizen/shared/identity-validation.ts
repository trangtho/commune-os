// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
/** Field-level format checks. These are format checks, NOT identity verification. */
export const vietnamPhone = /^(?:\+84|0)(?:3|5|7|8|9)\d{8}$/
export const citizenIdentifier = /^\d{12}$/
export const simpleEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
export function phoneIssue(value: string, required = false): string {
  const cleaned = value.trim().replace(/[\s.-]/g, '')
  if (!cleaned) return required ? 'Vui lòng nhập số điện thoại' : ''
  return vietnamPhone.test(cleaned) ? '' : 'Số điện thoại Việt Nam không hợp lệ (ví dụ 0912345678)'
}
export function emailIssue(value: string, required = false): string {
  const text = value.trim()
  if (!text) return required ? 'Vui lòng nhập email' : ''
  return text.length <= 150 && simpleEmail.test(text) ? '' : 'Địa chỉ email không hợp lệ'
}
export function identityIssue(value: string, required = false): string {
  const text = value.trim()
  if (!text) return required ? 'Vui lòng nhập số định danh cá nhân' : ''
  return citizenIdentifier.test(text) ? '' : 'Số định danh cá nhân phải có 12 chữ số'
}
