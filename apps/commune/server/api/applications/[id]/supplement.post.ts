// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { staffTx } from '../../../utils/database'
import { supplementSchema,validate } from '../../../utils/validation'
export default defineEventHandler(async(event)=>{
  try {
    const body=validate(supplementSchema,await readBody(event))
    const id=getRouterParam(event,'id')
    return await staffTx(event,async(client,actor)=>{
      const row=(await client.query('SELECT id,status FROM applications WHERE id=$1 FOR UPDATE',[id])).rows[0]
      if(!row)throw createError({statusCode:404,statusMessage:'Hồ sơ không tồn tại'})
      if(row.status!=='processing'&&row.status!=='submitted')throw createError({statusCode:409,statusMessage:'Chỉ có thể yêu cầu bổ sung hồ sơ đang xử lý hoặc đã tiếp nhận'})
      await client.query(`UPDATE applications SET status='supplement', updated_at=now() WHERE id=$1 RETURNING id,status`,[id])
      await client.query(`INSERT INTO application_events(application_id,event_type,note,actor_name,created_at) VALUES($1,'supplement',$2,$3,now())`,
        [id,body.note||'Yêu cầu công dân bổ sung giấy tờ',actor.name])
      return {id,status:'supplement'}
    })
  } catch (e:any) {
    if(e?.statusCode) throw e
    throw createError({statusCode:500,statusMessage:'Không thể yêu cầu bổ sung. Vui lòng kiểm tra kết nối cơ sở dữ liệu.'})
  }
})
