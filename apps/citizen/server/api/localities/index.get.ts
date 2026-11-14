// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { publicQuery, citizenTx } from '../../utils/database'
import { readSession } from '../../utils/session'
export default defineEventHandler(async event => {
  const actor = readSession(event)
  const procedureId = typeof getQuery(event).procedureId === 'string' ? String(getQuery(event).procedureId).slice(0, 80) : ''
  const rows = await publicQuery<{ id:string;code:string;name:string }>('SELECT id,code,name FROM tenants ORDER BY name LIMIT 200')
  if (!actor) return rows.map(row => ({ ...row, canReceive: false, isAccountLocality: false }))
  const permitted = procedureId && /^[a-z0-9-]{2,80}$/.test(procedureId)
    ? await citizenTx(event, async(client,user) => (await client.query(`SELECT receiving_tenant_id FROM citizen_procedure_receivers
        WHERE procedure_id=$1 AND source_tenant_id=$2 AND enabled=true
          AND trim(approval_reference)<>'' AND valid_until>now()`, [procedureId,user.tenantId])).rows.map(row => row.receiving_tenant_id))
    : [] as string[]
  const allowed = new Set([actor.tenantId, ...permitted])
  return rows.map(row => ({ ...row, canReceive: allowed.has(row.id), isAccountLocality: row.id === actor.tenantId }))
})
