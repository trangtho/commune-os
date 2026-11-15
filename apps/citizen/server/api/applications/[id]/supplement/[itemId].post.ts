// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { z } from 'zod'
import { validate } from '../../../../utils/validation'
import { citizenTx } from '../../../../utils/database'
const schema=z.object({response:z.string().trim().min(2).max(1000).nullable().optional(),documentId:z.string().uuid().nullable().optional()})
export default defineEventHandler(async event=>{
 const body=validate(schema,await readBody(event))
 const id=String(getRouterParam(event,'id')||''), itemId=String(getRouterParam(event,'itemId')||'')
 return citizenTx(event,async client=>{
  if(!(await client.query('SELECT 1 FROM applications WHERE id=$1 AND status=$2',[id,'supplement'])).rowCount)
    throw createError({statusCode:404,statusMessage:'Không tìm thấy yêu cầu bổ sung'})
  const matched=(await client.query('SELECT 1 FROM citizen_supplement_items WHERE id=$1 AND application_id=$2',[itemId,id])).rowCount
  if(!matched)throw createError({statusCode:404,statusMessage:'Yêu cầu bổ sung không tồn tại'})
  const ok=(await client.query('SELECT citizen_answer_supplement_item($1,$2,$3) AS ok',[itemId,body.response||null,body.documentId||null])).rows[0]?.ok
  if(!ok)throw createError({statusCode:422,statusMessage:'Nội dung không hợp lệ, giấy tờ không đúng yêu cầu hoặc yêu cầu đã hết hiệu lực'})
  return {ok:true}
 })
})
