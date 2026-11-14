// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { staffTx } from '../../../utils/database'
import { publishSchema,validate } from '../../../utils/validation'
export default defineEventHandler(async(event)=>{
  try {
    const body=validate(publishSchema,await readBody(event))
    const slug=getRouterParam(event,'slug')
    return await staffTx(event,async(client,actor)=>{
      const row=(await client.query('UPDATE procedures SET published=$1 WHERE id=$2 RETURNING id,published',[body.publish,slug])).rows[0]
      if(!row)throw createError({statusCode:404,statusMessage:'Thủ tục không tồn tại'})
      return {id:slug,published:row.published}
    })
  } catch (e:any) {
    if(e?.statusCode) throw e
    throw createError({statusCode:500,statusMessage:'Không thể cập nhật trạng thái công bố. Vui lòng kiểm tra kết nối cơ sở dữ liệu.'})
  }
})
