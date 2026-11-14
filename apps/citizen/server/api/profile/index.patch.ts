// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { z } from 'zod'
import { phoneIssue, emailIssue } from '../../../shared/identity-validation'
import { citizenTx } from '../../utils/database'
import { signSession } from '../../utils/session'
import { validate } from '../../utils/validation'
const schema=z.object({display_name:z.string().trim().min(2).max(100),email:z.string().trim().max(150),phone:z.string().trim().max(25),address:z.string().trim().max(250)}).superRefine((data,context)=>{
  const phone=phoneIssue(data.phone), email=emailIssue(data.email)
  if(phone)context.addIssue({code:'custom',path:['phone'],message:phone})
  if(email)context.addIssue({code:'custom',path:['email'],message:email})
})
export default defineEventHandler(async(event)=>{
  const b=validate(schema,await readBody(event))
  return citizenTx(event,async(client,actor)=>{
    await client.query('UPDATE citizens SET display_name=$1,email=$2,phone=$3,address=$4 WHERE id=$5',[b.display_name,b.email,b.phone,b.address,actor.id])
    // Refresh the signed display name so header/home update without a new login.
    signSession(event, { id:actor.id, tenantId:actor.tenantId, name:b.display_name })
    return {ok:true}
  })
})
