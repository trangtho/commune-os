// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenTx } from '../../../utils/database'
export default defineEventHandler(event => citizenTx(event,async client=>{
  const id=getRouterParam(event,'id') || ''
  if(!/^[0-9a-f-]{36}$/i.test(id))throw createError({statusCode:400,statusMessage:'Mã lịch hẹn không hợp lệ'})
  const changed=(await client.query('SELECT citizen_cancel_consultation($1) AS changed',[id])).rows[0]?.changed
  if(!changed)throw createError({statusCode:404,statusMessage:'Không có lịch hẹn có thể hủy'})
  return {ok:true}
}))
