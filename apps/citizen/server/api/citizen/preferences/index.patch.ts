// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { z } from 'zod'
import { citizenTx } from '../../../utils/database'
import { getPreferences } from '../../../utils/citizen-preferences'
import { validate } from '../../../utils/validation'
const tenant = z.string().uuid().nullable()
const schema = z.object({
  personalization_enabled: z.boolean(),
  audience_group: z.enum(['general', 'parent', 'business', 'resident', 'other']),
  interest_categories: z.array(z.string().min(1).max(100)).max(8),
  residence_tenant_id: tenant,
  temporary_tenant_id: tenant,
  preferred_tenant_id: tenant
}).strict()
export default defineEventHandler(async event => {
  const body = validate(schema, await readBody(event))
  return citizenTx(event, async (client, actor) => {
    const localities = [body.residence_tenant_id, body.temporary_tenant_id, body.preferred_tenant_id].filter(Boolean)
    if (localities.length) {
      const result = await client.query('SELECT id FROM tenants WHERE id = ANY($1::uuid[])', [localities])
      if (result.rows.length !== new Set(localities).size)
        throw createError({ statusCode: 422, statusMessage: 'Địa phương không có trong danh mục hệ thống' })
    }
    const available = await client.query('SELECT DISTINCT category FROM procedures WHERE published=true')
    const categories = new Set(available.rows.map(row => row.category))
    if (new Set(body.interest_categories).size !== body.interest_categories.length || body.interest_categories.some(item => !categories.has(item)))
      throw createError({ statusCode: 422, statusMessage: 'Lĩnh vực quan tâm không hợp lệ' })
    const existing=await getPreferences(client,actor.id)
    const verifiedUnchanged=existing.locality_source==='oidc_verified'
      && existing.residence_tenant_id===body.residence_tenant_id
      && existing.temporary_tenant_id===body.temporary_tenant_id
    const localitySource=verifiedUnchanged?'oidc_verified':'self_declared'
    const localityVerifiedAt=verifiedUnchanged?existing.locality_verified_at||null:null
    await client.query(`INSERT INTO citizen_service_preferences
      (citizen_id,tenant_id,personalization_enabled,audience_group,interest_categories,residence_tenant_id,temporary_tenant_id,preferred_tenant_id,locality_source,locality_verified_at)
      VALUES($1,$2,$3,$4,$5::text[],$6,$7,$8,$9,$10)
      ON CONFLICT (citizen_id) DO UPDATE SET
        personalization_enabled=EXCLUDED.personalization_enabled,
        audience_group=EXCLUDED.audience_group,
        interest_categories=EXCLUDED.interest_categories,
        residence_tenant_id=EXCLUDED.residence_tenant_id,
        temporary_tenant_id=EXCLUDED.temporary_tenant_id,
        preferred_tenant_id=EXCLUDED.preferred_tenant_id,
        locality_source=EXCLUDED.locality_source,locality_verified_at=EXCLUDED.locality_verified_at,updated_at=now()`,
    [actor.id, actor.tenantId, body.personalization_enabled, body.audience_group, body.interest_categories,
      body.residence_tenant_id, body.temporary_tenant_id, body.preferred_tenant_id,localitySource,localityVerifiedAt])
    return getPreferences(client, actor.id)
  })
})
