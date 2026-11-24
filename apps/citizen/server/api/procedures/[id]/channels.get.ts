// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// So sánh kênh thực hiện: lõi cho biết xã của công dân có mở trực tuyến, có khung giờ tại quầy không
// (api.public_procedure_channels; khách không có xã nên chỉ thấy thông tin chung).
import {catalogRpc} from '../../../utils/identity'
import {compareChannels} from '../../../../shared/life-journey.mjs'
export default defineEventHandler(async event=>{
 setHeader(event,'Cache-Control','no-store')
 const id=String(getRouterParam(event,'id')||'')
 const p=await catalogRpc<{id:string;fee_note:string;published:boolean;online:boolean;counterSlots:number}>(event,'public_procedure_channels',{p_procedure_id:id})
 // Public slot availability is a concrete scheduling signal, NOT proof that this procedure requires a visit.
 const comparison=compareChannels(p,{online:p.online,counter:p.counterSlots>0,hybrid:false})
 return {...comparison,procedureId:id,counterSlots:Number(p.counterSlots),notice:comparison.notice+' Chỉ hiện các kênh có bằng chứng trong cấu hình hiện tại.'}
})
