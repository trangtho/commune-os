// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Đăng nhập công dân: Keycloak kiểm tra mật khẩu, hồ sơ công dân đọc qua cổng APISIX (/rest).
import { gatewayFetch, passwordLogin, saveTokens } from '../../utils/identity'
import { signSession } from '../../utils/session'
import { loginSchema, validate } from '../../utils/validation'
type Profile = { id: string; tenant_id: string; display_name: string }
export default defineEventHandler(async (event) => {
  const credentials = validate(loginSchema, await readBody(event))
  const tokens = await passwordLogin(credentials.username, credentials.password)
  let profile: Profile | undefined
  try {
    profile = (await gatewayFetch<Profile[]>(tokens.access_token, '/rest/my_citizen_profile?select=id,tenant_id,display_name'))[0]
  } catch {
    throw createError({ statusCode: 503, statusMessage: 'Chưa kết nối được máy chủ dữ liệu, vui lòng thử lại sau' })
  }
  if (!profile) throw createError({ statusCode: 403, statusMessage: 'Tài khoản chưa được liên kết với hồ sơ công dân' })
  saveTokens(event, tokens)
  signSession(event, { id: profile.id, tenantId: profile.tenant_id, name: profile.display_name, authMethod: 'keycloak' })
  return { authenticated: true, role: 'citizen', name: profile.display_name }
})
