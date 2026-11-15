// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenTx } from '../../utils/database'
export default defineEventHandler(event=>{
 setHeader(event,'Cache-Control','private, no-store')
 return citizenTx(event,async client=>{
  const {rows}=await client.query(`SELECT b.id,b.title,b.purpose,b.workflow_mode,b.created_at,b.updated_at,
   count(i.procedure_id)::int AS procedure_count,
   count(i.application_id)::int AS created_count,
   count(i.application_id) FILTER(WHERE a.status<>'draft')::int AS submitted_count,
   count(i.application_id) FILTER(WHERE a.status='completed')::int AS completed_count
   FROM citizen_service_batches b JOIN citizen_service_batch_items i ON i.batch_id=b.id
   LEFT JOIN applications a ON a.id=i.application_id
   GROUP BY b.id ORDER BY b.created_at DESC LIMIT 50`)
  return {items:rows}
 })
})
