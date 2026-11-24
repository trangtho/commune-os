// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Hủy lượt đã đặt (api.citizen_counter_booking_cancel của lõi).
import { citizenRpc } from '../../../../utils/identity'
export default defineEventHandler(event=>{
 const id=String(getRouterParam(event,'id')||'')
 if(!/^[a-f0-9-]{36}$/i.test(id))throw createError({statusCode:400,statusMessage:'Mã lịch hẹn không hợp lệ'})
 return citizenRpc(event,'citizen_counter_booking_cancel',{p_booking_id:id})
})
