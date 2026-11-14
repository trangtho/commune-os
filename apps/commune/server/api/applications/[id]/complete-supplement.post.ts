// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { staffTx } from '../../../utils/database'
export default defineEventHandler(async(event)=>staffTx(event,async(client,actor)=>{
  const id=getRouterParam(event,'id')
  const row=(await client.query('SELECT id,status FROM applications WHERE id=$1 FOR UPDATE',[id])).rows[0]
  if(!row)throw createError({statusCode:404,statusMessage:'Hồ sơ không tồn tại'})
  if(row.status!=='supplement')throw createError({statusCode:409,statusMessage:'Chỉ xác nhận bổ sung khi hồ sơ ở trạng thái cần bổ sung'})
  await client.query(`UPDATE applications SET status='processing', updated_at=now() WHERE id=$1 RETURNING id,status`,[id])
  await client.query(`INSERT INTO application_events(application_id,event_type,note,actor_name,created_at) VALUES($1,'supplement_received',$2,$3,now())`,
    [id,'Đã nhận hồ sơ bổ sung từ công dân',actor.name])
  return {id,status:'processing'}
}))
