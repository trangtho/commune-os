// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
//
// Bổ sung cấu hình còn thiếu vào realm communeos đã có sẵn (chạy một lần rồi dừng).
// Keycloak chỉ nạp tệp realm khi realm chưa tồn tại; máy đã cài từ bản trước sẽ thiếu các mục mới.
// Tệp này đọc realm/communeos-realm.json và thêm những mục chưa có, KHÔNG ghi đè mục đã có:
//   * vai trò, client, người dùng liệt kê trong IMPORT (qua partialImport, ifResourceExists=SKIP)
//   * thuộc tính khai báo trong user profile (chỉ thêm thuộc tính chưa có)
//   * client liệt kê trong CONFIDENTIAL: luôn là client bí mật với secret lấy từ biến môi trường
// Biến ${TÊN} trong tệp realm được thay bằng biến môi trường cùng tên (giống Keycloak khi nạp realm).
// Không thư viện ngoài (chỉ Node 22).

import { readFile } from 'node:fs/promises'

const KEYCLOAK_URL = (process.env.KEYCLOAK_URL || 'http://identity:8080').replace(/\/$/, '')
const REALM = 'communeos'
const ADMIN_USER = process.env.KEYCLOAK_ADMIN
const ADMIN_PASSWORD = process.env.KEYCLOAK_ADMIN_PASSWORD
const REALM_FILE = process.env.REALM_FILE || '/app/realm/communeos-realm.json'

// Những mục được bổ sung khi thiếu. Thêm mục mới vào đây khi sửa tệp realm.
const IMPORT = {
  realmRoles: ['citizen'],
  clients: ['citizen-app'],
  users: ['congdan.demo', 'congdan.khac'],
}
// Client bí mật và biến môi trường chứa secret.
const CONFIDENTIAL = { 'citizen-app': 'CITIZEN_KEYCLOAK_SECRET' }

if (!ADMIN_USER || !ADMIN_PASSWORD) {
  console.error('Thiếu KEYCLOAK_ADMIN hoặc KEYCLOAK_ADMIN_PASSWORD')
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
  const fileProfile = JSON.parse(
    realm.components['org.keycloak.userprofile.UserProfileProvider'][0].config['kc.user.profile.config'][0],
  )
  const profile = await api('GET', '/users/profile')
  const have = new Set(profile.attributes.map((a) => a.name))
  const missing = fileProfile.attributes.filter((a) => !have.has(a.name))
  if (missing.length) {
    profile.attributes.push(...missing)
    await api('PUT', '/users/profile', profile)
  }
  console.log(`User profile: thêm ${missing.length} thuộc tính${missing.length ? ` (${missing.map((a) => a.name).join(', ')})` : ''}`)

  // 2. Vai trò, client, người dùng: partialImport bỏ qua mục đã tồn tại.
  const pick = (list, key, names) => (list || []).filter((x) => names.includes(x[key]))
  const result = await api('POST', '/partialImport', {
    ifResourceExists: 'SKIP',
    roles: { realm: pick(realm.roles.realm, 'name', IMPORT.realmRoles) },
    clients: pick(realm.clients, 'clientId', IMPORT.clients),
    users: pick(realm.users, 'username', IMPORT.users),
  })
  console.log(`partialImport: thêm ${result.added}, bỏ qua ${result.skipped} (đã có)`)

  // 3. Client bí mật: realm cài từ bản trước có thể còn là client công khai hoặc secret cũ.
  for (const [clientId, variable] of Object.entries(CONFIDENTIAL)) {
    const secret = process.env[variable]
    if (!secret) throw new Error(`Thiếu ${variable}`)
    const [client] = await api('GET', `/clients?clientId=${encodeURIComponent(clientId)}`)
    if (!client) continue
    const current = client.publicClient ? null : (await api('GET', `/clients/${client.id}/client-secret`))?.value
    if (client.publicClient || current !== secret) {
      await api('PUT', `/clients/${client.id}`, { ...client, publicClient: false, clientAuthenticatorType: 'client-secret', secret })
      console.log(`Client ${clientId}: đặt là client bí mật, cập nhật secret`)
    }
  }
  console.log('Cấu hình định danh đã đủ.')
}

main().catch((e) => {
  console.error(`Không bổ sung được cấu hình Keycloak: ${e.message}`)
  process.exit(1)
})
