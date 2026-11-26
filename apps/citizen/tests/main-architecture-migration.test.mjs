// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8')
const server = new URL('../server/', import.meta.url)

test('Citizen server does not call the retired direct SQL helpers', () => {
  for (const path of readdirSync(server, { recursive: true })) {
    if (!path.endsWith('.ts')) continue
    const source = readFileSync(new URL(path, server), 'utf8')
    assert.doesNotMatch(source, /\b(?:citizenTx|publicQuery)\b/, path)
    if (path !== 'utils/live-changes.ts') {
      assert.doesNotMatch(source, /\bdb\(\)\.(?:query|connect)\(/, path)
    }
  }
  const live = read('../server/utils/live-changes.ts')
  assert.match(live, /const CHANNEL = 'communeos_citizen_changes'/)
  assert.match(live, /client\.query\(`LISTEN \$\{CHANNEL\}`\)/)
  assert.equal(existsSync(new URL('api/internal/', server)), false)
})

test('Database setup restores the main RPC stack before revoking direct access', () => {
  const compose = read('../../../docker-compose.yml')
  const names = ['26-citizen-staff-api.sql', '27-citizen-api-vault.sql', '28-citizen-api-case.sql', '29-citizen-api-representation.sql', '30-citizen-api-appointment.sql', '31-citizen-api-support.sql', '32-citizen-api-personal.sql', '33-citizen-api-public.sql', '34-citizen-direct-access.sql', '25-api-comments.sql']
  let previous = -1
  for (const name of names) {
    const position = compose.indexOf(`/setup/init/${name}`)
    assert.ok(position > previous, name)
    previous = position
  }
  assert.match(read('../../../core/db/init/34-citizen-direct-access.sql'), /REVOKE ALL ON/)
})

test('Scheduled citizen jobs receive their enable flags in the core orchestrator', () => {
  const compose = read('../../../docker-compose.yml')
  const orchestrator = compose.split('\n  orchestrator:')[1].split(/\n  [a-z][a-z-]*:/)[0]
  assert.match(orchestrator, /CITIZEN_REMINDERS_ENABLED:/)
  assert.match(orchestrator, /CITIZEN_RETENTION_SCAN_ENABLED:/)
})
