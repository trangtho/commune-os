// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Gọi API lõi (PostgREST sau cổng APISIX) bằng token Keycloak của cán bộ đang đăng nhập.
// Lõi tự lọc theo xã trong token (RLS), nên ở đây KHÔNG cần lọc tenant.
import type { H3Event } from 'h3'
import { requireStaff, signOut } from './session'

export async function coreGet<T>(event: H3Event, path: string): Promise<T> {
  const actor = requireStaff(event)
  const { gatewayUrl } = useRuntimeConfig(event)
  try {
    return await $fetch<T>(`${gatewayUrl}/rest${path}`, {
      headers: { Authorization: `Bearer ${actor.token}` },
    })
  } catch (e: any) {
    if (e?.response?.status === 401) {
      signOut(event)
      throw createError({ statusCode: 401, statusMessage: 'Phiên đăng nhập đã hết, vui lòng đăng nhập lại' })
    }
    throw createError({ statusCode: 502, statusMessage: 'Không gọi được API lõi. Kiểm tra docker compose đã chạy chưa.' })
  }
}


// Gọi một hàm ghi của lõi: POST /rest/rpc/<tên hàm>.
// Lỗi nghiệp vụ của lõi (400, 403, 404, 409) được giữ nguyên mã và lời nhắn để hiện cho cán bộ.
export async function coreRpc<T>(event: H3Event, fn: string, body: Record<string, unknown>): Promise<T> {
  const actor = requireStaff(event)
  const { gatewayUrl } = useRuntimeConfig(event)
  try {
    return await $fetch<T>(`${gatewayUrl}/rest/rpc/${fn}`, {
      method: 'POST',
      body,
      headers: { Authorization: `Bearer ${actor.token}` },
    })
  } catch (e: any) {
    const status = e?.response?.status
    if (status === 401) {
      signOut(event)
      throw createError({ statusCode: 401, statusMessage: 'Phiên đăng nhập đã hết, vui lòng đăng nhập lại' })
    }
    if ([400, 403, 404, 409].includes(status)) {
      throw createError({ statusCode: status, statusMessage: e?.data?.message || 'Yêu cầu không hợp lệ' })
    }
    throw createError({ statusCode: 502, statusMessage: 'Không gọi được API lõi. Kiểm tra docker compose đã chạy chưa.' })
  }
}