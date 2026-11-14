// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { staffTx } from '../../../utils/database'
import { statusSchema,validate } from '../../../utils/validation'
export default defineEventHandler(async(event)=>{
  try {
    const body=validate(statusSchema,await readBody(event))
    const id=getRouterParam(event,'id')
    return await staffTx(event,async(client,actor)=>{
      const row=(await client.query('SELECT id,status FROM applications WHERE id=$1 FOR UPDATE',[id])).rows[0]
      if(!row)throw createError({statusCode:404,statusMessage:'Hồ sơ không tồn tại'})
      await client.query(`UPDATE applications SET status=$1, updated_at=now() WHERE id=$2 RETURNING id,status`,[body.status,id])
      await client.query(`INSERT INTO application_events(application_id,event_type,note,actor_name,created_at) VALUES($1,'status_change',$2,$3,now())`,
        [id,body.note||`Cập nhật trạng thái thành ${body.status}`,actor.name])
      return {id,status:body.status}
    })
  } catch (e:any) {
    if(e?.statusCode) throw e
    throw createError({statusCode:500,statusMessage:'Không thể cập nhật trạng thái. Vui lòng kiểm tra kết nối cơ sở dữ liệu.'})
  }
})
