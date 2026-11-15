// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenTx } from '../../../utils/database'
export default defineEventHandler(async(event)=>citizenTx(event,async(client,actor)=>{
  const id=getRouterParam(event,'id')
  const row=(await client.query('SELECT * FROM applications WHERE id=$1 FOR UPDATE',[id])).rows[0]
  if(!row||row.status!=='supplement')throw createError({statusCode:409,statusMessage:'Hồ sơ không ở trạng thái yêu cầu bổ sung'})
  const latestEvent=(await client.query(`SELECT id FROM application_events WHERE application_id=$1
     AND event_type='supplement' ORDER BY id DESC LIMIT 1`,[id])).rows[0]?.id
  const requested=latestEvent?(await client.query(`SELECT id,kind,target_key,citizen_response,document_id,created_at
     FROM citizen_supplement_items WHERE application_id=$1 AND request_event_id=$2`,[id,latestEvent])).rows:[]
  if(requested.length){
    for(const item of requested){
      if(item.kind==='field' && !String(item.citizen_response||'').trim())
        throw createError({statusCode:422,statusMessage:'Còn nội dung kê khai cần giải trình. Vui lòng hoàn thiện từng yêu cầu.'})
      if(item.kind==='document' && (!item.document_id || !(await client.query(`SELECT 1 FROM application_documents
        WHERE id=$1 AND application_id=$2 AND document_code=$3 AND uploaded_at>$4`,
        [item.document_id,id,item.target_key,item.created_at])).rowCount))
        throw createError({statusCode:422,statusMessage:'Còn giấy tờ theo yêu cầu cán bộ chưa được bổ sung đúng loại.'})
    }
  }
  const newDocs=(await client.query(`SELECT count(*)::int AS count FROM application_documents d WHERE d.application_id=$1
    AND d.uploaded_at > COALESCE((SELECT max(e.created_at) FROM application_events e WHERE e.application_id=$1 AND e.event_type='supplement'),'epoch'::timestamptz)`,[id])).rows[0].count
  if(!requested.length && !newDocs)throw createError({statusCode:422,statusMessage:'Vui lòng tải ít nhất một giấy tờ bổ sung'})
  await client.query("UPDATE applications SET status='processing',updated_at=now() WHERE id=$1",[id])
  await client.query("INSERT INTO application_events(application_id,event_type,note,actor_name) VALUES($1,'processing','Công dân đã gửi bổ sung giấy tờ.',$2)",[id,actor.name])
  await client.query("INSERT INTO citizen_notifications(citizen_id,tenant_id,application_id,title,body) VALUES($1,$2,$3,'Đã gửi bổ sung hồ sơ','Giấy tờ bổ sung đã được ghi nhận (mẫu).')",[actor.id,actor.tenantId,id])
  return {ok:true}
}))
