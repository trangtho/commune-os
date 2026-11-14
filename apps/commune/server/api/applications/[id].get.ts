// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { staffTx } from '../../utils/database'
export default defineEventHandler(async(event)=>{
  try {
    return await staffTx(event,async(client)=>{
      const id=getRouterParam(event,'id')
      const row=(await client.query(`SELECT a.*,p.title AS procedure_title,p.category FROM applications a JOIN procedures p ON p.id=a.procedure_id WHERE a.id=$1`,[id])).rows[0]
      if(!row)throw createError({statusCode:404,statusMessage:'Hồ sơ không tồn tại'})
      const events=(await client.query('SELECT id,event_type,note,actor_name,created_at FROM application_events WHERE application_id=$1 ORDER BY created_at,id',[id])).rows
      const documents=(await client.query('SELECT id,document_code,original_name,size_bytes,uploaded_at FROM application_documents WHERE application_id=$1 ORDER BY uploaded_at DESC',[id])).rows
      const requirements=(await client.query('SELECT document_code,document_name,is_required FROM procedure_documents WHERE procedure_id=$1 ORDER BY document_code',[row.procedure_id])).rows
      return {...row,events,documents,requirements}
    })
  } catch (e:any) {
    if(e?.statusCode) throw e
    throw createError({statusCode:404,statusMessage:'Hồ sơ không tồn tại hoặc không thể kết nối cơ sở dữ liệu'})
  }
})
