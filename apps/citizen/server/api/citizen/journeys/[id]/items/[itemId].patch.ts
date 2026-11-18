// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {z} from 'zod'
import {validate} from '../../../../../utils/validation'
import {citizenTx} from '../../../../../utils/database'
const schema=z.object({state:z.enum(['todo','in_progress','done','skipped']),applicationId:z.string().max(90).nullable().optional()}).strict()
export default defineEventHandler(async event=>{
 const body=validate(schema,await readBody(event))
 const journeyId=String(getRouterParam(event,'id')||'')
 const itemId=String(getRouterParam(event,'itemId')||'')
 return citizenTx(event,async client=>{
  const item=(await client.query(`SELECT i.id,i.procedure_id,i.application_id,j.status AS journey_status
   FROM citizen_life_journey_items i JOIN citizen_life_journeys j ON j.id=i.journey_id
   WHERE i.id=$1 AND i.journey_id=$2 FOR UPDATE OF i`,[itemId,journeyId])).rows[0]
  if(!item)throw createError({statusCode:404,statusMessage:'Không tìm thấy bước thuộc lộ trình'})
  if(item.journey_status!=='active')throw createError({statusCode:409,statusMessage:'Lộ trình đã đóng'})
  let applicationId=item.application_id
  if(body.applicationId!==undefined){
   if(body.applicationId){
    const owned=(await client.query('SELECT id FROM applications WHERE id=$1 AND procedure_id=$2',[body.applicationId,item.procedure_id])).rows[0]
    if(!owned)throw createError({statusCode:422,statusMessage:'Chỉ liên kết hồ sơ đúng thủ tục của chính tài khoản'})
   }
   applicationId=body.applicationId
  }
  await client.query(`UPDATE citizen_life_journey_items SET state=$1,application_id=$2,updated_at=now() WHERE id=$3`,[body.state,applicationId,itemId])
  await client.query('UPDATE citizen_life_journeys SET updated_at=now() WHERE id=$1',[journeyId])
  return {id:itemId,state:body.state,applicationId,notice:'Trạng thái tự theo dõi; không phải kết luận hoàn thành từ cơ quan.'}
 })
})
