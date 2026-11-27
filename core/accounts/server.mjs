// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
//
// Dịch vụ tài khoản cán bộ của lõi. Không giao diện, không thư viện ngoài (chỉ Node 22).
// Tài khoản vẫn nằm ở Keycloak; dịch vụ này cho LÃNH ĐẠO XÃ quản lý CÁN BỘ XỬ LÝ của xã mình
// qua Keycloak Admin API, bằng tài khoản dịch vụ "accounts-service".
//
// Qua cổng APISIX /accounts/* (cần token Keycloak của người gọi):
//   GET   /accounts/staff                          danh sách cán bộ của xã
//   POST  /accounts/staff                          tạo cán bộ xử lý   { username, firstName, lastName, email? }
//   PATCH /accounts/staff/:id/status               khóa / mở          { enabled: true|false }
//   PUT   /accounts/staff/:id/roles                vai trò của gói    { roles: ["doanh-nghiep:truong-phong"] }
//   POST  /accounts/staff/:id/reset-password       cấp mật khẩu tạm mới
//   PATCH /accounts/staff/:id                      sửa họ tên, email
//   DELETE /accounts/staff/:id                     xóa hẳn (phải khóa trước)
//
// Quản trị hệ thống (vai trò sys_admin):
//   POST  /accounts/tenants                        tạo đơn vị kèm lãnh đạo { code, name, modules?, leaderUsername, leaderFullName, leaderEmail? }
//                                                  → { tenant, modules, leader: { id, username, temporaryPassword } }
//   GET   /accounts/tenants/:code/leaders          lãnh đạo của xã
//   POST  /accounts/tenants/:code/leaders          thêm lãnh đạo         { username, fullName, email? }
//   POST  /accounts/tenants/:code/leaders/:id/reset-password   cấp mật khẩu tạm mới
//   PATCH /accounts/tenants/:code/leaders/:id/status           khóa / mở { enabled }
//
//   POST  /accounts/me/password                    người đăng nhập tự đổi mật khẩu (công dân hoặc cán bộ)
//                                                  { currentPassword, newPassword }
//
// Không cần token (cổng APISIX có route riêng, không kiểm tra token):
//   Các đường dẫn bổ sung do module tin cậy khai báo (serviceHandlers.accounts).
//   POST  /accounts/first-password                 cán bộ đổi mật khẩu tạm lần đầu
//                                                  { username, currentPassword, newPassword }
//   GET   /health, /accounts/health (qua cổng)  dịch vụ và quyền vào Keycloak Admin API
//
// Quy tắc (kiểm tra ở đây, vì tài khoản dịch vụ có quyền trên cả realm):
//   * Chỉ người có vai trò leader và có tenant_id mới gọi được.
//   * Chỉ tác động lên cán bộ cùng xã; khác xã trả 404 (không lộ là tài khoản tồn tại).
//   * Chỉ tạo được vai trò officer; xã luôn là xã của người gọi.
//   * Không tác động lên chính mình, lãnh đạo khác hay sys_admin (403).
// Mỗi thao tác được ghi vào nhật ký staff_audit qua API dữ liệu (không ghi mật khẩu).

import { createServer } from 'node:http'
import { loadServiceHandlers, dispatchHandlers } from '../module-loader.mjs'
import { createPublicKey, randomInt, verify } from 'node:crypto'

const env = (name, fallback) => {
  const v = process.env[name] ?? fallback
  if (v === undefined || v === '') throw new Error(`Thiếu biến môi trường ${name}`)
  return v
}
const KEYCLOAK_URL = env('KEYCLOAK_URL', 'http://identity:8080').replace(/\/$/, '')
const REALM = env('KEYCLOAK_REALM', 'communeos')
const CLIENT_ID = env('ACCOUNTS_CLIENT_ID', 'accounts-service')
const CLIENT_SECRET = env('ACCOUNTS_CLIENT_SECRET')
const TOKEN_AZP = env('TOKEN_AZP', 'commune-app')
const REST_URL = env('REST_URL', 'http://rest:3000').replace(/\/$/, '')
const WORKFLOW_TOKEN = env('WORKFLOW_TOKEN')
const PORT = Number(process.env.PORT || 3000)

const ADMIN = `${KEYCLOAK_URL}/admin/realms/${REALM}`
const MANAGED_ROLE = 'officer'
const PROTECTED_ROLES = ['leader', 'sys_admin', 'supervisor']

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

// ---------- Kiểm tra token của người gọi (lớp thứ hai, sau cổng APISIX) ----------
let jwks = { at: 0, keys: [] }
async function publicKey(kid) {
  if (Date.now() - jwks.at > 5 * 60 * 1000 || !jwks.keys.some((k) => k.kid === kid)) {
    const r = await fetch(`${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/certs`)
    if (!r.ok) throw new HttpError(503, 'Chưa lấy được khóa của Keycloak')
    jwks = { at: Date.now(), keys: (await r.json()).keys || [] }
  }
  const jwk = jwks.keys.find((k) => k.kid === kid && k.use !== 'enc')
  if (!jwk) throw new HttpError(401, 'Token không hợp lệ')
  return createPublicKey({ key: jwk, format: 'jwk' })
}

// Kiểm chữ ký, hạn dùng và client cấp token; trả về các claim.
async function verifiedClaims(req, allowedClients) {
  const m = /^Bearer (\S+)$/.exec(String(req.headers.authorization || ''))
  if (!m) throw new HttpError(401, 'Thiếu token đăng nhập')
  const [h, p, s] = m[1].split('.')
  let header, claims
  try {
    header = JSON.parse(Buffer.from(h, 'base64url'))
    claims = JSON.parse(Buffer.from(p, 'base64url'))
  } catch { throw new HttpError(401, 'Token không hợp lệ') }
  if (header.alg !== 'RS256') throw new HttpError(401, 'Token không hợp lệ')
  const ok = verify('RSA-SHA256', Buffer.from(`${h}.${p}`), await publicKey(header.kid), Buffer.from(s || '', 'base64url'))
  if (!ok || !claims.exp || claims.exp * 1000 < Date.now() || !allowedClients.includes(claims.azp)) {
    throw new HttpError(401, 'Token không hợp lệ hoặc đã hết hạn')
  }
  return { claims, token: m[1] }
}

async function caller(req) {
  const { claims, token } = await verifiedClaims(req, [TOKEN_AZP])
  const roles = claims.realm_access?.roles || []
  if (!roles.includes('leader') || !claims.tenant_id) {
    throw new HttpError(403, 'Chỉ lãnh đạo xã được quản lý cán bộ')
  }
  return { id: claims.sub, tenant: claims.tenant_id, name: claims.name || claims.preferred_username, token }
}

// ---------- Keycloak Admin API bằng tài khoản dịch vụ ----------
let serviceToken = { value: '', exp: 0 }
async function adminToken() {
  if (serviceToken.value && Date.now() < serviceToken.exp - 30000) return serviceToken.value
  const r = await fetch(`${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`, {
    method: 'POST',
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  })
  if (!r.ok) throw new HttpError(503, 'Dịch vụ tài khoản chưa đăng nhập được Keycloak (kiểm tra ACCOUNTS_CLIENT_SECRET)')
  const d = await r.json()
  serviceToken = { value: d.access_token, exp: Date.now() + d.expires_in * 1000 }
  return serviceToken.value
}

async function kc(method, path, body) {
  const r = await fetch(`${ADMIN}${path}`, {
    method,
    headers: { authorization: `Bearer ${await adminToken()}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (r.status === 404) throw new HttpError(404, 'Không tìm thấy cán bộ')
  if (r.status === 409) throw new HttpError(409, 'Tên đăng nhập hoặc email đã được dùng')
  if (!r.ok) {
    const text = await r.text()
    console.error(`Keycloak ${method} ${path} → ${r.status}: ${text.slice(0, 300)}`)
    throw new HttpError(r.status === 400 ? 400 : 502, r.status === 400 ? 'Thông tin tài khoản không hợp lệ' : 'Keycloak từ chối yêu cầu')
  }
  return r
}
const kcJson = async (method, path, body) => {
  const r = await kc(method, path, body)
  const text = await r.text()
  return text ? JSON.parse(text) : null
}

const realmRoles = async (userId) => (await kcJson('GET', `/users/${userId}/role-mappings/realm`)).map((r) => r.name)
const tenantOf = (user) => user.attributes?.tenant_id?.[0] || null

// Đọc một cán bộ mà người gọi được phép tác động; sai điều kiện thì báo lỗi.
async function manageable(me, userId) {
  if (!/^[0-9a-f-]{36}$/.test(userId)) throw new HttpError(404, 'Không tìm thấy cán bộ')
  const user = await kcJson('GET', `/users/${userId}`)
  if (tenantOf(user) !== me.tenant) throw new HttpError(404, 'Không tìm thấy cán bộ')
  if (user.id === me.id) throw new HttpError(403, 'Không tự thao tác trên tài khoản của chính mình')
  const roles = await realmRoles(user.id)
  if (roles.some((r) => PROTECTED_ROLES.includes(r))) throw new HttpError(403, 'Chỉ quản lý được cán bộ xử lý')
  return user
}

// Luôn có cả chữ và số (chính sách mật khẩu của realm), bỏ các ký tự dễ nhầm (0/O, 1/l/I).
function temporaryPassword() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz'
  const digits = '23456789'
  const chars = letters + digits
  for (;;) {
    const p = Array.from({ length: 12 }, () => chars[randomInt(chars.length)]).join('')
    if (/[A-Za-z]/.test(p) && /[0-9]/.test(p)) return p
  }
}

// ---------- Nhật ký (API dữ liệu, kèm khóa nội bộ của lõi) ----------
async function audit(me, action, targetUsername) {
  try {
    const r = await fetch(`${REST_URL}/rpc/log_staff_action`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${me.token}`, 'x-workflow-token': WORKFLOW_TOKEN },
      body: JSON.stringify({ action, target_username: targetUsername }),
    })
    if (!r.ok) console.error(`Không ghi được nhật ký (${r.status}): ${(await r.text()).slice(0, 200)}`)
  } catch (e) {
    console.error('Không ghi được nhật ký:', e.message)
  }
}

// ---------- Đổi mật khẩu tạm lần đầu (không cần token) ----------
// Cán bộ mới (hoặc vừa được cấp lại mật khẩu) phải đặt mật khẩu mới trước khi dùng.
// Kiểm tra mật khẩu tạm bằng chính Keycloak: đăng nhập đúng mật khẩu nhưng còn việc bắt buộc thì Keycloak báo
// "Account is not fully set up"; sai mật khẩu thì báo lỗi khác. Chỉ khi đúng mới đặt mật khẩu mới.
// Giới hạn mỗi 15 phút: 5 lần cho một tên đăng nhập, 30 lần cho một địa chỉ IP (cả trụ sở xã dùng chung IP).
const LOGIN_CLIENT = env('LOGIN_CLIENT_ID', 'commune-app')
const attempts = new Map()
function limited(key, max) {
  const now = Date.now()
  const list = (attempts.get(key) || []).filter((t) => now - t < 15 * 60 * 1000)
  list.push(now)
  attempts.set(key, list)
  return list.length > max
}

async function firstPassword(req, res) {
  const b = await readJson(req)
  const username = String(b.username || '').trim().toLowerCase()
  const current = String(b.currentPassword || '')
  const next = String(b.newPassword || '')
  if (!username || !current) throw new HttpError(400, 'Thiếu tên đăng nhập hoặc mật khẩu tạm')
  if (next.length < 8 || next.length > 64) throw new HttpError(400, 'Mật khẩu mới phải từ 8 đến 64 ký tự')
  if (!/[A-Za-z]/.test(next) || !/[0-9]/.test(next)) throw new HttpError(400, 'Mật khẩu mới phải có cả chữ và số')
  if (next === current) throw new HttpError(400, 'Mật khẩu mới phải khác mật khẩu tạm')
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim()
  if (limited(`u:${username}`, 5) || limited(`ip:${ip}`, 30)) throw new HttpError(429, 'Thử quá nhiều lần, vui lòng đợi 15 phút')

  const r = await fetch(`${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'password', client_id: LOGIN_CLIENT, username, password: current }),
  })
  const body = await r.json().catch(() => ({}))
  if (r.ok) throw new HttpError(409, 'Tài khoản không cần đổi mật khẩu tạm, hãy đăng nhập bình thường')
  const desc = String(body.error_description || '')
  if (/disabled/i.test(desc)) throw new HttpError(403, 'Tài khoản đang bị khóa. Liên hệ lãnh đạo xã.')
  if (!/not fully set up/i.test(desc)) throw new HttpError(401, 'Tên đăng nhập hoặc mật khẩu tạm không đúng')

  const [user] = await kcJson('GET', `/users?username=${encodeURIComponent(username)}&exact=true&briefRepresentation=false`)
  if (!user || !tenantOf(user) || !(user.requiredActions || []).includes('UPDATE_PASSWORD')) {
    throw new HttpError(409, 'Tài khoản cần hoàn tất thông tin khác. Liên hệ lãnh đạo xã hoặc quản trị hệ thống.')
  }
  const set = await fetch(`${ADMIN}/users/${user.id}/reset-password`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${await adminToken()}`, 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'password', value: next, temporary: false }),
  })
  if (set.status === 400) {
    const e = await set.json().catch(() => ({}))
    throw new HttpError(400, `Mật khẩu mới chưa đạt yêu cầu của hệ thống${e.error_description ? ` (${e.error_description})` : ''}`)
  }
  if (!set.ok) throw new HttpError(502, 'Keycloak từ chối đặt mật khẩu')
  // Bỏ việc "đổi mật khẩu" khỏi danh sách bắt buộc (phòng khi phiên bản Keycloak không tự bỏ).
  const fresh = await kcJson('GET', `/users/${user.id}`)
  if ((fresh.requiredActions || []).includes('UPDATE_PASSWORD')) {
    await kc('PUT', `/users/${user.id}`, { ...fresh, requiredActions: fresh.requiredActions.filter((a) => a !== 'UPDATE_PASSWORD') })
  }
  attempts.delete(`u:${username}`)
  return json(res, 200, { username, changed: true })
}

// ---------- Tự đổi mật khẩu (cần token) ----------
// Mật khẩu hiện tại được kiểm tra bằng chính Keycloak, qua đúng client đã cấp token cho người gọi.
// Công dân dùng citizen-app (phải có vai trò citizen); cán bộ dùng commune-app.
const CITIZEN_CLIENT = env('CITIZEN_CLIENT_ID', 'citizen-app')
const CITIZEN_CLIENT_SECRET = process.env.CITIZEN_CLIENT_SECRET || ''
async function mePassword(req, res) {
  const { claims } = await verifiedClaims(req, [CITIZEN_CLIENT, LOGIN_CLIENT])
  const roles = claims.realm_access?.roles || []
  if (claims.azp === CITIZEN_CLIENT && !roles.includes('citizen')) throw new HttpError(403, 'Tài khoản không phải công dân')
  if (claims.azp === LOGIN_CLIENT && !claims.tenant_id && !roles.includes('sys_admin')) throw new HttpError(403, 'Tài khoản chưa được gán xã')
  const b = await readJson(req)
  const current = String(b.currentPassword || '')
  const next = String(b.newPassword || '')
  if (!current) throw new HttpError(400, 'Nhập mật khẩu hiện tại')
  if (next.length < 8 || next.length > 128) throw new HttpError(400, 'Mật khẩu mới phải từ 8 đến 128 ký tự')
  if (!/[A-Za-z]/.test(next) || !/[0-9]/.test(next)) throw new HttpError(400, 'Mật khẩu mới phải có cả chữ và số')
  if (next === current) throw new HttpError(400, 'Mật khẩu mới phải khác mật khẩu hiện tại')
  if (limited(`me:${claims.sub}`, 5)) throw new HttpError(429, 'Thử quá nhiều lần, vui lòng đợi 15 phút')

  const r = await fetch(`${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password', client_id: claims.azp, username: claims.preferred_username, password: current,
      ...(claims.azp === CITIZEN_CLIENT ? { client_secret: CITIZEN_CLIENT_SECRET } : {}),
    }),
  })
  if (!r.ok) throw new HttpError(403, 'Mật khẩu hiện tại không đúng')
  const set = await fetch(`${ADMIN}/users/${claims.sub}/reset-password`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${await adminToken()}`, 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'password', value: next, temporary: false }),
  })
  if (set.status === 400) {
    const e = await set.json().catch(() => ({}))
    throw new HttpError(400, `Mật khẩu mới chưa đạt yêu cầu của hệ thống${e.error_description ? ` (${e.error_description})` : ''}`)
  }
  if (!set.ok) throw new HttpError(502, 'Keycloak từ chối đặt mật khẩu')
  attempts.delete(`me:${claims.sub}`)
  return json(res, 200, { changed: true })
}

// ---------- Quản trị hệ thống: tạo xã kèm tài khoản lãnh đạo, quản lý lãnh đạo xã ----------
// Tài khoản quản trị duy nhất đặt trong .env (core/identity/setup.mjs). Mỗi xã có ít nhất một lãnh đạo; lãnh đạo
// tự tạo cán bộ xử lý (/accounts/staff). Mật khẩu tạm chỉ trả một lần, phải đổi khi đăng nhập lần đầu.
async function sysAdmin(req) {
  const { claims, token } = await verifiedClaims(req, [TOKEN_AZP])
  if (!(claims.realm_access?.roles || []).includes('sys_admin')) throw new HttpError(403, 'Chỉ quản trị hệ thống được quản lý xã')
  return { id: claims.sub, name: claims.name || claims.preferred_username, token }
}

// Gọi hàm của lõi qua PostgREST (mạng nội bộ): bằng token của người gọi, hoặc bằng khóa nội bộ khi không có người
// đăng nhập (đăng ký công dân). Lỗi nghiệp vụ của lõi giữ nguyên mã HTTP và lời nhắn.
async function coreRpc(fn, body, { token, workflow } = {}) {
  const r = await fetch(`${REST_URL}/rpc/${fn}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(workflow ? { 'x-workflow-token': WORKFLOW_TOKEN } : {}) },
    body: JSON.stringify(body),
  })
  const text = await r.text()
  const data = text ? JSON.parse(text) : null
  if (!r.ok) {
    const status = [400, 401, 403, 404, 409, 422].includes(r.status) ? r.status : 502
    const message = data?.code === '23505' ? 'Mã đã tồn tại' : data?.message
    throw new HttpError(status, message || 'API dữ liệu từ chối yêu cầu')
  }
  return data
}

const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,49}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// "Nguyễn Văn An" → họ "Nguyễn Văn", tên "An" (Keycloak lưu họ, tên riêng).
// Keycloak (person-name-prohibited-characters) không nhận các ký tự như ( ) < > & ; nên bỏ khỏi họ, tên lưu ở Keycloak;
// họ tên đầy đủ vẫn lưu nguyên ở hồ sơ công dân.
function splitName(fullName) {
  const parts = String(fullName || '').replace(/[<>&"$%!#?§;*~/\\|^=[\]{}()]/g, ' ').trim().split(/\s+/).filter(Boolean)
  if (!parts.length || parts.join(' ').length > 100) throw new HttpError(400, 'Nhập họ và tên (tối đa 100 ký tự)')
  return { firstName: parts.length > 1 ? parts.pop() : parts[0], lastName: parts.length ? parts.join(' ') : parts[0] }
}
function checkPassword(password, label = 'Mật khẩu') {
  if (password.length < 8 || password.length > 64) throw new HttpError(400, `${label} phải từ 8 đến 64 ký tự`)
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) throw new HttpError(400, `${label} phải có cả chữ và số`)
}

// Tạo tài khoản Keycloak và gán một vai trò; gán vai trò lỗi thì xóa tài khoản vừa tạo. Trả mã tài khoản.
async function createAccount({ username, firstName, lastName, email, attributes, role, password, temporary }) {
  let created
  try {
    created = await kc('POST', '/users', {
      username, firstName, lastName, ...(email ? { email } : {}), enabled: true, attributes,
      credentials: [{ type: 'password', value: password, temporary }],
    })
  } catch (e) {
    if (e.status === 400) throw new HttpError(400, 'Mật khẩu chưa đạt yêu cầu (tối thiểu 8 ký tự, có chữ và số) hoặc thông tin không hợp lệ')
    throw e
  }
  const id = String(created.headers.get('location') || '').split('/').pop()
  try {
    await kc('POST', `/users/${id}/role-mappings/realm`, [await kcJson('GET', `/roles/${role}`)])
  } catch (e) {
    await kc('DELETE', `/users/${id}`).catch(() => {})
    throw e
  }
  return id
}

async function leadersOf(code) {
  const users = await kcJson('GET', `/users?q=${encodeURIComponent(`tenant_id:${code}`)}&briefRepresentation=false&max=200`)
  const list = []
  for (const u of users.filter((u) => tenantOf(u) === code)) {
    if (!(await realmRoles(u.id)).includes('leader')) continue
    list.push({ id: u.id, username: u.username, firstName: u.firstName || '', lastName: u.lastName || '', email: u.email || null,
      enabled: u.enabled, createdAt: new Date(u.createdTimestamp).toISOString(),
      mustChangePassword: (u.requiredActions || []).includes('UPDATE_PASSWORD') })
  }
  return list.sort((a, b) => a.username.localeCompare(b.username))
}

async function tenantLeader(code, userId) {
  if (!/^[0-9a-f-]{36}$/.test(userId)) throw new HttpError(404, 'Không tìm thấy lãnh đạo xã')
  const user = await kcJson('GET', `/users/${userId}`)
  if (tenantOf(user) !== code || !(await realmRoles(user.id)).includes('leader')) throw new HttpError(404, 'Không tìm thấy lãnh đạo xã')
  return user
}

function leaderInput(b) {
  const username = String(b.leaderUsername ?? b.username ?? '').trim().toLowerCase()
  const email = String(b.leaderEmail ?? b.email ?? '').trim().toLowerCase()
  if (!USERNAME_RE.test(username)) throw new HttpError(400, 'Tên đăng nhập lãnh đạo 3–50 ký tự: chữ thường không dấu, số, dấu chấm, gạch')
  if (email && !EMAIL_RE.test(email)) throw new HttpError(400, 'Email không hợp lệ')
  return { username, email, ...splitName(b.leaderFullName ?? b.fullName) }
}

async function tenantsRoute(req, res, parts) {
  const admin = await sysAdmin(req)
  // POST /accounts/tenants — tạo đơn vị, bật gói, tạo lãnh đạo, trả mật khẩu tạm; lỗi thì hủy đơn vị vừa tạo.
  if (req.method === 'POST' && parts.length === 2) {
    const b = await readJson(req)
    const leader = leaderInput(b)
    const code = String(b.code || '').trim()
    // Gói nghiệp vụ bật cho đơn vị, ví dụ ["xa"] hoặc ["doanh-nghiep"]; lõi chỉ nhận gói đang được cài.
    const modules = b.modules === undefined ? [] : b.modules
    if (!Array.isArray(modules) || modules.length > 20 || !modules.every((m) => typeof m === 'string' && /^[a-z][a-z0-9-]{0,62}$/.test(m))) {
      throw new HttpError(400, 'modules phải là danh sách tên gói, ví dụ ["xa"]')
    }
    if ((await kcJson('GET', `/users?username=${encodeURIComponent(leader.username)}&exact=true`)).length) {
      throw new HttpError(409, 'Tên đăng nhập lãnh đạo đã được dùng')
    }
    const tenant = await coreRpc('add_tenant', { code, name: String(b.name || '') }, { token: admin.token })
    const password = temporaryPassword()
    try {
      for (const m of modules) await coreRpc('set_tenant_module', { tenant_code: tenant.code, module: m, enabled: true }, { token: admin.token })
      const id = await createAccount({ ...leader, attributes: { tenant_id: [tenant.code] }, role: 'leader', password, temporary: true })
      console.log(`Tạo đơn vị ${tenant.code} (gói: ${modules.join(', ') || 'chưa bật'}) kèm lãnh đạo ${leader.username}`)
      return json(res, 201, { tenant, modules, leader: { id, username: leader.username, temporaryPassword: password } })
    } catch (e) {
      await coreRpc('remove_new_tenant', { p_code: tenant.code }, { token: admin.token })
        .catch((x) => console.error(`Không hủy được xã ${tenant.code}: ${x.message}`))
      throw e
    }
  }
  const code = decodeURIComponent(parts[2] || '')
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(code) || parts[3] !== 'leaders') throw new HttpError(404, 'Không có đường dẫn này')
  // GET /accounts/tenants/:code/leaders
  if (req.method === 'GET' && parts.length === 4) return json(res, 200, await leadersOf(code))
  // POST /accounts/tenants/:code/leaders — thêm lãnh đạo cho xã đã có
  if (req.method === 'POST' && parts.length === 4) {
    const r = await fetch(`${REST_URL}/tenants?code=eq.${encodeURIComponent(code)}&select=code`, { headers: { authorization: `Bearer ${admin.token}` } })
    if (!r.ok || !(await r.json()).length) throw new HttpError(404, 'Không tìm thấy xã')
    const leader = leaderInput(await readJson(req))
    const password = temporaryPassword()
    const id = await createAccount({ ...leader, attributes: { tenant_id: [code] }, role: 'leader', password, temporary: true })
    return json(res, 201, { id, username: leader.username, temporaryPassword: password })
  }
  // POST /accounts/tenants/:code/leaders/:id/reset-password
  if (req.method === 'POST' && parts.length === 6 && parts[5] === 'reset-password') {
    const user = await tenantLeader(code, parts[4])
    const password = temporaryPassword()
    await kc('PUT', `/users/${user.id}/reset-password`, { type: 'password', value: password, temporary: true })
    return json(res, 200, { id: user.id, username: user.username, temporaryPassword: password })
  }
  // PATCH /accounts/tenants/:code/leaders/:id/status { enabled }
  if (req.method === 'PATCH' && parts.length === 6 && parts[5] === 'status') {
    const b = await readJson(req)
    if (typeof b.enabled !== 'boolean') throw new HttpError(400, 'Thiếu trạng thái enabled (true/false)')
    const user = await tenantLeader(code, parts[4])
    await kc('PUT', `/users/${user.id}`, { ...user, enabled: b.enabled })
    return json(res, 200, { id: user.id, username: user.username, enabled: b.enabled })
  }
  throw new HttpError(404, 'Không có đường dẫn này')
}

// ---------- HTTP ----------
async function readJson(req) {
  let raw = ''
  for await (const chunk of req) {
    raw += chunk
    if (raw.length > 10000) throw new HttpError(413, 'Dữ liệu quá lớn')
  }
  try { return raw ? JSON.parse(raw) : {} } catch { throw new HttpError(400, 'Dữ liệu không phải JSON') }
}
const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}

const moduleHandlers = await loadServiceHandlers('accounts', {
  limited, HttpError, readJson, USERNAME_RE, EMAIL_RE, checkPassword, splitName, kcJson, coreRpc, createAccount, json,
})

async function handle(req, res) {
  const url = new URL(req.url, 'http://accounts')
  const parts = url.pathname.split('/').filter(Boolean)
  if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/accounts/health')) {
    // Kiểm tra tài khoản dịch vụ còn xin được token Keycloak (không gọi thao tác quản trị nào).
    const t = Date.now()
    let keycloak = false
    try { keycloak = Boolean(await adminToken()) } catch { keycloak = false }
    return json(res, keycloak ? 200 : 503, { ok: keycloak, keycloakAdmin: { ok: keycloak, ms: Date.now() - t } })
  }
  if (req.method === 'POST' && url.pathname === '/accounts/first-password') return firstPassword(req, res)
  if (req.method === 'POST' && url.pathname === '/accounts/me/password') return mePassword(req, res)
  if (parts[0] === 'accounts' && parts[1] === 'tenants') return tenantsRoute(req, res, parts)
  if (parts[0] !== 'accounts' || parts[1] !== 'staff') {
    if (await dispatchHandlers(moduleHandlers, { req, res, url, parts })) return
    throw new HttpError(404, 'Không có đường dẫn này')
  }
  const me = await caller(req)

  // GET /accounts/staff
  if (req.method === 'GET' && parts.length === 2) {
    const users = await kcJson('GET', `/users?q=${encodeURIComponent(`tenant_id:${me.tenant}`)}&briefRepresentation=false&max=500`)
    const list = []
    for (const u of users.filter((u) => tenantOf(u) === me.tenant)) {
      const roles = await realmRoles(u.id)
      if (roles.includes('sys_admin')) continue
      const role = roles.includes('leader') ? 'leader' : 'officer'
      list.push({
        id: u.id, username: u.username, firstName: u.firstName || '', lastName: u.lastName || '',
        email: u.email || null, role, enabled: u.enabled, createdAt: new Date(u.createdTimestamp).toISOString(),
        isMe: u.id === me.id, manageable: role === 'officer' && u.id !== me.id,
        moduleRoles: roles.filter((r) => r.includes(':')),     // vai trò của gói, ví dụ doanh-nghiep:truong-phong
      })
    }
    list.sort((a, b) => (a.role === b.role ? a.username.localeCompare(b.username) : a.role === 'leader' ? -1 : 1))
    return json(res, 200, list)
  }

  // POST /accounts/staff
  if (req.method === 'POST' && parts.length === 2) {
    const b = await readJson(req)
    const username = String(b.username || '').trim().toLowerCase()
    const firstName = String(b.firstName || '').trim()
    const lastName = String(b.lastName || '').trim()
    const email = String(b.email || '').trim().toLowerCase()
    if (!/^[a-z0-9][a-z0-9._-]{2,49}$/.test(username)) throw new HttpError(400, 'Tên đăng nhập 3–50 ký tự: chữ thường không dấu, số, dấu chấm, gạch')
    if (!firstName || !lastName || firstName.length > 60 || lastName.length > 60) throw new HttpError(400, 'Nhập họ và tên (tối đa 60 ký tự mỗi phần)')
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Email không hợp lệ')
    const password = temporaryPassword()
    const created = await kc('POST', '/users', {
      username, firstName, lastName, ...(email ? { email } : {}), enabled: true,
      attributes: { tenant_id: [me.tenant] },
      credentials: [{ type: 'password', value: password, temporary: true }],
    })
    const id = String(created.headers.get('location') || '').split('/').pop()
    try {
      const role = await kcJson('GET', `/roles/${MANAGED_ROLE}`)
      await kc('POST', `/users/${id}/role-mappings/realm`, [role])
    } catch (e) {
      await kc('DELETE', `/users/${id}`).catch(() => {})
      throw e
    }
    await audit(me, 'create', username)
    return json(res, 201, { id, username, role: MANAGED_ROLE, temporaryPassword: password })
  }

  // PUT /accounts/staff/:id/roles { roles: ["<gói>:<vai trò>", ...] } — đặt toàn bộ vai trò của gói cho một cán bộ.
  // Chỉ vai trò của gói đơn vị đã bật (lõi: GET /rest/module_roles bằng token lãnh đạo); không đụng vai trò lõi.
  if (req.method === 'PUT' && parts.length === 4 && parts[3] === 'roles') {
    const b = await readJson(req)
    if (!Array.isArray(b.roles) || b.roles.length > 20 || !b.roles.every((r) => typeof r === 'string' && /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/.test(r))) {
      throw new HttpError(400, 'roles phải là danh sách vai trò của gói, ví dụ ["doanh-nghiep:truong-phong"]')
    }
    const r = await fetch(`${REST_URL}/module_roles?select=role`, { headers: { authorization: `Bearer ${me.token}` } })
    if (!r.ok) throw new HttpError(502, 'Không đọc được vai trò của gói từ API dữ liệu')
    const allowed = (await r.json()).map((x) => x.role)
    const bad = b.roles.filter((x) => !allowed.includes(x))
    if (bad.length) throw new HttpError(400, `Không gán được vai trò: ${bad.join(', ')} (gói chưa cài hoặc đơn vị chưa bật gói)`)
    const user = await manageable(me, parts[2])
    const current = await kcJson('GET', `/users/${user.id}/role-mappings/realm`)
    const remove = current.filter((x) => x.name.includes(':') && !b.roles.includes(x.name))
    const add = []
    for (const name of b.roles.filter((x) => !current.some((c) => c.name === x))) {
      try { add.push(await kcJson('GET', `/roles/${encodeURIComponent(name)}`)) } catch {
        throw new HttpError(409, `Keycloak chưa có vai trò ${name}; chạy make up để tạo vai trò của gói`)
      }
    }
    if (remove.length) await kc('DELETE', `/users/${user.id}/role-mappings/realm`, remove)
    if (add.length) await kc('POST', `/users/${user.id}/role-mappings/realm`, add)
    await audit(me, 'set_roles', user.username)
    return json(res, 200, { id: user.id, username: user.username, moduleRoles: b.roles })
  }

  // PATCH /accounts/staff/:id/status
  if (req.method === 'PATCH' && parts.length === 4 && parts[3] === 'status') {
    const b = await readJson(req)
    if (typeof b.enabled !== 'boolean') throw new HttpError(400, 'Thiếu trạng thái enabled (true/false)')
    const user = await manageable(me, parts[2])
    await kc('PUT', `/users/${user.id}`, { ...user, enabled: b.enabled })
    await audit(me, b.enabled ? 'unlock' : 'lock', user.username)
    return json(res, 200, { id: user.id, username: user.username, enabled: b.enabled })
  }

  // PATCH /accounts/staff/:id — sửa họ tên, email của cán bộ xử lý
  if (req.method === 'PATCH' && parts.length === 3) {
    const b = await readJson(req)
    const user = await manageable(me, parts[2])
    const firstName = String(b.firstName ?? user.firstName ?? '').trim()
    const lastName = String(b.lastName ?? user.lastName ?? '').trim()
    const email = String(b.email ?? user.email ?? '').trim().toLowerCase()
    if (!firstName || !lastName || firstName.length > 60 || lastName.length > 60) throw new HttpError(400, 'Nhập họ và tên (tối đa 60 ký tự mỗi phần)')
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Email không hợp lệ')
    await kc('PUT', `/users/${user.id}`, { ...user, firstName, lastName, email: email || null })
    await audit(me, 'update', user.username)
    return json(res, 200, { id: user.id, username: user.username, firstName, lastName, email: email || null })
  }

  // DELETE /accounts/staff/:id — xóa hẳn tài khoản; phải khóa trước để tránh bấm nhầm.
  // Hồ sơ cá nhân, việc được giao, nhật ký vẫn giữ trong cơ sở dữ liệu để tra cứu.
  if (req.method === 'DELETE' && parts.length === 3) {
    const user = await manageable(me, parts[2])
    if (user.enabled) throw new HttpError(409, 'Hãy khóa tài khoản trước khi xóa')
    await kc('DELETE', `/users/${user.id}`)
    await audit(me, 'delete', user.username)
    return json(res, 200, { id: user.id, username: user.username, deleted: true })
  }

  // POST /accounts/staff/:id/reset-password
  if (req.method === 'POST' && parts.length === 4 && parts[3] === 'reset-password') {
    const user = await manageable(me, parts[2])
    const password = temporaryPassword()
    await kc('PUT', `/users/${user.id}/reset-password`, { type: 'password', value: password, temporary: true })
    await audit(me, 'reset_password', user.username)
    return json(res, 200, { id: user.id, username: user.username, temporaryPassword: password })
  }

  throw new HttpError(404, 'Không có đường dẫn này')
}

createServer((req, res) => {
  handle(req, res).catch((e) => {
    const status = e instanceof HttpError ? e.status : 500
    if (status === 500) console.error(e)
    if (!res.headersSent) json(res, status, { message: status === 500 ? 'Lỗi dịch vụ tài khoản' : e.message })
  })
}).listen(PORT, () => console.log(`Dịch vụ tài khoản chạy ở cổng ${PORT}`))
