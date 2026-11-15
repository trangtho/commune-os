// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Gọi dịch vụ tệp của lõi (cổng APISIX /files/*) bằng token Keycloak của cán bộ.
// Quyền xem/ghi do lõi quyết định theo xã trong token.
import type { H3Event } from 'h3'
import { requireStaff, signOut } from './session'

export async function coreFiles(
  event: H3Event,
  path: string,
  init: { method?: string; body?: Uint8Array; contentType?: string } = {},
): Promise<Response> {
  const actor = requireStaff(event)
  const { gatewayUrl } = useRuntimeConfig(event)
  const headers: Record<string, string> = { Authorization: `Bearer ${actor.token}` }
  if (init.contentType) headers['content-type'] = init.contentType
  const res = await fetch(`${gatewayUrl}/files${path}`, {
    method: init.method || 'GET',
    headers,
    body: init.body,
  }).catch(() => null)
  if (!res) throw createError({ statusCode: 502, statusMessage: 'Không gọi được dịch vụ tệp của lõi. Kiểm tra docker compose đã chạy chưa.' })
  if (res.status === 401) {
    signOut(event)
    throw createError({ statusCode: 401, statusMessage: 'Phiên đăng nhập đã hết, vui lòng đăng nhập lại' })
  }
  if (!res.ok) {
    const body: any = await res.json().catch(() => ({}))
    const status = [400, 403, 404, 409, 413, 415, 422, 503].includes(res.status) ? res.status : 502
    throw createError({ statusCode: status, statusMessage: body.message || 'Dịch vụ tệp từ chối yêu cầu' })
  }
  return res
}
