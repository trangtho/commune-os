// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenTx } from '../../../utils/database'
export default defineEventHandler(async(event)=>citizenTx(event,async(client,actor)=>{
  const id=getRouterParam(event,'id')
  const row=(await client.query('SELECT * FROM applications WHERE id=$1 FOR UPDATE',[id])).rows[0]
  if(!row||row.status!=='supplement')throw createError({statusCode:409,statusMessage:'Hồ sơ không ở trạng thái yêu cầu bổ sung'})
  const newDocs=(await client.query(`SELECT count(*)::int AS count FROM application_documents d WHERE d.application_id=$1
    AND d.uploaded_at > COALESCE((SELECT max(e.created_at) FROM application_events e WHERE e.application_id=$1 AND e.event_type='supplement'),'epoch'::timestamptz)`,[id])).rows[0].count
  if(!newDocs)throw createError({statusCode:422,statusMessage:'Vui lòng tải ít nhất một giấy tờ bổ sung'})
  await client.query("UPDATE applications SET status='processing',updated_at=now() WHERE id=$1",[id])
  await client.query("INSERT INTO application_events(application_id,event_type,note,actor_name) VALUES($1,'processing','Công dân đã gửi bổ sung giấy tờ.',$2)",[id,actor.name])
  await client.query("INSERT INTO citizen_notifications(citizen_id,tenant_id,application_id,title,body) VALUES($1,$2,$3,'Đã gửi bổ sung hồ sơ','Giấy tờ bổ sung đã được ghi nhận (mẫu).')",[actor.id,actor.tenantId,id])
  return {ok:true}
}))
