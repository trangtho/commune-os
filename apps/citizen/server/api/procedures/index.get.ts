// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { publicQuery } from '../../utils/database'
import { dbIssue } from '../../utils/db-diagnostics'
import { readSession } from '../../utils/session'
export default defineEventHandler(async(event)=>{
  const q=String(getQuery(event).q||'').slice(0,120)
  const category=String(getQuery(event).category||'').slice(0,100)
  // Đã đăng nhập: chỉ hiện thủ tục mà xã của người dân đã mở (quản trị bật ở bảng quản trị lõi).
  const tenantId=readSession(event)?.tenantId||null
  try {
    return await publicQuery(`SELECT p.*,COUNT(d.document_code)::int AS document_count FROM procedures p
      LEFT JOIN procedure_documents d ON d.procedure_id=p.id
      WHERE p.published AND ($1='' OR p.title ILIKE '%'||$1||'%' OR p.summary ILIKE '%'||$1||'%')
      AND ($2='' OR p.category=$2)
      AND ($3::uuid IS NULL OR public.procedure_enabled_for($3::uuid,p.id))
      GROUP BY p.id ORDER BY p.title`,[q,category,tenantId])
  } catch (error) {
    const issue=dbIssue(error)
    console.error('[procedures] Database query failed, reason:', issue.code)
    throw createError({ statusCode:503, statusMessage:issue.message, data:{errorCode:issue.code} })
  }
})
