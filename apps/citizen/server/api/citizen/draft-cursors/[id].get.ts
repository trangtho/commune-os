// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {citizenTx} from '../../../utils/database'
export default defineEventHandler(event=>citizenTx(event,async(client,actor)=>{
 setHeader(event,'Cache-Control','private, no-store')
 const id=String(getRouterParam(event,'id')||'')
 const row=(await client.query(`SELECT a.id,a.status,c.step,c.revision,c.updated_at FROM applications a
 LEFT JOIN citizen_draft_cursors c ON c.application_id=a.id WHERE a.id=$1`,[id])).rows[0]
 if(!row||row.status!=='draft')throw createError({statusCode:404,statusMessage:'Bản nháp không còn khả dụng'})
 return {applicationId:id,step:row.step||1,revision:row.revision||0,updatedAt:row.updated_at||null,
  notice:'Chỉ lưu bước thực hiện. Nội dung kê khai lưu trong bản nháp trên máy chủ.'}
}))
