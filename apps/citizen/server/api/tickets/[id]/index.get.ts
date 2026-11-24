// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Chi tiết một yêu cầu hỗ trợ kèm lịch sử trao đổi (api.citizen_ticket của lõi).
import { citizenRpc } from '../../../utils/identity'
export default defineEventHandler(event=>{
  setHeader(event,'Cache-Control','private, no-store')
  const id=getRouterParam(event,'id')||''
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw createError({statusCode:400,statusMessage:'Mã định danh không hợp lệ'})
  return citizenRpc(event,'citizen_ticket',{p_ticket_id:id})
})
