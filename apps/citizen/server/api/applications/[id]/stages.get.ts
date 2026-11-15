// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenTx } from '../../../utils/database'
export default defineEventHandler(event=>citizenTx(event,async client=>{
 const id=String(getRouterParam(event,'id')||'')
 if(!(await client.query('SELECT 1 FROM applications WHERE id=$1',[id])).rowCount)
  throw createError({statusCode:404,statusMessage:'Không tìm thấy hồ sơ'})
 const updates=(await client.query(`SELECT * FROM (SELECT id,stage_name,unit_name,stage_status,due_at,reason,staff_name,created_at
 FROM citizen_case_stage_updates WHERE application_id=$1 ORDER BY created_at DESC,id DESC LIMIT 200) recent
 ORDER BY created_at ASC,id ASC`,[id])).rows
 return {items:updates,officialStagesAvailable:updates.length>0}
}))
