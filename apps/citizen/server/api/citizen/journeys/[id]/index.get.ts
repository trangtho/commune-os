// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Chi tiết lộ trình (api.citizen_journey của lõi); đường dẫn bước tiếp theo dựng ở đây.
import {citizenRpc} from '../../../../utils/identity'
export default defineEventHandler(async event=>{
 setHeader(event,'Cache-Control','private, no-store')
 const id=String(getRouterParam(event,'id')||'')
 if(!/^[0-9a-f-]{36}$/i.test(id))throw createError({statusCode:400,statusMessage:'Mã lộ trình không hợp lệ'})
 const journey=await citizenRpc<{items:any[]}&Record<string,unknown>>(event,'citizen_journey',{p_journey_id:id})
 const actions=journey.items.map(i=>({itemId:i.id,caseId:i.application_id,
  status:i.application_status||i.state,readyToStart:!i.application_id,
  href:i.application_id ? (i.application_status==='draft'?`/nop-ho-so/${encodeURIComponent(i.procedure_id)}?draft=${encodeURIComponent(i.application_id)}&step=1`:`/ho-so/${encodeURIComponent(i.application_id)}`):`/thu-tuc/${encodeURIComponent(i.procedure_id)}`}))
 return {...journey,actions,notice:'Trình tự là danh sách chuẩn bị do bạn chọn; chưa có dữ liệu xác nhận quan hệ phụ thuộc và khả năng xử lý song song.'}
})
