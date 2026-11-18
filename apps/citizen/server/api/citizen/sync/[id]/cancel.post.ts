// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {citizenTx} from '../../../../utils/database'
export default defineEventHandler(event=>citizenTx(event,async(client)=>{
 const body=await readBody(event)
 if(body?.confirmed!==true)throw createError({statusCode:400,statusMessage:'Cần xác nhận hủy yêu cầu'})
 const id=String(getRouterParam(event,'id')||'')
 const result=await client.query("UPDATE citizen_sync_requests SET state='cancelled' WHERE id=$1 AND state='pending' RETURNING id",[id])
 if(!result.rowCount)throw createError({statusCode:404,statusMessage:'Không tìm thấy yêu cầu còn chờ xử lý'})
 return {id,state:'cancelled'}
}))
