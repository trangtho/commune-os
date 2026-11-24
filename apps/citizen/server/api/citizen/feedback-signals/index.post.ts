// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {getRequestIP} from 'h3'
import {z} from 'zod'
import {citizenRpc} from '../../../utils/identity'
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
 // Do not save raw text, personal data, citizen ID or IP address (api.citizen_friction_signal của lõi).
 return citizenRpc(event,'citizen_friction_signal',{p_procedure_id:input.procedureId,p_stage:input.stage,p_issue:input.issue})
})
