// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { publicQuery } from '../../utils/database'
import { readSession } from '../../utils/session'
export default defineEventHandler(async event => {
  const actor = readSession(event)
  const rows = await publicQuery<{ id:string;code:string;name:string }>('SELECT id,code,name FROM tenants ORDER BY name LIMIT 200')
  return rows.map(row => ({...row, canReceive: !!actor && row.id === actor.tenantId}))
})
