// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { z } from 'zod'
import { citizenTx } from '../../../utils/database'
import { validate } from '../../../utils/validation'
import { safeVerifiedClaim } from '../../../../shared/citizen-autofill'
const schema=z.object({birthDate:z.string().max(10),citizenIdentifier:z.string().max(12)}).strict().superRefine((data,ctx)=>{
 for(const [key,value] of [['birthDate',data.birthDate],['citizenIdentifier',data.citizenIdentifier]] as const){
  if(value && !safeVerifiedClaim(key,value))ctx.addIssue({code:'custom',path:[key],message:'Thông tin tự khai không hợp lệ'})
 }
})
export default defineEventHandler(async event=>{
 const body=validate(schema,await readBody(event))
 return citizenTx(event,async(client,actor)=>{
  await client.query(`INSERT INTO citizen_self_facts(citizen_id,tenant_id,birth_date,citizen_identifier)
    VALUES($1,$2,$3::date,$4) ON CONFLICT(citizen_id) DO UPDATE SET
    birth_date=EXCLUDED.birth_date,citizen_identifier=EXCLUDED.citizen_identifier,updated_at=now()`,
    [actor.id,actor.tenantId,body.birthDate||null,body.citizenIdentifier||null])
  return {ok:true,notice:'Dữ liệu tự khai, chưa xác minh qua cơ quan định danh'}
 })
})
