// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Lưu ngày sinh, số định danh tự khai (api.citizen_self_facts_update của lõi).
import { z } from 'zod'
import { citizenRpc } from '../../../utils/identity'
import { validate } from '../../../utils/validation'
import { safeVerifiedClaim } from '../../../../shared/citizen-autofill'
const schema=z.object({birthDate:z.string().max(10),citizenIdentifier:z.string().max(12)}).strict().superRefine((data,ctx)=>{
 for(const [key,value] of [['birthDate',data.birthDate],['citizenIdentifier',data.citizenIdentifier]] as const){
  if(value && !safeVerifiedClaim(key,value))ctx.addIssue({code:'custom',path:[key],message:'Thông tin tự khai không hợp lệ'})
 }
})
export default defineEventHandler(async event=>{
 const body=validate(schema,await readBody(event))
 return citizenRpc(event,'citizen_self_facts_update',{p_birth_date:body.birthDate||null,p_citizen_identifier:body.citizenIdentifier||null})
})
