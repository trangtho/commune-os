// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenTx } from '../../../utils/database'
export default defineEventHandler(async(event)=>citizenTx(event,async(client)=>{
  await client.query('UPDATE citizen_notifications SET is_read=true WHERE id=$1',[getRouterParam(event,'id')]);return {ok:true}
}))
