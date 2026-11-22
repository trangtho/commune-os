// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { z } from 'zod'
import { phoneIssue, emailIssue } from '../../../shared/identity-validation'
import { citizenRpc } from '../../utils/identity'
import { requireCitizen, signSession } from '../../utils/session'
import { validate } from '../../utils/validation'
const schema=z.object({display_name:z.string().trim().min(2).max(100),email:z.string().trim().max(150),phone:z.string().trim().max(25),address:z.string().trim().max(250)}).superRefine((data,context)=>{
  const phone=phoneIssue(data.phone), email=emailIssue(data.email)
  if(phone)context.addIssue({code:'custom',path:['phone'],message:phone})
  if(email)context.addIssue({code:'custom',path:['email'],message:email})
})
export default defineEventHandler(async(event)=>{
  const actor=requireCitizen(event)
  const b=validate(schema,await readBody(event))
  await citizenRpc(event,'citizen_profile_update',{p_display_name:b.display_name,p_email:b.email,p_phone:b.phone,p_address:b.address})
  // Cập nhật tên trong phiên để đầu trang hiện tên mới mà không phải đăng nhập lại.
  signSession(event, { id:actor.id, tenantId:actor.tenantId, name:b.display_name, authMethod:actor.authMethod })
  return {ok:true}
})
