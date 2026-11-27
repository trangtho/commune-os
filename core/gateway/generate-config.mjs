// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { readFileSync, writeFileSync, renameSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { loadManifests } from '../module-loader.mjs'

// Modules may declare exact endpoint names only. The platform owns upstreams,
// HTTP methods, auth stripping and rate limits; no raw plugin injection.
export function renderGateway(base, entries) {
  const rpc = new Set(['public_platform']), accounts = new Set()
  for (const {manifest: m} of entries) {
    for (const [key, set, regex] of [['publicRpc',rpc,/^[a-z_][a-z0-9_]{0,62}$/],['publicAccounts',accounts,/^[a-z][a-z0-9-]{0,62}$/]]) {
      const names = m.gateway?.[key] ?? []
      if (!Array.isArray(names)) throw new Error(`gateway.${key} must be an array`)
      for (const name of names) {
        if (typeof name !== 'string' || !regex.test(name) || set.has(name) || (key === 'publicAccounts' && name === 'first-password')) throw new Error(`Invalid or duplicate public route: ${name}`)
        set.add(name)
      }
    }
  }
  const marker = '      - "/public/rpc/public_platform"'
  if (base.split(marker).length !== 2 || !base.trimEnd().endsWith('#END')) throw new Error('Invalid gateway template')
  const routes = [...accounts].map(name => `  - id: public-accounts-${name}
    uri: /public/accounts/${name}
    methods: ["POST"]
    plugins:
      limit-count:
        count: 20
        time_window: 60
        key_type: var
        key: remote_addr
        rejected_code: 429
      proxy-rewrite:
        uri: /accounts/${name}
        headers:
          remove: ["Authorization"]
    upstream:
      type: roundrobin
      nodes:
        "accounts:3000": 1
`).join('')
  return base.replace(marker, [...rpc].map(name => `      - "/public/rpc/${name}"`).join('\n')).replace(/#END\s*$/, routes + '#END\n')
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const base = readFileSync(process.argv[2], 'utf8')
  const output = process.argv[3]
  const result = renderGateway(base, loadManifests())
  writeFileSync(output + '.tmp', result, {mode: 0o644})
  renameSync(output + '.tmp', output)
}
