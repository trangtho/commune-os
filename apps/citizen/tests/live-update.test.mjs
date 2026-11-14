// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const get = (path) => readFileSync(resolve(root, path), 'utf8')

test('PostgreSQL uses transactional NOTIFY triggers on the 7 relevant tables', () => {
  const sql = get('core/db/init/01-schema.sql')
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.communeos_notify_citizen_change/)
  assert.match(sql, /pg_notify\('communeos_citizen_changes'/)
  for (const table of ['procedures', 'procedure_documents', 'applications', 'application_events', 'application_documents', 'citizen_notifications', 'citizens'])
    assert.ok(sql.includes(`'${table}'`), `missing realtime trigger on ${table}`)
  assert.match(sql, /DROP TRIGGER IF EXISTS communeos_realtime_changed/)
  assert.match(sql, /AFTER INSERT OR UPDATE OR DELETE/)
})
test('SSE filters by citizen and tenant; payload only contains resource invalidations', () => {
  const api = get('apps/citizen/server/api/live.get.ts')
  const bridge = get('apps/citizen/server/utils/live-changes.ts')
  assert.match(api, /readSession\(event\)/)
  assert.match(api, /change\.citizenId !== citizen\.id \|\| change\.tenantId !== citizen\.tenantId/)
  assert.match(api, /push\('change', \{ resource: change\.resource \}\)/)
  assert.match(bridge, /LISTEN \$\{CHANNEL\}/)
  assert.match(bridge, /observers\.size/)
  assert.match(api, /unsubscribe\(\)/)
})
test('Client streams refresh only relevant keyed Nuxt data and keeps fallback', () => {
  const plugin = get('apps/citizen/plugins/live-updates.client.ts')
  assert.match(plugin, /new EventSource\('\/api\/live'/)
  assert.match(plugin, /refreshNuxtData\(keys\)/)
  assert.match(plugin, /'citizen-applications'/)
  assert.match(plugin, /'citizen-procedures'/)
  assert.match(plugin, /'citizen-notifications'/)
  assert.match(plugin, /document\.hidden/)
  assert.match(plugin, /15_000/)
  assert.doesNotMatch(plugin, /(?:window|location)\.reload\(/)
})
test('Home, procedure, case, inbox and profile pages register matching refresh keys', () => {
  for (const [path, key] of [
    ['pages/index.vue', 'citizen-applications'],
    ['pages/thu-tuc/index.vue', 'citizen-procedures'],
    ['pages/ho-so/index.vue', 'citizen-applications'],
    ['pages/ho-so/[id].vue', 'citizen-application:'],
    ['pages/thong-bao.vue', 'citizen-notifications'],
    ['pages/ho-so-ca-nhan.vue', 'citizen-profile'],
  ]) assert.ok(get('apps/citizen/' + path).includes(key), path)
  const profile = get('apps/citizen/pages/ho-so-ca-nhan.vue')
  assert.match(profile, /!editing\.value/)
})
