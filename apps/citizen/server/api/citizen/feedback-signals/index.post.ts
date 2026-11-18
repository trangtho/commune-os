// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {getRequestIP} from 'h3'
import {z} from 'zod'
import {citizenTx} from '../../../utils/database'
import {validate} from '../../../utils/validation'
const schema=z.object({procedureId:z.string().regex(/^[a-z0-9-]{2,80}$/).nullable(),
 stage:z.enum(['lookup','form','documents','review','chat']),
 issue:z.enum(['needs_help','unclear_field','validation_problem','abandoned','insufficient_answer']),
 consent:z.literal(true)}).strict()
const requests=new Map<string,{time:number;count:number}>()
export default defineEventHandler(async event=>{
 const input=validate(schema,await readBody(event))
 // In-memory limiter is only a secondary protection; use a gateway rate limit in production.
 const ip=getRequestIP(event,{xForwardedFor:false})||'unknown'
 const now=Date.now();if(requests.size>3000)for(const [key,value] of requests)if(now-value.time>60000)requests.delete(key)
 const old=requests.get(ip);const current=old&&now-old.time<60000?old:{time:now,count:0}
 if(++current.count>10)throw createError({statusCode:429,statusMessage:'Quá nhiều báo cáo trong một phút'})
 requests.set(ip,current)
 return citizenTx(event,async(client,actor)=>{
  if(input.procedureId && !(await client.query('SELECT 1 FROM procedures WHERE id=$1 AND published=true',[input.procedureId])).rowCount)
   throw createError({statusCode:422,statusMessage:'Thủ tục không tồn tại'})
  // Do not save raw text, personal data, citizen ID or IP address.
  await client.query('INSERT INTO citizen_friction_events(tenant_id,procedure_id,stage,issue) VALUES($1,$2,$3,$4)',
   [actor.tenantId,input.procedureId,input.stage,input.issue])
  return {accepted:true,notice:'Chỉ ghi nhận mã loại khó khăn và bước thao tác; không lưu nội dung biểu mẫu hoặc danh tính.'}
 })
})
