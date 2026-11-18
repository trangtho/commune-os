// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Đăng nhập cán bộ bằng tài khoản Keycloak (vd canbo.xa-a).
// Token được giữ trong cookie phiên httpOnly đã ký, trình duyệt không đọc được.
import { signSession } from '../../utils/session'
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

  let token: string
  try {
    const res = await $fetch<{ access_token: string }>(
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
    token = res.access_token
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
    throw createError({ statusCode: 401, statusMessage: 'Tên đăng nhập hoặc mật khẩu không đúng' })
  }

  const info = readToken(token)
  if (!info.tenant_id) {
    throw createError({ statusCode: 403, statusMessage: 'Tài khoản này chưa được gán xã (tenant_id), không dùng được màn hình cán bộ' })
  }
  const role = info.realm_access?.roles?.includes('leader') ? 'admin' : 'officer'
  const name = info.name || info.preferred_username || 'Cán bộ'
  signSession(event, { id: info.sub, tenantId: info.tenant_id, name, role, token })
  return { authenticated: true, role, name }
})