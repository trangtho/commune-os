// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync, existsSync, readdirSync} from 'node:fs'
import {resolve} from 'node:path'
import {sealToken, openToken} from '../../packages/auth/token-seal.ts'
import {securePortalCookie, portalOrigin, isSamePortalOrigin} from '../../packages/auth/cookie-policy.ts'
const root = resolve(import.meta.dirname, '../..')
const read = p => readFileSync(resolve(root,p), 'utf8')
const apps = ['citizen','commune','admin']
test('All portals build deterministically and expose readiness', () => {
  for (const app of apps) {
    assert.match(read(`apps/${app}/Dockerfile`), /npm ci/)
    assert.ok(existsSync(resolve(root,`apps/${app}/package-lock.json`)))
    const health = read(`apps/${app}/server/api/health.get.ts`)
    assert.match(health, /procedure_catalog/)
    assert.match(health, /503/)
  }
})
test('Staff supplement follows workflow; no direct database utility', () => {
  assert.ok(!existsSync(resolve(root,'apps/commune/server/utils/database.ts')))
  assert.match(read('apps/commune/server/api/applications/[id]/complete-supplement.post.ts'), /coreWorkflow.*'supplement'/)
  assert.match(read('core/orchestrator/server.mjs'), /X-Workflow-Expected-Status/)
  assert.match(read('modules/xa/db/36-workflow-expected-status.sql'), /FOR UPDATE/)
  assert.match(read('modules/xa/db/36-workflow-expected-status.sql'), /x-workflow-expected-status/)
  assert.match(read('modules/xa/module.json'), /"db\/36-workflow-expected-status.sql"/)
  assert.ok(!JSON.parse(read('apps/commune/package.json')).dependencies.pg)
})
test('All copies of shared source are in sync', () => {
  for (const app of apps) {
    assert.equal(read(`apps/${app}/server/utils/token-seal.ts`),read('packages/auth/token-seal.ts'))
    const dir = app === 'admin' ? 'app/assets/css' : 'assets/css'
    assert.equal(read(`apps/${app}/${dir}/shared-tokens.css`),read('packages/ui/tokens.css'))
    assert.match(read(`apps/${app}/nuxt.config.ts`),/shared-tokens.css/)
  }
  for (const app of ['commune','admin']) assert.equal(read(`apps/${app}/server/utils/portal-session.ts`),read('packages/auth/portal-session.ts'))
})
test('Encrypted tokens roundtrip, cannot cross scopes or be tampered', () => {
  const secret = 'x'.repeat(32)
  const data = {t:'fake-token',e:Date.now()+60000}
  const sealed = sealToken(secret,'staff',data)
  assert.deepEqual(openToken(secret,'staff',sealed),data)
  assert.equal(openToken(secret,'admin',sealed),null)
  assert.equal(openToken('y'.repeat(32),'staff',sealed),null)
  const raw = Buffer.from(sealed,'base64url'); raw[28] ^= 1
  assert.equal(openToken(secret,'staff',raw.toString('base64url')),null)
  assert.throws(() => sealToken('short','staff',data))
})
test('Admin uses HttpOnly BFF instead of browser bearer tokens', () => {
  assert.doesNotMatch(read('apps/admin/app/composables/useAuth.ts'), /access_token|sessionStorage/)
  assert.match(read('apps/admin/app/composables/useApi.ts'), /\/api\/core/)
  assert.match(read('apps/admin/server/api/core/[...path].ts'),/adminSession.token/)
  assert.match(read('apps/admin/server/utils/portal-session.ts'),/httpOnly: true/)
  assert.match(read('apps/admin/server/utils/session.ts'),/sys_admin/)
  assert.match(read('apps/commune/server/utils/session.ts'),/receptionist/)
})

test('HTTP cookies require explicit opt-in for loopback and RFC1918 IPv4', () => {
  for (const host of ['localhost','127.0.0.1','127.0.0.2','[::1]','10.0.0.1','172.16.0.1','172.31.255.254','192.168.1.10']) {
    assert.equal(securePortalCookie(new URL(`http://${host}:3002`), true, ''), false)
    assert.equal(securePortalCookie(new URL(`http://${host}:3002`), false, ''), true)
    assert.equal(securePortalCookie(new URL(`https://${host}:3002`), true, ''), true)
  }
  for (const host of ['localhost.example.org','192.168.1.10.example.org','172.15.0.1','172.32.0.1','192.169.1.1','8.8.8.8','169.254.0.1','100.64.0.1','[fc00::1]','example.org']) {
    assert.equal(securePortalCookie(new URL(`http://${host}`), true, ''), true)
  }
  for (const app of apps) assert.equal(read(`apps/${app}/server/utils/cookie-policy.ts`),read('packages/auth/cookie-policy.ts'))
})

test('Configured HTTPS origin works behind HTTP proxy and does not weaken Secure', () => {
  const upstream = new URL('http://127.0.0.1:3000/api/dang-nhap')
  const external = 'https://quantri.example.org:8443'
  assert.equal(portalOrigin(upstream, external + '/').origin, external)
  assert.equal(securePortalCookie(upstream, true, external), true)
  assert.equal(securePortalCookie(new URL('https://example.org'), true, 'http://192.168.1.10'), true)
  assert.equal(securePortalCookie(new URL('http://example.org'), true, 'http://192.168.1.10'), true)
  assert.equal(securePortalCookie(upstream, true, 'http://192.168.1.10:3001'), false)
  assert.equal(isSamePortalOrigin(upstream, external, 'same-origin', external), true)
  assert.equal(isSamePortalOrigin(upstream, upstream.origin, 'same-origin', external), false)
  assert.equal(isSamePortalOrigin(upstream, 'https://evil.example.org', 'same-origin', external), false)
  assert.equal(isSamePortalOrigin(upstream, external, 'cross-site', external), false)
  assert.equal(isSamePortalOrigin(upstream, external, 'same-site', external), false)
  assert.equal(isSamePortalOrigin(upstream, 'null', undefined, external), false)
  assert.equal(isSamePortalOrigin(upstream, undefined, undefined, external), true)
  for (const bad of ['*','https://one.example.org,https://two.example.org','https://user:pass@example.org','https://example.org/path','https://example.org?','https://example.org#','ftp://example.org']) {
    assert.throws(() => portalOrigin(upstream, bad))
  }
})

test('Direct LAN origin matches exactly and proxy headers are not trusted', () => {
  const lan = new URL('http://192.168.1.10:3001/api/dang-nhap')
  assert.equal(isSamePortalOrigin(lan, lan.origin, 'same-origin', ''), true)
  assert.equal(isSamePortalOrigin(lan, 'http://192.168.1.10:3002', undefined, ''), false)
  const compose = read('docker-compose.yml')
  for (const app of apps) {
    const name = app.toUpperCase()
    assert.ok(compose.includes('PORTAL_PUBLIC_ORIGIN: ${' + name + '_PORTAL_PUBLIC_ORIGIN:-}'))
    assert.ok(compose.includes('${PORTAL_BIND_ADDRESS:-127.0.0.1}:${' + name + '_PORT:-'))
  }
  for (const app of ['admin','commune']) {
    const middleware = read(`apps/${app}/server/middleware/same-origin.ts`)
    assert.match(middleware, /xForwardedHost: false, xForwardedProto: false/)
    assert.match(middleware, /isSamePortalOrigin\(url, origin, site\)/)
  }
  for (const p of ['packages/auth/portal-session.ts','apps/citizen/server/utils/session.ts','apps/citizen/server/utils/identity.ts','apps/citizen/server/utils/counter-sessions.ts','apps/citizen/server/utils/oidc.ts']) {
    assert.match(read(p), /securePortalCookie\(getRequestURL\(event, \{xForwardedHost: false, xForwardedProto: false\}\)\)/)
  }
})
test('Core SQL knows nothing about the commune module (citizens, procedures, dossiers)', () => {
  // Lõi phải cài được khi không có gói xã: SQL của lõi không dùng bảng, hàm của gói xã (bỏ qua chú thích).
  const dir = resolve(root, 'core/db/init')
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql'))) {
    const code = readFileSync(resolve(dir, f), 'utf8').replace(/--.*$/gm, '')
    assert.doesNotMatch(code, /\b(citizens|procedures|applications|application_events|set_dossier_status|dossier_count)\b/, f)
  }
  assert.doesNotMatch(read('core/orchestrator/server.mjs').replace(/\/\/.*$/gm, ''), /xu-ly-ho-so|set_dossier_status|CITIZEN_/)
  for (const m of ['xa', 'doanh-nghiep']) {
    const manifest = JSON.parse(read(`modules/${m}/module.json`))
    assert.equal(manifest.name, m)
    for (const f of manifest.db) assert.ok(existsSync(resolve(root, `modules/${m}/${f}`)), `${m}/${f}`)
  }
})
