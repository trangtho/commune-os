// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenTx } from '../../../../utils/database'
export default defineEventHandler(event=>citizenTx(event,async client=>{
  setHeader(event,'Cache-Control','private, no-store')
  const id=String(getRouterParam(event,'id')||'')
  if(!(await client.query('SELECT 1 FROM applications WHERE id=$1',[id])).rowCount)
    throw createError({statusCode:404,statusMessage:'Không tìm thấy hồ sơ'})
  const items=(await client.query(`SELECT id,request_kind,reason,proposed_tenant_id,status,staff_response,decided_by,created_at,decided_at
    FROM citizen_case_requests WHERE application_id=$1 ORDER BY created_at DESC LIMIT 100`,[id])).rows
  return {items}
}))
