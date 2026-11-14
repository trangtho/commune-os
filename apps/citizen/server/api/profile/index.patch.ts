// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { z } from 'zod'
import { citizenTx } from '../../utils/database'
import { signSession } from '../../utils/session'
import { validate } from '../../utils/validation'
const schema=z.object({display_name:z.string().trim().min(2).max(100),email:z.union([z.string().email().max(150),z.literal('')]),phone:z.string().max(25),address:z.string().max(250)})
export default defineEventHandler(async(event)=>{
  const b=validate(schema,await readBody(event))
  return citizenTx(event,async(client,actor)=>{
    await client.query('UPDATE citizens SET display_name=$1,email=$2,phone=$3,address=$4 WHERE id=$5',[b.display_name,b.email,b.phone,b.address,actor.id])
    // Refresh the signed display name so header/home update without a new login.
    signSession(event, { id:actor.id, tenantId:actor.tenantId, name:b.display_name })
    return {ok:true}
  })
})
