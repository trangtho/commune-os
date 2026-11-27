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
// Tệp realm không có tài khoản người dùng nào; đơn vị, lãnh đạo, cán bộ, người dùng của gói tạo qua API của lõi (make demo tạo mẫu).
//   * thuộc tính khai báo trong user profile (chỉ thêm thuộc tính chưa có)
//   * client liệt kê trong CONFIDENTIAL: luôn là client bí mật (có tài khoản dịch vụ) với secret lấy từ biến môi trường
//   * cấu hình Keycloak riêng của các gói đang bật (mục "identity" trong module.json, ví dụ modules/xa/identity/realm.json:
//     vai trò, client, thuộc tính user profile, client bí mật), bổ sung giống mục của realm lõi
//   * vai trò của các gói đang bật (mục "roles" trong modules/<gói>/module.json), tên "<gói>:<vai trò>"; chỉ thêm,
//     cập nhật mô tả, không xóa (vai trò của gói đã gỡ vẫn giữ để không mất phân quyền đã gán)
// Biến ${TÊN} trong tệp realm được thay bằng biến môi trường cùng tên (giống Keycloak khi nạp realm).
// Không thư viện ngoài (chỉ Node 22).

import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const KEYCLOAK_URL = (process.env.KEYCLOAK_URL || 'http://identity:8080').replace(/\/$/, '')
const REALM = 'communeos'
const ADMIN_USER = process.env.KEYCLOAK_ADMIN
const ADMIN_PASSWORD = process.env.KEYCLOAK_ADMIN_PASSWORD
const REALM_FILE = process.env.REALM_FILE || '/app/realm/communeos-realm.json'

// Những mục của realm lõi được bổ sung khi thiếu. Thêm mục mới vào đây khi sửa tệp realm.
const IMPORT = {
  realmRoles: [],
  clients: [],
}
const SYS_ADMIN_USERNAME = String(process.env.COMMUNEOS_ADMIN_USERNAME || '').trim().toLowerCase()
const SYS_ADMIN_PASSWORD = String(process.env.COMMUNEOS_ADMIN_PASSWORD || '')
// Client bí mật và biến môi trường chứa secret.
const CONFIDENTIAL = {
  'accounts-service': 'KEYCLOAK_ACCOUNTS_SECRET',
}
const MODULES = String(process.env.COMMUNEOS_MODULES || 'xa').split(/[\s,]+/).filter(Boolean)
const MODULES_DIR = process.env.MODULES_DIR || '/modules'
// Biến ${TÊN} trong tệp realm được thay bằng biến môi trường cùng tên.
const substitute = (raw) => raw.replace(/\$\{([A-Z0-9_]+)\}/g, (all, name) => (process.env[name] ? JSON.stringify(process.env[name]).slice(1, -1) : all))

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
  const realm = JSON.parse(substitute(raw))
  // Cấu hình Keycloak riêng của các gói đang bật.
  const fragments = []
  for (const m of MODULES) {
    const file = join(MODULES_DIR, m, 'module.json')
    if (!existsSync(file)) continue
    const rel = JSON.parse(await readFile(file, 'utf8')).identity
    if (!rel) continue
    if (/^\/|\.\./.test(rel)) throw new Error(`${m}/module.json: "identity" không hợp lệ`)
    fragments.push({ module: m, ...JSON.parse(substitute(await readFile(join(MODULES_DIR, m, rel), 'utf8'))) })
  }
  for (const f of fragments) Object.assign(CONFIDENTIAL, f.confidentialClients || {})
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
  const wanted = [...fileProfile.attributes, ...fragments.flatMap((f) => f.userProfileAttributes || [])]
  const missing = wanted.filter((a) => !have.has(a.name))
  if (missing.length) {
    profile.attributes.push(...missing)
    await api('PUT', '/users/profile', profile)
  }
  console.log(`User profile: thêm ${missing.length} thuộc tính${missing.length ? ` (${missing.map((a) => a.name).join(', ')})` : ''}`)

  // 2. Vai trò, client, người dùng: partialImport bỏ qua mục đã tồn tại.
  const pick = (list, key, names) => (list || []).filter((x) => names.includes(x[key]))
  const result = await api('POST', '/partialImport', {
    ifResourceExists: 'SKIP',
    roles: { realm: [...pick(realm.roles.realm, 'name', IMPORT.realmRoles), ...fragments.flatMap((f) => f.roles?.realm || [])] },
    clients: [...pick(realm.clients, 'clientId', IMPORT.clients), ...fragments.flatMap((f) => f.clients || [])],
  })
  console.log(`partialImport: thêm ${result.added}, bỏ qua ${result.skipped} (đã có)`)

  // 3. Client bí mật: realm cài từ bản trước có thể còn là client công khai hoặc secret cũ.
  for (const [clientId, variable] of Object.entries(CONFIDENTIAL)) {
    const secret = process.env[variable]
    if (!secret) throw new Error(`Thiếu ${variable}`)
    const [client] = await api('GET', `/clients?clientId=${encodeURIComponent(clientId)}`)
    if (!client) continue
    const current = client.publicClient ? null : (await api('GET', `/clients/${client.id}/client-secret`))?.value
    // Tài khoản dịch vụ: máy chủ ứng dụng giữ client bí mật gọi lõi thay mặt chính nó (gói xã dùng để liên kết đăng nhập
    // OIDC bên ngoài), không cần khóa dùng chung riêng.
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
  // 6. Vai trò của các gói đang bật: gói khai báo, lõi tạo trong Keycloak; lãnh đạo đơn vị gán cho nhân viên qua
  //    dịch vụ tài khoản (PUT /accounts/staff/:id/roles), chỉ vai trò của gói đơn vị đã bật.
  const existing = new Map((await api('GET', '/roles?briefRepresentation=false&max=1000')).map((r) => [r.name, r]))
  for (const m of String(process.env.COMMUNEOS_MODULES || 'xa').split(/[\s,]+/).filter(Boolean)) {
    const file = join(process.env.MODULES_DIR || '/modules', m, 'module.json')
    if (!existsSync(file)) continue
    for (const r of JSON.parse(await readFile(file, 'utf8')).roles || []) {
      if (!/^[a-z][a-z0-9-]{0,40}$/.test(r.name || '')) throw new Error(`${m}/module.json: tên vai trò "${r.name}" không hợp lệ`)
      const name = `${m}:${r.name}`
      const description = String(r.title || r.name) + (r.description ? ` – ${r.description}` : '')
      const found = existing.get(name)
      if (!found) {
        await api('POST', '/roles', { name, description })
        console.log(`Vai trò của gói ${m}: tạo ${name}`)
      } else if (found.description !== description) {
        await api('PUT', `/roles/${encodeURIComponent(name)}`, { ...found, description })
      }
    }
  }
  console.log('Cấu hình định danh đã đủ.')
}

main().catch((e) => {
  console.error(`Không bổ sung được cấu hình Keycloak: ${e.message}`)
  process.exit(1)
})
