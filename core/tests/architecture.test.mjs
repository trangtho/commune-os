// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync, existsSync} from 'node:fs'
import {resolve} from 'node:path'
import {sealToken, openToken} from '../../packages/auth/token-seal.ts'
import {securePortalCookie} from '../../packages/auth/cookie-policy.ts'
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
  assert.match(read('core/db/init/36-workflow-expected-status.sql'), /FOR UPDATE/)
  assert.match(read('core/db/init/36-workflow-expected-status.sql'), /x-workflow-expected-status/)
  assert.match(read('docker-compose.yml'), /-f \/setup\/init\/36-workflow-expected-status.sql/)
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

test('HTTP cookies are allowed only for explicitly enabled loopback', () => {
  for (const host of ['localhost','127.0.0.1','[::1]']) {
    assert.equal(securePortalCookie(new URL(`http://${host}:3002`), true), false)
    assert.equal(securePortalCookie(new URL(`http://${host}:3002`), false), true)
    assert.equal(securePortalCookie(new URL(`https://${host}:3002`), true), true)
  }
  for (const host of ['localhost.example.org','192.168.1.10','example.org']) {
    assert.equal(securePortalCookie(new URL(`http://${host}`), true), true)
  }
  for (const app of apps) assert.equal(read(`apps/${app}/server/utils/cookie-policy.ts`),read('packages/auth/cookie-policy.ts'))
})
