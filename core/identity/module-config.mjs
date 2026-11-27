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
  for (const {root, manifest} of entries) {
    if (!manifest.identity) continue
    const ext = JSON.parse(readFileSync(moduleFile(root,manifest.identity),'utf8'))
    append(roles, ext.roles, 'name'); append(clients, ext.clients, 'clientId'); append(attributes, ext.attributes, 'name')
    for (const [id, variable] of Object.entries(ext.confidential ?? {})) {
      if (Object.hasOwn(confidential,id) || !ext.clients?.some(c => c.clientId === id) || !/^[A-Z][A-Z0-9_]*$/.test(variable)) throw new Error('Invalid confidential client')
      confidential[id] = variable
    }
  }
  return {roles, clients, attributes, confidential}
}
