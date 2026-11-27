// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Public registration is a business adapter; Core retains the Keycloak/account primitives.
export function createHandler({ limited, HttpError, readJson, USERNAME_RE, EMAIL_RE, checkPassword, splitName, kcJson, coreRpc, createAccount, json }) {
  async function registerCitizen(req, res) {
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim()
    if (limited(`reg:${ip}`, 30)) throw new HttpError(429, 'Đăng ký quá nhiều lần, vui lòng thử lại sau 15 phút')
    const b = await readJson(req)
    if (b.consent !== true) throw new HttpError(400, 'Cần đồng ý cho phép xử lý dữ liệu cá nhân (Nghị định 13/2023/NĐ-CP) để đăng ký')
    const username = String(b.username || '').trim().toLowerCase()
    const email = String(b.email || '').trim().toLowerCase()
    const phone = String(b.phone || '').replace(/[\s.-]/g, '')
    const tenantCode = String(b.tenantCode || '').trim()
    const password = String(b.password || '')
    const fullName = String(b.fullName || '').trim().replace(/\s+/g, ' ')
    if (!USERNAME_RE.test(username)) throw new HttpError(400, 'Tên đăng nhập 3–50 ký tự: chữ thường không dấu, số, dấu chấm, gạch')
    if (!email && !phone) throw new HttpError(400, 'Nhập email hoặc số điện thoại')
    if (email && !EMAIL_RE.test(email)) throw new HttpError(400, 'Email không hợp lệ')
    if (phone && !/^(\+84|0)[0-9]{9,10}$/.test(phone)) throw new HttpError(400, 'Số điện thoại không hợp lệ')
    checkPassword(password)
    if (password.toLowerCase().includes(username)) throw new HttpError(400, 'Mật khẩu không được chứa tên đăng nhập')
    const name = splitName(fullName)
    const existing = await kcJson('GET', `/users?username=${encodeURIComponent(username)}&exact=true`)
    if (existing.length) throw new HttpError(409, 'Tên đăng nhập đã được dùng')
    const citizen = await coreRpc('system_register_citizen', { p_tenant_code: tenantCode, p_login_name: username,
      p_display_name: fullName, p_email: email || null, p_phone: phone || null }, { workflow: true })
    try {
      await createAccount({ username, ...name, email, role: 'citizen', password, temporary: false,
        attributes: { citizen_id: [citizen.citizen_id], citizen_tenant: [citizen.tenant_code] } })
    } catch (e) {
      await coreRpc('system_unregister_citizen', { p_citizen_id: citizen.citizen_id }, { workflow: true }).catch(() => {})
      throw e
    }
    console.log(`Công dân tự đăng ký: xã ${citizen.tenant_code}`)
    return json(res, 201, { username, tenantCode: citizen.tenant_code,
      notice: 'Đã tạo tài khoản. Bạn có thể đăng nhập Kênh người dân bằng tên đăng nhập và mật khẩu vừa đặt.' })
  }
  return async ({ req, res, url }) => {
    if (req.method === 'POST' && url.pathname === '/accounts/register') return registerCitizen(req, res)
  }
}
