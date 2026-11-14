// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
/** Ranking is a suggestion, never a legal eligibility or jurisdiction decision. */
export type AudienceGroup = 'general' | 'parent' | 'business' | 'resident' | 'other'
export interface ServicePreferences {
  personalization_enabled: boolean
  audience_group: AudienceGroup
  interest_categories: string[]
  residence_tenant_id: string | null
  temporary_tenant_id: string | null
  preferred_tenant_id: string | null
  locality_source?: 'self_declared' | 'oidc_verified'
  locality_verified_at?: string | null
}
export interface ProcedureForRanking {
  [key: string]: unknown
  id: string; title: string; category: string; summary: string
  audience_groups?: string[]; available_tenant_ids?: string[]; metadata_verified?: boolean
}
export interface ProcedureHistory { procedure_id: string; uses: number }
export interface RankedProcedure<T extends ProcedureForRanking> {
  procedure: T; score: number; reasons: string[]
}
export const audienceOptions: {value: AudienceGroup; label: string}[] = [
  { value: 'general', label: 'Không chọn nhóm đối tượng' },
  { value: 'parent', label: 'Cha mẹ, người giám hộ' },
  { value: 'business', label: 'Cá nhân, hộ kinh doanh' },
  { value: 'resident', label: 'Người có nhu cầu về cư trú' },
  { value: 'other', label: 'Nhóm khác' }
]
export const emptyPreferences: ServicePreferences = {
  personalization_enabled: false,
  audience_group: 'general',
  interest_categories: [],
  residence_tenant_id: null,
  temporary_tenant_id: null,
  preferred_tenant_id: null
}
export function rankProcedures<T extends ProcedureForRanking>(
  procedures: T[], preferences: ServicePreferences | null,
  history: ProcedureHistory[] = []
): RankedProcedure<T>[] {
  const enabled = Boolean(preferences?.personalization_enabled)
  const recent = new Map(history.map(item => [item.procedure_id, item.uses]))
  const interests = new Set(preferences?.interest_categories || [])
  const group = preferences?.audience_group || 'general'
  return procedures.map(procedure => {
    let score = 0
    const reasons: string[] = []
    if (enabled) {
      const uses = recent.get(procedure.id) || 0
      if (uses > 0) {
        score += 8 + Math.min(uses, 4)
        reasons.push('Bạn đã thực hiện thủ tục này trước đây')
      }
      if (interests.has(procedure.category)) {
        score += 5
        reasons.push(`Thuộc lĩnh vực bạn quan tâm: ${procedure.category}`)
      }
      const locality = preferences?.preferred_tenant_id || preferences?.residence_tenant_id || preferences?.temporary_tenant_id
      if (locality && procedure.metadata_verified && procedure.available_tenant_ids?.includes(locality)) {
        score += 3
        reasons.push('Có trong phạm vi địa phương được xác minh trên danh mục')
      }
      if (group !== 'general' && procedure.metadata_verified && procedure.audience_groups?.includes(group)) {
        score += 4
        reasons.push('Phù hợp nhóm đối tượng theo dữ liệu danh mục đã xác minh')
      }
    }
    if (!reasons.length) reasons.push('Thủ tục trong danh mục đang được công bố')
    return { procedure, score, reasons }
  }).sort((a, b) => b.score - a.score || a.procedure.title.localeCompare(b.procedure.title, 'vi'))
}
export function localityGuidance(args: {
  accountTenantId: string
  residenceTenantId: string | null
  temporaryTenantId: string | null
  preferredTenantId: string | null
}): { candidateTenantId: string; basis: string; requiresRouteCheck: boolean } {
  const chosen = args.preferredTenantId || args.residenceTenantId || args.temporaryTenantId || args.accountTenantId
  const basis = args.preferredTenantId ? 'Địa phương bạn ưu tiên (tự khai)'
    : args.residenceTenantId ? 'Địa phương thường trú (tự khai)'
    : args.temporaryTenantId ? 'Địa phương tạm trú (tự khai)'
    : 'Địa phương gắn với tài khoản'
  return { candidateTenantId: chosen, basis, requiresRouteCheck: chosen !== args.accountTenantId }
}
