// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenTx } from '../../../../utils/database'
export default defineEventHandler(event=>citizenTx(event,async client=>{
 const id=String(getRouterParam(event,'id')||'')
 if(!/^[a-f0-9-]{36}$/i.test(id))throw createError({statusCode:400,statusMessage:'Mã lịch hẹn không hợp lệ'})
 const ok=(await client.query('SELECT citizen_cancel_counter_booking($1) AS ok',[id])).rows[0]?.ok
 if(!ok)throw createError({statusCode:409,statusMessage:'Lịch hẹn không thể hủy hoặc không thuộc tài khoản'})
 return {ok:true}
}))
