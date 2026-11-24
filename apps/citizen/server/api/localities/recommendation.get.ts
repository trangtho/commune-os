// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Gợi ý địa phương nộp hồ sơ: tùy chọn của công dân (api.citizen_preferences), địa phương gợi ý tính bằng
// shared/personalization.ts, lõi kiểm tra tuyến tiếp nhận (api.citizen_locality_route).
import { citizenRpc } from '../../utils/identity'
import { requireCitizen } from '../../utils/session'
import { localityGuidance, type ServicePreferences } from '../../../shared/personalization'
type Route={accountTenantId:string;canReceive:boolean;approvalReference:string|null;accountTenantName:string|null;candidateTenantName:string|null}
export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  const procedureId = typeof getQuery(event).procedureId === 'string' ? String(getQuery(event).procedureId) : ''
  if (!/^[a-z0-9-]{2,80}$/.test(procedureId)) throw createError({ statusCode: 400, statusMessage: 'Thủ tục không hợp lệ' })
  const preferences = await citizenRpc<ServicePreferences & {locality_source?:string;locality_verified_at?:string|null}>(event, 'citizen_preferences')
  const account = requireCitizen(event).tenantId
  const suggested = localityGuidance({
    accountTenantId: account, residenceTenantId: preferences.residence_tenant_id,
    temporaryTenantId: preferences.temporary_tenant_id, preferredTenantId: preferences.preferred_tenant_id
  })
  const route = await citizenRpc<Route>(event, 'citizen_locality_route', { p_procedure_id: procedureId, p_candidate_tenant_id: suggested.candidateTenantId })
  const canReceive = route.canReceive
  return {
    accountTenantId: account,
    suggestedTenantId: suggested.candidateTenantId,
    suggestedTenantName: route.candidateTenantName || 'Địa phương đã khai',
    selectedTenantId: canReceive ? suggested.candidateTenantId : account,
    selectedTenantName: (canReceive ? route.candidateTenantName : route.accountTenantName) || 'Địa phương tài khoản',
    basis: suggested.basis,
    canReceive,
    approvalReference: route.approvalReference,
    localityVerified: preferences.locality_source === 'oidc_verified' && Boolean(preferences.locality_verified_at),
    notice: !canReceive
      ? 'Địa phương bạn khai chưa có tuyến tiếp nhận được phê duyệt cho thủ tục này. Chỉ có thể nộp tại địa phương của tài khoản; vui lòng kiểm tra thẩm quyền với cán bộ.'
      : 'Đây là gợi ý kỹ thuật dựa trên tài khoản và lựa chọn của bạn, không xác nhận thẩm quyền pháp lý hoặc dữ liệu cư trú từ VNeID.'
  }
})
