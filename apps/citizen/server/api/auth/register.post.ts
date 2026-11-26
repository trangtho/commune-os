// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Người dân tự đăng ký tài khoản: lõi tạo hồ sơ công dân và tài khoản Keycloak (vai trò citizen), ghi nhận thời điểm
// đồng ý xử lý dữ liệu cá nhân (Nghị định 13/2023/NĐ-CP). Đăng ký xong thì đăng nhập luôn.
import { gatewayFetch, passwordLogin, registerCitizenAccount, saveTokens } from '../../utils/identity'
import { signSession } from '../../utils/session'
import { registerSchema, validate } from '../../utils/validation'
type Profile = { id: string; tenant_id: string; display_name: string }
export default defineEventHandler(async (event) => {
  const input = validate(registerSchema, await readBody(event))
  const isEmail = input.contact.includes('@')
  const result = await registerCitizenAccount({
    fullName: input.fullName, username: input.username, tenantCode: input.tenantCode, password: input.password, consent: true,
    ...(isEmail ? { email: input.contact } : { phone: input.contact }),
  }, getRequestIP(event, { xForwardedFor: true }) || '')
  try {
    const tokens = await passwordLogin(result.username, input.password)
    const profile = (await gatewayFetch<Profile[]>(tokens.access_token, '/rest/my_citizen_profile?select=id,tenant_id,display_name'))[0]
    if (profile) {
      saveTokens(event, tokens)
      signSession(event, { id: profile.id, tenantId: profile.tenant_id, name: profile.display_name, authMethod: 'keycloak' })
      return { registered: true, authenticated: true, name: profile.display_name }
    }
  } catch { /* đăng ký đã xong; người dân đăng nhập lại ở trang đăng nhập */ }
  return { registered: true, authenticated: false, notice: result.notice }
})
