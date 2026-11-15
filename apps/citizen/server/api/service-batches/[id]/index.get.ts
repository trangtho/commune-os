// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenTx } from '../../../utils/database'
export default defineEventHandler(event=>{
 setHeader(event,'Cache-Control','private, no-store')
 return citizenTx(event,async client=>{
  const id=getRouterParam(event,'id')
  if(!id || !/^[0-9a-f-]{36}$/i.test(id))throw createError({statusCode:404,statusMessage:'Không tìm thấy nhóm thủ tục'})
  const batch=(await client.query(`SELECT id,title,purpose,workflow_mode,shared_data,shared_consent,created_at,
    updated_at FROM citizen_service_batches WHERE id=$1`,[id])).rows[0]
  if(!batch)throw createError({statusCode:404,statusMessage:'Không tìm thấy nhóm thủ tục thuộc tài khoản'})
  const items=(await client.query(`SELECT i.procedure_id,p.title,p.category,p.summary,
    i.application_id,a.status,a.updated_at AS application_updated_at
    FROM citizen_service_batch_items i JOIN procedures p ON p.id=i.procedure_id
    LEFT JOIN applications a ON a.id=i.application_id WHERE i.batch_id=$1 ORDER BY i.position`,[id])).rows
  return {...batch,items}
 })
})
