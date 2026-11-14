// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { db } from '../../../../utils/database'
import { requireStaffBridge } from '../../../../utils/staff-bridge'
export default defineEventHandler(async event=>{
  const actor=requireStaffBridge(event)
  const id=getRouterParam(event,'id')||''
  if(!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))throw createError({statusCode:400,statusMessage:'Mã yêu cầu không hợp lệ'})
  const ticket=(await db().query('SELECT citizen_staff_support_ticket_detail($1::uuid,$2::uuid) AS ticket',[id,actor.tenantId])).rows[0]?.ticket
  if(!ticket)throw createError({statusCode:404,statusMessage:'Không có yêu cầu trong địa phương được phân quyền'})
  return ticket
})
