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