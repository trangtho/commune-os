// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenTx, publicQuery } from '../../utils/database'
import { readSession } from '../../utils/session'
import { getPreferences } from '../../utils/citizen-preferences'
import { rankProcedures, type ProcedureForRanking, type ProcedureHistory } from '../../../shared/personalization'
export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  const procedures = await publicQuery<ProcedureForRanking & {audience_groups:string[];available_tenant_ids:string[];metadata_verified:boolean}>(`
    SELECT p.id,p.title,p.category,p.summary,p.icon,p.sla_days,p.fee_note,p.instructions,
      COALESCE(m.audience_groups,'{}'::text[]) AS audience_groups,
      COALESCE(m.available_tenant_ids,'{}'::uuid[]) AS available_tenant_ids,
      (m.verified_at IS NOT NULL AND length(trim(COALESCE(m.source_reference,'')))>0) AS metadata_verified
    FROM procedures p LEFT JOIN procedure_recommendation_metadata m ON m.procedure_id=p.id
    WHERE p.published=true ORDER BY p.title`)
  const actor = readSession(event)
  if (!actor) return { personalized: false, reason: 'Đăng nhập và bật cá nhân hóa để nhận gợi ý phù hợp.', items: rankProcedures(procedures, null).slice(0, 6).map(item => ({ ...item.procedure, reasons: item.reasons })) }
  return citizenTx(event, async(client, user) => {
    const preferences = await getPreferences(client, user.id)
    let history: ProcedureHistory[] = []
    if (preferences.personalization_enabled) {
      history = (await client.query(`SELECT procedure_id,count(*)::int AS uses FROM applications
        WHERE citizen_id=$1 AND status <> 'draft' GROUP BY procedure_id`, [user.id])).rows
    }
    const items = rankProcedures(procedures, preferences, history).slice(0, 6)
      .map(item => ({ ...item.procedure, reasons: item.reasons }))
    return { personalized: preferences.personalization_enabled,
      reason: preferences.personalization_enabled
        ? 'Sắp xếp từ lịch sử của bạn và lĩnh vực quan tâm; không thay thế điều kiện pháp lý của thủ tục.'
        : 'Chưa bật cá nhân hóa; hiện hiển thị danh mục chung.', items }
  })
})
