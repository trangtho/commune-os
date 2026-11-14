// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { broadcastSchema,validate } from '../../utils/validation'
import { staffTx } from '../../utils/database'
export default defineEventHandler(async(event)=>staffTx(event,async(client,actor)=>{
  const body=validate(broadcastSchema,await readBody(event))
  await client.query(`INSERT INTO citizen_notifications(id,application_id,title,body,category,is_read,created_at,recipient_role)
    SELECT gen_random_uuid(),NULL,$1,$2,'broadcast',false,now(),'citizen'`,[body.title,body.body])
  return {ok:true}
}))
