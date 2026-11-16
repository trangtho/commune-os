// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenTx } from '../../utils/database'
import { getPreferences, permittedReceivingTenant } from '../../utils/citizen-preferences'
import { localityGuidance } from '../../../shared/personalization'
export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  const procedureId = typeof getQuery(event).procedureId === 'string' ? String(getQuery(event).procedureId) : ''
  if (!/^[a-z0-9-]{2,80}$/.test(procedureId)) throw createError({ statusCode: 400, statusMessage: 'Thủ tục không hợp lệ' })
  return citizenTx(event, async(client,actor) => {
    const exists = (await client.query('SELECT 1 FROM procedures WHERE id=$1 AND published=true', [procedureId])).rowCount
    if (!exists) throw createError({ statusCode: 404, statusMessage: 'Thủ tục không được công bố' })
    const preferences = await getPreferences(client, actor.id)
    const suggested = localityGuidance({
      accountTenantId: actor.tenantId, residenceTenantId: preferences.residence_tenant_id,
      temporaryTenantId: preferences.temporary_tenant_id, preferredTenantId: preferences.preferred_tenant_id
    })
    const canReceive = await permittedReceivingTenant(client, {
      procedureId, sourceTenantId: actor.tenantId, receivingTenantId: suggested.candidateTenantId
    })
    const approvedRoute = canReceive && suggested.candidateTenantId !== actor.tenantId
      ? (await client.query(`SELECT approval_reference,valid_until FROM citizen_procedure_receivers
          WHERE procedure_id=$1 AND source_tenant_id=$2 AND receiving_tenant_id=$3
            AND enabled AND valid_until>now() AND btrim(approval_reference)<>''`,
        [procedureId,actor.tenantId,suggested.candidateTenantId])).rows[0] || null : null
    const ids = [actor.tenantId, suggested.candidateTenantId]
    const names = new Map((await client.query('SELECT id,name FROM tenants WHERE id=ANY($1::uuid[])', [ids])).rows.map(row => [row.id,row.name]))
    return {
      accountTenantId: actor.tenantId,
      suggestedTenantId: suggested.candidateTenantId,
      suggestedTenantName: names.get(suggested.candidateTenantId) || 'Địa phương đã khai',
      selectedTenantId: canReceive ? suggested.candidateTenantId : actor.tenantId,
      selectedTenantName: names.get(canReceive ? suggested.candidateTenantId : actor.tenantId) || 'Địa phương tài khoản',
      basis: suggested.basis,
      canReceive,
      approvalReference: approvedRoute?.approval_reference || null,
      localityVerified: preferences.locality_source === 'oidc_verified' && Boolean(preferences.locality_verified_at),
      notice: !canReceive
        ? 'Địa phương bạn khai chưa có tuyến tiếp nhận được phê duyệt cho thủ tục này. Chỉ có thể nộp tại địa phương của tài khoản; vui lòng kiểm tra thẩm quyền với cán bộ.'
        : 'Đây là gợi ý kỹ thuật dựa trên tài khoản và lựa chọn của bạn, không xác nhận thẩm quyền pháp lý hoặc dữ liệu cư trú từ VNeID.'
    }
  })
})
