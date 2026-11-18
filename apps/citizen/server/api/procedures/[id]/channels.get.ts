// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {publicQuery,citizenTx} from '../../../utils/database'
import {readSession} from '../../../utils/session'
import {compareChannels} from '../../../../shared/life-journey.mjs'
export default defineEventHandler(async event=>{
 setHeader(event,'Cache-Control','no-store')
 const id=String(getRouterParam(event,'id')||'')
 const procedure=(await publicQuery<{id:string;fee_note:string;published:boolean}>(`SELECT id,fee_note,published FROM procedures WHERE id=$1 AND published=true`,[id]))[0]
 if(!procedure)throw createError({statusCode:404,statusMessage:'Không tìm thấy thủ tục đang công bố'})
 const tenant=readSession(event)?.tenantId||null
 const online=tenant?(await publicQuery<{ok:boolean}>('SELECT public.procedure_enabled_for($1::uuid,$2) AS ok',[tenant,id]))[0]?.ok===true:false
 // Public slot availability is a concrete scheduling signal, NOT proof that this procedure requires a visit.
 const counter=tenant?await citizenTx(event,async client=>Number((await client.query<{total:number}>(`SELECT count(*)::int AS total FROM citizen_counter_slots
  WHERE tenant_id=$1 AND procedure_id=$2 AND published=true AND starts_at>now()`,[tenant,id])).rows[0]?.total||0)):0
 const comparison=compareChannels(procedure,{online,counter:counter>0,hybrid:false})
 return {...comparison,procedureId:id,counterSlots:Number(counter),notice:comparison.notice+' Chỉ hiện các kênh có bằng chứng trong cấu hình hiện tại.'}
})
