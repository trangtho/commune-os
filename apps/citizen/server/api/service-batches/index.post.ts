// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { z } from 'zod'
import { citizenTx } from '../../utils/database'
import { validate } from '../../utils/validation'
import { phoneIssue } from '../../../shared/identity-validation'
const schema=z.object({
 title:z.string().trim().min(3).max(120),purpose:z.string().trim().max(500).default(''),
 procedureIds:z.array(z.string().regex(/^[a-z0-9-]{2,80}$/)).min(2).max(4),
 shareConsent:z.boolean().default(false),
 phone:z.string().trim().max(20).default('')
}).strict()
export default defineEventHandler(async event=>{
 const input=validate(schema,await readBody(event))
 if (new Set(input.procedureIds).size!==input.procedureIds.length)
  throw createError({statusCode:422,statusMessage:'Một thủ tục không được chọn nhiều lần'})
 if (input.shareConsent && phoneIssue(input.phone))
  throw createError({statusCode:422,statusMessage:'Số điện thoại dùng chung không hợp lệ'})
 const item=await citizenTx(event,async(client,actor)=>{
  const catalog=(await client.query('SELECT id FROM procedures WHERE id=ANY($1::text[]) AND published=true', [input.procedureIds])).rows
  if(catalog.length!==input.procedureIds.length)throw createError({statusCode:422,statusMessage:'Có thủ tục không còn được công bố'})
  const sharedData=input.shareConsent ? {applicantName:actor.name,phone:input.phone}:{}
  const batch=(await client.query(`INSERT INTO citizen_service_batches(citizen_id,tenant_id,title,purpose,shared_data,shared_consent)
    VALUES($1,$2,$3,$4,$5::jsonb,$6) RETURNING id`,
    [actor.id,actor.tenantId,input.title,input.purpose,JSON.stringify(sharedData),input.shareConsent])).rows[0]
  for (let i=0;i<input.procedureIds.length;i++) {
   await client.query('INSERT INTO citizen_service_batch_items(batch_id,procedure_id,position) VALUES($1,$2,$3)',
    [batch.id,input.procedureIds[i],i+1])
  }
  return {id:batch.id,mode:'preparation'}
 })
 setResponseStatus(event,201)
 return item
})
