// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
//
// make demo: tạo dữ liệu trình diễn bằng chính các API của lõi, đúng như người dùng thật làm:
//   1. Quản trị hệ thống (tài khoản trong .env) tạo 2 xã mẫu kèm lãnh đạo xã    POST /accounts/tenants
//      bật gói xã                                                                POST /rest/rpc/set_tenant_module
//      và mở mọi thủ tục đã công bố cho 2 xã                                     POST /rest/rpc/set_tenant_procedures
//   2. Lãnh đạo xã tạo cán bộ xử lý                                              POST /accounts/staff
//   3. Người dân tự đăng ký                                                      POST /public/accounts/register
// Mật khẩu tạm của lãnh đạo, cán bộ được đổi thành DEMO_PASSWORD qua           POST /accounts/first-password
// Hồ sơ mẫu (modules/xa/demo/demo-data.sql) do Makefile nạp sau bước này.
//
// Chạy lại nhiều lần được: tài khoản đã có thì giữ, chỉ đặt lại mật khẩu khi không đăng nhập được bằng DEMO_PASSWORD
// (ví dụ bản cài cũ còn tài khoản mẫu mật khẩu 12345). Chạy trong mạng Docker của dự án (xem Makefile).
// Không dùng cho máy chủ thật: mọi tài khoản mẫu dùng chung một mật khẩu công khai.

const GW = (process.env.GATEWAY_URL || 'http://gateway:9080').replace(/\/$/, '')
const KC = (process.env.KEYCLOAK_URL || 'http://identity:8080').replace(/\/$/, '')
const REALM = 'communeos'
const PASS = process.env.DEMO_PASSWORD || 'Demo@2026!'
const ADMIN_USER = process.env.COMMUNEOS_ADMIN_USERNAME
const ADMIN_PASS = process.env.COMMUNEOS_ADMIN_PASSWORD
const CITIZEN_SECRET = process.env.CITIZEN_KEYCLOAK_SECRET || ''

const TENANTS = [
  {
    code: 'xa-a', name: 'Xã Tân Lập (mô phỏng)',
    leader: { username: 'lanhdao.xa-a', fullName: 'Lãnh Đạo Xã A', email: 'lanhdao.xa-a@example.com' },
    staff: [{ username: 'canbo.xa-a', firstName: 'Xã A', lastName: 'Cán Bộ', email: 'canbo.xa-a@example.com' }],
  },
  {
    code: 'xa-b', name: 'Xã Minh Hòa (mô phỏng)',
    leader: { username: 'lanhdao.xa-b', fullName: 'Lãnh Đạo Xã B', email: 'lanhdao.xa-b@example.com' },
    staff: [{ username: 'canbo.xa-b', firstName: 'Xã B', lastName: 'Cán Bộ', email: 'canbo.xa-b@example.com' }],
  },
]
const CITIZENS = [
  { username: 'congdan.demo', fullName: 'Nguyễn Văn An (mẫu)', email: 'demo@communeos.local', tenantCode: 'xa-a' },
  { username: 'congdan.khac', fullName: 'Trần Thị Bình (mẫu)', email: 'demo2@communeos.local', tenantCode: 'xa-b' },
]

const fail = (msg) => { console.error(`make demo: ${msg}`); process.exit(1) }
if (!ADMIN_USER || !ADMIN_PASS) fail('thiếu COMMUNEOS_ADMIN_USERNAME / COMMUNEOS_ADMIN_PASSWORD trong .env')
if (PASS.length < 8 || !/[A-Za-z]/.test(PASS) || !/[0-9]/.test(PASS)) fail('DEMO_PASSWORD phải tối thiểu 8 ký tự, có chữ và số')

async function call(method, path, { token, body } = {}) {
  const r = await fetch(`${GW}${path}`, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await r.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = { message: text.slice(0, 200) } }
  return { status: r.status, ok: r.ok, data }
}
async function must(method, path, opts) {
  const r = await call(method, path, opts)
  if (!r.ok) fail(`${method} ${path} → ${r.status} ${r.data?.message || ''}`)
  return r.data
}

// Đăng nhập Keycloak bằng mật khẩu; trả token hoặc null (sai mật khẩu, đang phải đổi mật khẩu tạm...).
async function login(username, password, client = 'commune-app') {
  const r = await fetch(`${KC}/realms/${REALM}/protocol/openid-connect/token`, {
    method: 'POST',
    body: new URLSearchParams({ grant_type: 'password', client_id: client, username, password,
      ...(client === 'citizen-app' ? { client_secret: CITIZEN_SECRET } : {}) }),
  })
  return r.ok ? (await r.json()).access_token : null
}

// Mật khẩu tạm → DEMO_PASSWORD, đúng luồng người dùng đăng nhập lần đầu.
async function setDemoPassword(username, temporaryPassword) {
  await must('POST', '/accounts/first-password', { body: { username, currentPassword: temporaryPassword, newPassword: PASS } })
}

async function waitForGateway() {
  for (let i = 0; i < 60; i++) {
    try {
      // API công khai: cổng và API dữ liệu đã chạy (các API khác cần token).
      const r = await fetch(`${GW}/public/rpc/public_registration_tenants`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
      // Dịch vụ tài khoản đã chạy: gọi đổi mật khẩu tạm không kèm dữ liệu thì trả 400 (502 khi chưa chạy).
      const a = await fetch(`${GW}/accounts/first-password`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
      if (r.ok && a.status === 400) return
    } catch { /* chưa sẵn sàng */ }
    await new Promise((ok) => setTimeout(ok, 2000))
  }
  fail(`không gọi được cổng API ${GW}; chạy make up trước`)
}

async function main() {
  await waitForGateway()
  const admin = await login(ADMIN_USER, ADMIN_PASS)
  if (!admin) fail(`quản trị ${ADMIN_USER} không đăng nhập được bằng mật khẩu trong .env (chạy lại make up để đồng bộ)`)
  const procedures = (await must('GET', '/rest/procedures?select=id,published', { token: admin }))
    .filter((p) => p.published !== false).map((p) => p.id)

  for (const t of TENANTS) {
    const exists = (await must('GET', `/rest/tenants?code=eq.${t.code}&select=code`, { token: admin })).length > 0
    if (!exists) {
      const r = await must('POST', '/accounts/tenants', { token: admin, body: {
        code: t.code, name: t.name, modules: ['xa'], leaderUsername: t.leader.username, leaderFullName: t.leader.fullName, leaderEmail: t.leader.email } })
      await setDemoPassword(t.leader.username, r.leader.temporaryPassword)
      console.log(`Tạo xã ${t.code} kèm lãnh đạo ${t.leader.username}`)
    } else {
      const base = `/accounts/tenants/${t.code}/leaders`
      let leader = (await must('GET', base, { token: admin })).find((l) => l.username === t.leader.username)
      if (!leader) {
        const r = await must('POST', base, { token: admin, body: t.leader })
        await setDemoPassword(t.leader.username, r.temporaryPassword)
        console.log(`Thêm lãnh đạo ${t.leader.username} cho xã ${t.code}`)
      } else {
        if (!leader.enabled) await must('PATCH', `${base}/${leader.id}/status`, { token: admin, body: { enabled: true } })
        if (!(await login(t.leader.username, PASS))) {
          const r = await must('POST', `${base}/${leader.id}/reset-password`, { token: admin })
          await setDemoPassword(t.leader.username, r.temporaryPassword)
          console.log(`Đặt lại mật khẩu demo cho ${t.leader.username}`)
        }
      }
    }
    // Xã mẫu dùng gói xã (bật lại nếu quản trị đã tắt), rồi mở mọi thủ tục đã công bố.
    await must('POST', '/rest/rpc/set_tenant_module', { token: admin, body: { tenant_code: t.code, module: 'xa', enabled: true } })
    await must('POST', '/rest/rpc/set_tenant_procedures', { token: admin, body: { tenant_code: t.code, procedure_ids: procedures, enabled: true } })

    const leaderToken = await login(t.leader.username, PASS)
    if (!leaderToken) fail(`lãnh đạo ${t.leader.username} chưa đăng nhập được bằng DEMO_PASSWORD`)
    const staff = await must('GET', '/accounts/staff', { token: leaderToken })
    for (const s of t.staff) {
      const found = staff.find((u) => u.username === s.username)
      if (!found) {
        const r = await must('POST', '/accounts/staff', { token: leaderToken, body: s })
        await setDemoPassword(s.username, r.temporaryPassword)
        console.log(`Lãnh đạo ${t.leader.username} tạo cán bộ ${s.username}`)
        continue
      }
      if (!found.enabled) await must('PATCH', `/accounts/staff/${found.id}/status`, { token: leaderToken, body: { enabled: true } })
      if (!(await login(s.username, PASS))) {
        const r = await must('POST', `/accounts/staff/${found.id}/reset-password`, { token: leaderToken })
        await setDemoPassword(s.username, r.temporaryPassword)
        console.log(`Đặt lại mật khẩu demo cho ${s.username}`)
      }
    }
  }

  for (const c of CITIZENS) {
    if (await login(c.username, PASS, 'citizen-app')) continue
    const r = await call('POST', '/public/accounts/register', { body: { ...c, password: PASS, consent: true } })
    if (r.ok) { console.log(`Công dân ${c.username} tự đăng ký ở xã ${c.tenantCode}`); continue }
    fail(`không đăng ký được công dân ${c.username} (${r.status} ${r.data?.message || ''}). Tài khoản đã có với mật khẩu khác:`
      + ' đổi về DEMO_PASSWORD trong Keycloak hoặc dùng bản cài mới')
  }
  console.log(`Tài khoản demo sẵn sàng, mật khẩu chung: ${PASS}`)
}

main().catch((e) => fail(e.message))
