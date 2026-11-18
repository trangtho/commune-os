// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {citizenTx} from '../../../utils/database'
export default defineEventHandler(event=>citizenTx(event,async client=>{
 setHeader(event,'Cache-Control','private, no-store')
 const {rows}=await client.query(`SELECT j.id,j.title,j.event_code,j.status,j.created_at,j.updated_at,
 count(i.id)::int AS step_count,count(i.id) FILTER (WHERE COALESCE(a.status,'')='completed' OR (i.application_id IS NULL AND i.state='done'))::int AS done_count
 FROM citizen_life_journeys j LEFT JOIN citizen_life_journey_items i ON i.journey_id=j.id
 LEFT JOIN applications a ON a.id=i.application_id
 GROUP BY j.id ORDER BY j.updated_at DESC LIMIT 50`)
 return {items:rows}
}))
