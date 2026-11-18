// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {citizenTx} from '../../../utils/database'
export default defineEventHandler(event=>citizenTx(event,async client=>{
 const entries=(await client.query(`SELECT id,seq_no,action,purpose,processing_unit,resource_kind,
 resource_reference,actor_kind,occurred_at,previous_hash,event_hash FROM citizen_data_access_events
 ORDER BY seq_no DESC LIMIT 200`)).rows
 // Verify the FULL chain, not only the displayed (last 200) events.
 const validation=(await client.query(`WITH history AS (
 SELECT seq_no,previous_hash,event_hash,COALESCE(lag(event_hash) OVER (ORDER BY seq_no),'') AS prior,
 citizen_id,tenant_id,action,purpose,processing_unit,resource_kind,resource_reference,actor_kind,occurred_at
 FROM citizen_data_access_events)
 SELECT count(*)::int AS events,
 count(*) FILTER (WHERE previous_hash<>prior OR
 event_hash<>citizen_data_event_digest(citizen_id,tenant_id,action,purpose,
 processing_unit,resource_kind,resource_reference,actor_kind,occurred_at,previous_hash))::int AS mismatches
 FROM history`)).rows[0]
 setHeader(event,'Cache-Control','private, no-store')
 return {items:entries,integrity:{checked:Number(validation?.events||0),ok:Number(validation?.mismatches||0)===0},
 coverage:'Chỉ các sự kiện đã tích hợp vào Cổng công dân; không phải mọi truy cập tại hệ thống bên ngoài.'}
}))
