// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { loadManifests, moduleFile, moduleNames } from '../core/module-loader.mjs'
import { renderGateway } from '../core/gateway/generate-config.mjs'
import { identityConfig } from '../core/identity/module-config.mjs'
import { buildPrincipalRules } from '../core/ai/principals.mjs'
const here = new URL('../', import.meta.url)
export function createModule(directory, name) {
  if (moduleNames(name).length !== 1 || moduleNames(name)[0] !== name) throw Error('Tên gói không hợp lệ')
  const root = resolve(directory,name)
  mkdirSync(root) // never overwrite an existing module
  mkdirSync(resolve(root,'db'))
  writeFileSync(resolve(root,'module.json'),JSON.stringify({name,title:name,version:'0.1.0',db:['db/01-schema.sql'],roles:[],workflows:[]},null,2)+'\n')
  writeFileSync(resolve(root,'db/01-schema.sql'),`-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
-- Add tenant-scoped tables, RLS and explicit grants before exposing any data.
CREATE SCHEMA IF NOT EXISTS "${name.replaceAll('-','_')}";
REVOKE ALL ON SCHEMA "${name.replaceAll('-','_')}" FROM PUBLIC;
`)
  writeFileSync(resolve(root,'README.md'),`<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->
# ${name}

Scaffold only. Implement migrations, tenant isolation and tests before enabling. See docs/OPEN_CORE_DELIVERY.md.
`)
  return root
}
export function validateModule(directory,name) {
  if (moduleNames(name).length !== 1 || moduleNames(name)[0] !== name) throw Error('Tên gói không hợp lệ')
  const entries = loadManifests({directory,modules:[name]})
  const {root,manifest:m} = entries[0]
  if (typeof m.title !== 'string' || !m.title || !/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i.test(m.version) || !Array.isArray(m.db)) throw Error('Manifest thiếu title/version/db')
  for (const path of [...m.db,...(m.knowledge ?? []).map(x=>x.file),...Object.values(m.serviceHandlers ?? {}),...(m.identity?[m.identity]:[])]) moduleFile(root,path)
  for (const w of m.workflows ?? []) {
    if (!w.name || !w.processKey || !w.view || !w.statusRpc || !w.idParam || !Array.isArray(w.final)) throw Error('Workflow thiếu hợp đồng')
    moduleFile(root,`bpmn/${w.processKey}.bpmn20.xml`)
  }
  renderGateway(readFileSync(new URL('core/gateway/apisix.yaml',here),'utf8'),entries)
  identityConfig(JSON.parse(readFileSync(new URL('core/identity/realm/communeos-realm.json',here),'utf8')),entries)
  buildPrincipalRules(entries)
  return m
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [cmd,name] = process.argv.slice(2); const directory = fileURLToPath(new URL('modules/',here))
  try { if(cmd==='create') console.log(createModule(directory,name)); else if(cmd==='validate') console.log('Manifest hợp lệ:',validateModule(directory,name).name); else throw Error('create | validate NAME') }
  catch(e) { console.error(e.message); process.exitCode=1 }
}
