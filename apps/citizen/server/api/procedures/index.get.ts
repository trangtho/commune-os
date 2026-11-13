// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { publicQuery } from '../../utils/database'
import { dbIssue } from '../../utils/db-diagnostics'
export default defineEventHandler(async(event)=>{
  const q=String(getQuery(event).q||'').slice(0,120)
  const category=String(getQuery(event).category||'').slice(0,100)
  try {
    return await publicQuery(`SELECT p.*,COUNT(d.document_code)::int AS document_count FROM procedures p
      LEFT JOIN procedure_documents d ON d.procedure_id=p.id
      WHERE p.published AND ($1='' OR p.title ILIKE '%'||$1||'%' OR p.summary ILIKE '%'||$1||'%')
      AND ($2='' OR p.category=$2) GROUP BY p.id ORDER BY p.title`,[q,category])
  } catch (error) {
    const issue=dbIssue(error)
    console.error('[procedures] Database query failed, reason:', issue.code)
    throw createError({ statusCode:503, statusMessage:issue.message, data:{errorCode:issue.code} })
  }
})
