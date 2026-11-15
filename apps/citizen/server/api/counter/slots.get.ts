// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenTx } from '../../utils/database'
export default defineEventHandler(event=>citizenTx(event,async client=>{
 const procedureId=String(getQuery(event).procedureId||'').trim().slice(0,100)
 const items=(await client.query(`SELECT s.id,s.procedure_id,p.title AS procedure_title,s.tenant_id,t.name AS locality_name,
 s.starts_at,s.ends_at,s.capacity,s.serving_ticket_no,
 citizen_counter_slot_remaining(s.id) AS remaining
 FROM citizen_counter_slots s JOIN procedures p ON p.id=s.procedure_id AND p.published
 JOIN tenants t ON t.id=s.tenant_id
 WHERE s.published AND s.starts_at>now()+interval '1 hour' AND s.starts_at<now()+interval '31 days'
 AND ($1='' OR s.procedure_id=$1) ORDER BY s.starts_at LIMIT 80`,[procedureId])).rows
 return {items:items.filter(x=>Number(x.remaining)>0),publishedOnly:true}
}))
