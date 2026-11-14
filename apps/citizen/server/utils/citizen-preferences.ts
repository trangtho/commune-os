// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import type { PoolClient } from 'pg'
import { emptyPreferences, type ServicePreferences } from '../../shared/personalization'

export async function getPreferences(client: PoolClient, citizenId: string): Promise<ServicePreferences> {
  const row = (await client.query('SELECT personalization_enabled, audience_group, interest_categories, residence_tenant_id, temporary_tenant_id, preferred_tenant_id, locality_source, locality_verified_at FROM citizen_service_preferences WHERE citizen_id=$1', [citizenId])).rows[0]
  return row ? {
    personalization_enabled: Boolean(row.personalization_enabled),
    audience_group: row.audience_group,
    interest_categories: Array.isArray(row.interest_categories) ? row.interest_categories : [],
    residence_tenant_id: row.residence_tenant_id,
    temporary_tenant_id: row.temporary_tenant_id,
    preferred_tenant_id: row.preferred_tenant_id,
    locality_source: row.locality_source,
    locality_verified_at: row.locality_verified_at
  } : { ...emptyPreferences, interest_categories: [] }
}

/** Never infer jurisdiction from display names, addresses, title keywords, or unverified identity claims. */
export async function permittedReceivingTenant(client: PoolClient, args: {
  procedureId: string; sourceTenantId: string; receivingTenantId: string
}): Promise<boolean> {
  if (args.sourceTenantId === args.receivingTenantId) return true
  const query = `SELECT EXISTS (
    SELECT 1 FROM citizen_procedure_receivers
    WHERE procedure_id=$1 AND source_tenant_id=$2 AND receiving_tenant_id=$3
      AND enabled=true AND trim(approval_reference)<>''
      AND valid_until > now()
  ) AS allowed`
  return Boolean((await client.query(query, [args.procedureId, args.sourceTenantId, args.receivingTenantId])).rows[0]?.allowed)
}
