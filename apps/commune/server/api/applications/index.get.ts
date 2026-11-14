// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { staffTx } from '../../utils/database'
export default defineEventHandler(async(event)=>{
  try {
    return await staffTx(event,async(client)=>{
      const status=String(getQuery(event).status||'')
      const q=String(getQuery(event).q||'').slice(0,100)
      const rows=(await client.query(`SELECT a.id,a.procedure_id,p.title AS procedure_title,p.category,
        a.status,a.applicant_name,a.applicant_phone,a.description,a.form_data,
        a.submitted_at,a.due_at,a.result_note,a.updated_at
        FROM applications a JOIN procedures p ON a.procedure_id=p.id
        WHERE ($1='' OR a.status=$1) AND ($2='' OR a.id ILIKE '%'||$2||'%' OR p.title ILIKE '%'||$2||'%' OR a.applicant_name ILIKE '%'||$2||'%')
        ORDER BY a.updated_at DESC LIMIT 200`,[status,q])).rows
      return rows
    })
  } catch {
    return []
  }
})
