// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Gọi dịch vụ tài khoản của lõi (cổng APISIX /accounts/*) bằng token Keycloak của cán bộ.
// Lõi kiểm tra: chỉ lãnh đạo xã, chỉ cán bộ xử lý cùng xã.
import type { H3Event } from 'h3'
import { requireStaff, signOut } from './session'

export async function coreAccounts<T>(
  event: H3Event,
  path: string,
  init: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: Record<string, unknown> } = {},
): Promise<T> {
  const actor = await requireStaff(event)
  const { gatewayUrl } = useRuntimeConfig(event)
  try {
    return await $fetch<T>(`${gatewayUrl}/accounts${path}`, {
      method: init.method || 'GET',
      body: init.body,
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
    throw createError({ statusCode: 502, statusMessage: 'Không gọi được dịch vụ tài khoản của lõi. Kiểm tra docker compose đã chạy chưa.' })
  }
}
