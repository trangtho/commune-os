// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Yêu cầu hỗ trợ của công dân, lọc theo trạng thái, tìm theo tiêu đề / mã (api.citizen_tickets của lõi).
import { citizenRpc } from '../../utils/identity'
export default defineEventHandler(event=>{
  setHeader(event,'Cache-Control','private, no-store')
  const query=getQuery(event)
  const requested=Number(query.page)
  return citizenRpc(event,'citizen_tickets',{p_status:typeof query.status==='string'?query.status:'',
    p_q:typeof query.q==='string'?query.q:'',p_page:Number.isSafeInteger(requested)&&requested>0?Math.min(requested,100000):1})
})
