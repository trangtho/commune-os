// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Lưu tùy chọn cá nhân hóa (api.citizen_preferences_save của lõi; lõi kiểm tra địa phương, lĩnh vực quan tâm).
import { z } from 'zod'
import { citizenRpc } from '../../../utils/identity'
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
  const b = validate(schema, await readBody(event))
  return citizenRpc(event, 'citizen_preferences_save', {p_personalization_enabled: b.personalization_enabled,
    p_audience_group: b.audience_group, p_interest_categories: b.interest_categories, p_residence_tenant_id: b.residence_tenant_id,
    p_temporary_tenant_id: b.temporary_tenant_id, p_preferred_tenant_id: b.preferred_tenant_id})
})
