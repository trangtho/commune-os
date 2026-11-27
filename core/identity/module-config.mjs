// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { readFileSync } from 'node:fs'
import { moduleFile } from '../module-loader.mjs'
export function identityConfig(realm, entries) {
  const profile = JSON.parse(realm.components['org.keycloak.userprofile.UserProfileProvider'][0].config['kc.user.profile.config'][0])
  const roles = [...realm.roles.realm], clients = [...realm.clients], attributes = [...profile.attributes]
  const confidential = {'accounts-service':'KEYCLOAK_ACCOUNTS_SECRET'}
  function append(target, additions, key) {
    for (const entry of additions ?? []) {
      if (!entry || typeof entry[key] !== 'string' || !entry[key] || target.some(x => x[key] === entry[key])) throw new Error(`Duplicate or invalid identity ${key}`)
      target.push(entry)
    }
  }
  const moduleRoles = []
  for (const {manifest} of entries) {
    if (manifest.roles === undefined) continue
    if (!Array.isArray(manifest.roles)) throw new Error('roles phải là danh sách')
    if (!/^[a-z][a-z0-9-]{0,62}$/.test(manifest.name)) throw new Error('Tên gói không hợp lệ')
    for (const r of manifest.roles) {
      if (!r || typeof r.name !== 'string' || !/^[a-z][a-z0-9-]{0,40}$/.test(r.name) ||
          (r.title !== undefined && (typeof r.title !== 'string' || !r.title.trim())) ||
          (r.description !== undefined && typeof r.description !== 'string')) {
        throw new Error(`Vai trò không hợp lệ: ${manifest.name}`)
      }
      const name = `${manifest.name}:${r.name}`
      append(moduleRoles, [{ name, description: (r.title || r.name) + (r.description ? ` – ${r.description}` : '') }], 'name')
    }
  }
  for (const {root, manifest} of entries) {
    if (!manifest.identity) continue
    const ext = JSON.parse(readFileSync(moduleFile(root,manifest.identity),'utf8'))
    append(roles, ext.roles, 'name'); append(clients, ext.clients, 'clientId'); append(attributes, ext.attributes, 'name')
    for (const [id, variable] of Object.entries(ext.confidential ?? {})) {
      if (Object.hasOwn(confidential,id) || !ext.clients?.some(c => c.clientId === id) || !/^[A-Z][A-Z0-9_]*$/.test(variable)) throw new Error('Invalid confidential client')
      confidential[id] = variable
    }
  }
  // Không cho identity extension khai báo trùng một vai trò được quản lý qua registry.
  if (moduleRoles.some(r => roles.some(x => x.name === r.name))) throw new Error('Trùng vai trò Identity và roles của module')
  return {roles, clients, attributes, confidential, moduleRoles}
}
