// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Đăng nhập cán bộ bằng tài khoản Keycloak (vd canbo.xa-a).
// Token được giữ trong cookie HttpOnly mã hóa AES-GCM, trình duyệt không đọc được.
import { signSession } from '../../utils/session'
import type { PortalTokens } from '../../utils/portal-session'
import { loginSchema, validate } from '../../utils/validation'

interface TokenInfo {
  sub: string
  tenant_id?: string
  name?: string
  preferred_username?: string
  realm_access?: { roles?: string[] }
}

function readToken(token: string): TokenInfo {
  return JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString())
}

export default defineEventHandler(async (event) => {
  const credentials = validate(loginSchema, await readBody(event))
  const { keycloakUrl } = useRuntimeConfig(event)

  let tokens: PortalTokens
  try {
    tokens = await $fetch<PortalTokens>(
      `${keycloakUrl}/realms/communeos/protocol/openid-connect/token`,
      {
        method: 'POST',
        body: new URLSearchParams({
          grant_type: 'password',
          client_id: 'commune-app',
          username: credentials.username,
          password: credentials.password,
        }),
      },
    )
  } catch (e: any) {
    // Tài khoản mới tạo hoặc vừa được cấp lại mật khẩu tạm: Keycloak bắt đổi mật khẩu trước.
    if (String(e?.data?.error_description || '').includes('not fully set up')) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Bạn cần đặt mật khẩu mới trước khi dùng hệ thống',
        data: { code: 'password_change_required' },
      })
    }
    if (String(e?.data?.error_description || '').includes('disabled')) {
      throw createError({ statusCode: 403, statusMessage: 'Tài khoản đang bị khóa. Liên hệ lãnh đạo xã.' })
    }
    // Chỉ báo sai mật khẩu khi Keycloak trả đúng lỗi đó; Keycloak chưa chạy (vừa make up, đang khởi động)
    // hay cấu hình sai thì báo rõ để người dùng không tưởng mình gõ nhầm.
    if (e?.data?.error === 'invalid_grant') {
      throw createError({ statusCode: 401, statusMessage: 'Tên đăng nhập hoặc mật khẩu không đúng' })
    }
    if (!e?.response || e.response.status >= 500 || e.response.status === 404) {
      throw createError({ statusCode: 503, statusMessage: 'Hệ thống định danh (Keycloak) đang khởi động hoặc chưa kết nối được. Vui lòng thử lại sau khoảng 1 phút.' })
    }
    throw createError({ statusCode: 503, statusMessage: `Cấu hình đăng nhập với Keycloak chưa đúng (${e?.data?.error || e.response.status}). Chạy lại make up hoặc báo quản trị.` })
  }

  const info = readToken(tokens.access_token)
  if (!info.tenant_id) {
    throw createError({ statusCode: 403, statusMessage: 'Tài khoản này chưa được gán xã (tenant_id), không dùng được màn hình cán bộ' })
  }
  if (!info.realm_access?.roles?.some(r => ['receptionist', 'officer', 'leader'].includes(r))) throw createError({ statusCode: 403, statusMessage: 'Tài khoản không có quyền cán bộ' })
  // Màn hình cán bộ là ứng dụng của gói nghiệp vụ xã: đơn vị của tài khoản phải bật gói "xa" (lõi: api.my_modules).
  // Người của đơn vị khác (ví dụ Công ty A chỉ dùng gói doanh nghiệp) đăng nhập đúng nhưng không vào được.
  const { gatewayUrl } = useRuntimeConfig(event)
  let modules: string[]
  try {
    modules = await $fetch<string[]>(`${gatewayUrl}/rest/rpc/my_modules`, {
      method: 'POST', body: {}, headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
  } catch {
    throw createError({ statusCode: 503, statusMessage: 'Không gọi được API lõi để kiểm tra gói nghiệp vụ của đơn vị. Vui lòng thử lại sau.' })
  }
  if (!modules.includes('xa')) {
    throw createError({ statusCode: 403, statusMessage: 'Đơn vị của bạn không dùng gói nghiệp vụ xã, nên không dùng được màn hình cán bộ xã' })
  }
  const role = info.realm_access?.roles?.includes('leader') ? 'admin' : 'officer'
  const name = info.name || info.preferred_username || 'Cán bộ'
  setHeader(event, 'Cache-Control', 'no-store')
  signSession(event, tokens)
  return { authenticated: true, role, name }
})