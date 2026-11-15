// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenTx } from '../../../../utils/database'
export default defineEventHandler(event=>citizenTx(event,async client=>{
 const id=String(getRouterParam(event,'id')||'')
 if(!(await client.query('SELECT 1 FROM applications WHERE id=$1',[id])).rowCount)
  throw createError({statusCode:404,statusMessage:'Không tìm thấy hồ sơ'})
 const latest=(await client.query(`SELECT max(id) AS id FROM application_events WHERE application_id=$1 AND event_type='supplement'`,[id])).rows[0]?.id
 const items=latest?(await client.query(`SELECT id,kind,target_key,instruction,reason,citizen_response,document_id,responded_at,created_at
 FROM citizen_supplement_items WHERE application_id=$1 AND request_event_id=$2 ORDER BY created_at,id`,[id,latest])).rows:[]
 return {items,structured:items.length>0}
}))
