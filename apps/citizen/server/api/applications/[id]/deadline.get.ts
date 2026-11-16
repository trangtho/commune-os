// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenTx } from '../../../utils/database'
export default defineEventHandler(event=>citizenTx(event,async(client,actor)=>{
  setHeader(event,'Cache-Control','private, no-store')
  const id=String(getRouterParam(event,'id')||'')
  const row=(await client.query(`SELECT id,status,due_at,submitted_at,
    CASE WHEN due_at IS NULL THEN NULL ELSE (due_at-CURRENT_DATE)::int END AS days_left
    FROM applications WHERE id=$1`,[id])).rows[0]
  if(!row)throw createError({statusCode:404,statusMessage:'Không tìm thấy hồ sơ'})
  const ongoing=['submitted','processing','supplement'].includes(row.status)
  const level=ongoing&&row.days_left!==null&&row.days_left<=2
    ? (row.days_left<0?'overdue':'approaching') : 'none'
  if(level!=='none'){
    const created=await client.query(`INSERT INTO citizen_deadline_alerts(application_id,citizen_id,tenant_id,alert_level)
      VALUES($1,$2,$3,$4) ON CONFLICT(application_id,alert_level) DO NOTHING RETURNING id`,
      [id,actor.id,actor.tenantId,level])
    if(created.rowCount)await client.query(`INSERT INTO citizen_notifications(citizen_id,tenant_id,application_id,title,body)
      VALUES($1,$2,$3,$4,$5)`,[actor.id,actor.tenantId,id,
      level==='overdue'?'Hồ sơ đã quá hạn giải quyết':'Hồ sơ gần đến hạn giải quyết',
      level==='overdue'?'Hồ sơ quá hạn; bạn có thể gửi yêu cầu xem xét.':'Theo dõi tiến độ hồ sơ và liên hệ cơ quan nếu cần.'])
  }
  const lastReason=(await client.query(`SELECT reason,stage_name,unit_name,created_at
    FROM citizen_case_stage_updates WHERE application_id=$1 AND btrim(reason)<>''
    ORDER BY created_at DESC,id DESC LIMIT 1`,[id])).rows[0]||null
  return {applicationId:id,dueAt:row.due_at,daysLeft:row.days_left,level,
    explanation:lastReason,notice:lastReason
      ? 'Lý do dưới đây do cán bộ nhập ở công đoạn xử lý, không phải giải thích tự động của hệ thống.'
      : 'Chưa có lý do thay đổi thời hạn được cán bộ cập nhật. Cảnh báo chỉ dựa trên hạn xử lý đã lưu.'}
}))
