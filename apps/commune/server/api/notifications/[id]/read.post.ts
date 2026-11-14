// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { staffTx } from '../../../utils/database'
export default defineEventHandler(async(event)=>staffTx(event,async(client)=>{
  const id=getRouterParam(event,'id')
  await client.query(`UPDATE citizen_notifications SET is_read=true WHERE id=$1`,[id])
  return {ok:true}
}))
