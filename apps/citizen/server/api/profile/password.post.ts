// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { citizenTx } from '../../utils/database'
import { validate } from '../../utils/validation'
const schema=z.object({oldPassword:z.string(),newPassword:z.string().min(10).max(128)})
export default defineEventHandler(async(event)=>{
  const body=validate(schema,await readBody(event))
  return citizenTx(event,async(client,actor)=>{
    const old=(await client.query('SELECT password_hash FROM citizens WHERE id=$1',[actor.id])).rows[0]?.password_hash||''
    const [,salt,digest]=old.split('$')
    if(!salt||!digest||!timingSafeEqual(Buffer.from(digest,'hex'),scryptSync(body.oldPassword,salt,64)))
      throw createError({statusCode:403,statusMessage:'Mật khẩu hiện tại không đúng'})
    const newSalt=randomBytes(16).toString('hex')
    const newHash=`scrypt$${newSalt}$${scryptSync(body.newPassword,newSalt,64).toString('hex')}`
    await client.query('UPDATE citizens SET password_hash=$1 WHERE id=$2',[newHash,actor.id])
    return {ok:true}
  })
})
