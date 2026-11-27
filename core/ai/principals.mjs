// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
export function buildPrincipalRules(entries) {
  const rules = []
  const clients = new Set(['commune-app'])
  for (const {manifest} of entries) {
    const p = manifest.aiPrincipal
    if (!p) continue
    if (![p.clientId,p.requiredRole,p.subjectClaim,p.tenantClaim].every(v => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(v)) || p.audience !== 'citizen' || clients.has(p.clientId)) throw new Error('Invalid AI principal')
    clients.add(p.clientId); rules.push(p)
  }
  return rules
}
export function principal(claims, rules) {
  const roles = Array.isArray(claims.realm_access?.roles) ? claims.realm_access.roles : []
  if (!claims.sub) return null
  if (claims.azp === 'commune-app' && (claims.tenant_id || roles.includes('sys_admin'))) return {sub:claims.sub,roles,kind:'staff',tenant:claims.tenant_id || ''}
  const rule = rules.find(p => claims.azp === p.clientId && roles.includes(p.requiredRole) && typeof claims[p.subjectClaim] === 'string' && claims[p.subjectClaim] && typeof claims[p.tenantClaim] === 'string' && claims[p.tenantClaim])
  return rule ? {sub:claims.sub,roles,kind:rule.audience,tenant:claims[rule.tenantClaim]} : null
}
export function resourceId(body) {
  const value = body.resourceId ?? body.procedureId
  return typeof value === 'string' && /^[a-z0-9-]{2,80}$/.test(value) ? value : ''
}
