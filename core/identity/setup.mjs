// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
//
// Bổ sung cấu hình còn thiếu vào realm communeos đã có sẵn (chạy một lần rồi dừng).
// Keycloak chỉ nạp tệp realm khi realm chưa tồn tại; máy đã cài từ bản trước sẽ thiếu các mục mới.
// Tệp này đọc realm/communeos-realm.json và thêm những mục chưa có, KHÔNG ghi đè mục đã có:
//   * vai trò, client liệt kê trong IMPORT (qua partialImport, ifResourceExists=SKIP)
//   * chính sách mật khẩu của realm (tối thiểu 8 ký tự, có chữ và số)
//   * tài khoản quản trị hệ thống duy nhất, từ COMMUNEOS_ADMIN_USERNAME, COMMUNEOS_ADMIN_PASSWORD trong .env
//     (chưa có thì tạo; đã có thì đặt lại mật khẩu theo .env và bảo đảm vai trò sys_admin: đổi mật khẩu quản trị
//     bằng cách sửa .env rồi make up)
// Tệp realm không có tài khoản người dùng nào; xã, lãnh đạo, cán bộ, công dân tạo qua API của lõi (make demo tạo mẫu).
//   * thuộc tính khai báo trong user profile (chỉ thêm thuộc tính chưa có)
//   * client liệt kê trong CONFIDENTIAL: luôn là client bí mật (có tài khoản dịch vụ) với secret lấy từ biến môi trường
// Biến ${TÊN} trong tệp realm được thay bằng biến môi trường cùng tên (giống Keycloak khi nạp realm).
// Không thư viện ngoài (chỉ Node 22).

import { readFile } from 'node:fs/promises'
import { loadManifests } from '../module-loader.mjs'
import { identityConfig } from './module-config.mjs'

const KEYCLOAK_URL = (process.env.KEYCLOAK_URL || 'http://identity:8080').replace(/\/$/, '')
const REALM = 'communeos'
const ADMIN_USER = process.env.KEYCLOAK_ADMIN
const ADMIN_PASSWORD = process.env.KEYCLOAK_ADMIN_PASSWORD
const REALM_FILE = process.env.REALM_FILE || '/app/realm/communeos-realm.json'

const SYS_ADMIN_USERNAME = String(process.env.COMMUNEOS_ADMIN_USERNAME || '').trim().toLowerCase()
const SYS_ADMIN_PASSWORD = String(process.env.COMMUNEOS_ADMIN_PASSWORD || '')
if (!ADMIN_USER || !ADMIN_PASSWORD) {
  console.error('Thiếu KEYCLOAK_ADMIN hoặc KEYCLOAK_ADMIN_PASSWORD')
  process.exit(1)
}
if (!/^[a-z0-9][a-z0-9._-]{2,49}$/.test(SYS_ADMIN_USERNAME) || SYS_ADMIN_PASSWORD.length < 10) {
  console.error('COMMUNEOS_ADMIN_USERNAME, COMMUNEOS_ADMIN_PASSWORD trong .env chưa hợp lệ (chạy make check-env để xem lý do)')
  process.exit(1)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function adminToken() {
  const r = await fetch(`${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    body: new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli', username: ADMIN_USER, password: ADMIN_PASSWORD }),
  })
  if (r.status === 401) throw new Error('Sai tài khoản quản trị Keycloak (KEYCLOAK_ADMIN, KEYCLOAK_ADMIN_PASSWORD)')
  if (!r.ok) throw new Error(`Keycloak chưa sẵn sàng (${r.status})`)
  return (await r.json()).access_token
}

// Chờ Keycloak khởi động xong (tối đa khoảng 5 phút).
async function waitToken() {
  for (let i = 1; ; i++) {
    try {
      return await adminToken()
    } catch (e) {
      if (/Sai tài khoản/.test(e.message) || i >= 60) throw e
      await sleep(5000)
    }
  }
}

async function main() {
  const raw = await readFile(REALM_FILE, 'utf8')
  const realm = JSON.parse(raw.replace(/\$\{([A-Z0-9_]+)\}/g, (all, name) => (process.env[name] ? JSON.stringify(process.env[name]).slice(1, -1) : all)))
  const config = identityConfig(realm, loadManifests())
  // Replace only confidential-client secrets, not arbitrary placeholders in module data.
  for (const [id, variable] of Object.entries(config.confidential)) {
    if (!process.env[variable]) throw new Error(`Thiếu ${variable}`)
    const client = config.clients.find(c => c.clientId === id)
    if (client) client.secret = process.env[variable]
  }
  const token = await waitToken()
  const api = async (method, path, body) => {
    const r = await fetch(`${KEYCLOAK_URL}/admin/realms/${REALM}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!r.ok) throw new Error(`${method} ${path} → ${r.status}: ${(await r.text()).slice(0, 300)}`)
    const text = await r.text()
    return text ? JSON.parse(text) : null
  }

  // 1. Thuộc tính trong user profile: thêm thuộc tính có trong tệp mà realm đang thiếu.
  const fileProfile = { attributes: config.attributes }
  const profile = await api('GET', '/users/profile')
  const have = new Set(profile.attributes.map((a) => a.name))
  const missing = fileProfile.attributes.filter((a) => !have.has(a.name))
  if (missing.length) {
    profile.attributes.push(...missing)
    await api('PUT', '/users/profile', profile)
  }
  console.log(`User profile: thêm ${missing.length} thuộc tính${missing.length ? ` (${missing.map((a) => a.name).join(', ')})` : ''}`)

  // 2. Vai trò, client, người dùng: partialImport bỏ qua mục đã tồn tại.
  const result = await api('POST', '/partialImport', {
    ifResourceExists: 'SKIP',
    roles: { realm: config.roles.filter(x => !realm.roles.realm.some(b => b.name === x.name)) },
    clients: config.clients.filter(x => !realm.clients.some(b => b.clientId === x.clientId)),
  })
  console.log(`partialImport: thêm ${result.added}, bỏ qua ${result.skipped} (đã có)`)

  // 3. Client bí mật: realm cài từ bản trước có thể còn là client công khai hoặc secret cũ.
  for (const [clientId, variable] of Object.entries(config.confidential)) {
    const secret = process.env[variable]
    if (!secret) throw new Error(`Thiếu ${variable}`)
    const [client] = await api('GET', `/clients?clientId=${encodeURIComponent(clientId)}`)
    if (!client) throw new Error(`Thiếu client ${clientId}`)
    const current = client.publicClient ? null : (await api('GET', `/clients/${client.id}/client-secret`))?.value
    // Tài khoản dịch vụ: máy chủ Kênh người dân gọi lõi thay mặt chính nó (liên kết đăng nhập OIDC bên ngoài),
    // không cần khóa dùng chung riêng (core/db/init/34-citizen-direct-access.sql, public.is_citizen_service()).
    if (client.publicClient || current !== secret || !client.serviceAccountsEnabled) {
      await api('PUT', `/clients/${client.id}`, { ...client, publicClient: false, clientAuthenticatorType: 'client-secret', secret,
        serviceAccountsEnabled: true })
      console.log(`Client ${clientId}: client bí mật có tài khoản dịch vụ, cập nhật secret`)
    }
  }
  // 4. Chính sách mật khẩu: áp cho mọi tài khoản tạo hay đổi mật khẩu từ nay (Keycloak tự kiểm tra).
  const current = await api('GET', '')
  if (current.passwordPolicy !== realm.passwordPolicy) {
    await api('PUT', '', { ...current, passwordPolicy: realm.passwordPolicy })
    console.log(`Chính sách mật khẩu: ${realm.passwordPolicy}`)
  }

  // 5. Tài khoản quản trị hệ thống duy nhất, từ .env.
  const [sysAdminRole] = [await api('GET', '/roles/sys_admin')]
  let [admin] = await api('GET', `/users?username=${encodeURIComponent(SYS_ADMIN_USERNAME)}&exact=true`)
  if (!admin) {
    await api('POST', '/users', {
      username: SYS_ADMIN_USERNAME, enabled: true, firstName: 'Quản trị', lastName: 'hệ thống',
      credentials: [{ type: 'password', value: SYS_ADMIN_PASSWORD, temporary: false }],
    })
    ;[admin] = await api('GET', `/users?username=${encodeURIComponent(SYS_ADMIN_USERNAME)}&exact=true`)
    console.log(`Tạo tài khoản quản trị hệ thống: ${SYS_ADMIN_USERNAME}`)
  }
  else {
    // .env là nguồn duy nhất của mật khẩu quản trị: mỗi lần make up đồng bộ lại (máy cài từ bản cũ còn mật khẩu mẫu).
    await api('PUT', `/users/${admin.id}/reset-password`, { type: 'password', value: SYS_ADMIN_PASSWORD, temporary: false })
    if (!admin.enabled) await api('PUT', `/users/${admin.id}`, { ...admin, enabled: true })
  }
  const roles = (await api('GET', `/users/${admin.id}/role-mappings/realm`)).map((r) => r.name)
  if (!roles.includes('sys_admin')) {
    await api('POST', `/users/${admin.id}/role-mappings/realm`, [sysAdminRole])
    console.log(`Gán vai trò sys_admin cho ${SYS_ADMIN_USERNAME}`)
  }
  console.log('Cấu hình định danh đã đủ.')
}

main().catch((e) => {
  console.error(`Không bổ sung được cấu hình Keycloak: ${e.message}`)
  process.exit(1)
})
