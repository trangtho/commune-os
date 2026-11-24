// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Thủ tục gợi ý: danh mục công khai (api.public_recommendation_catalog); công dân bật cá nhân hóa thì sắp theo
// tùy chọn và lịch sử của chính mình (api.citizen_recommendation_context, RLS theo công dân).
import { citizenRpc, publicRpc } from '../../utils/identity'
import { readSession } from '../../utils/session'
import { rankProcedures, type ProcedureForRanking, type ProcedureHistory, type ServicePreferences } from '../../../shared/personalization'
export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  const procedures = await publicRpc<(ProcedureForRanking & {audience_groups:string[];available_tenant_ids:string[];metadata_verified:boolean})[]>('public_recommendation_catalog')
  if (readSession(event)?.authMethod !== 'keycloak') return { personalized: false, reason: 'Đăng nhập và bật cá nhân hóa để nhận gợi ý phù hợp.', items: rankProcedures(procedures, null).slice(0, 6).map(item => ({ ...item.procedure, reasons: item.reasons })) }
  const { preferences, history } = await citizenRpc<{preferences: ServicePreferences; history: ProcedureHistory[]}>(event, 'citizen_recommendation_context')
  const items = rankProcedures(procedures, preferences, history).slice(0, 6)
    .map(item => ({ ...item.procedure, reasons: item.reasons }))
  return { personalized: preferences.personalization_enabled,
    reason: preferences.personalization_enabled
      ? 'Sắp xếp từ lịch sử của bạn và lĩnh vực quan tâm; không thay thế điều kiện pháp lý của thủ tục.'
      : 'Chưa bật cá nhân hóa; hiện hiển thị danh mục chung.', items }
})
