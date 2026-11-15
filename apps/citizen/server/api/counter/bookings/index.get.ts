// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenTx } from '../../../utils/database'
export default defineEventHandler(event=>citizenTx(event,async client=>({items:(await client.query(`SELECT b.id,b.procedure_id,p.title AS procedure_title,b.ticket_number,b.status,b.created_at,
 s.starts_at,s.ends_at,s.serving_ticket_no,t.name AS locality_name
 FROM citizen_counter_bookings b JOIN citizen_counter_slots s ON s.id=b.slot_id
 JOIN procedures p ON p.id=b.procedure_id JOIN tenants t ON t.id=s.tenant_id
 ORDER BY s.starts_at DESC,b.created_at DESC LIMIT 100`)).rows})))
