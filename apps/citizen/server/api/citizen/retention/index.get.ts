// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {citizenTx} from '../../../utils/database'
export default defineEventHandler(event=>citizenTx(event,async client=>{
 const policies=(await client.query('SELECT id,resource_kind,title,description,retention_days,legal_reference,approved,automatic_action FROM citizen_retention_policies ORDER BY id')).rows
 const reviews=(await client.query(`SELECT r.id,r.policy_id,p.title,r.resource_kind,r.resource_reference,
 r.state,r.found_at,r.decided_at,r.decision_note FROM citizen_retention_reviews r
 JOIN citizen_retention_policies p ON p.id=r.policy_id ORDER BY r.found_at DESC LIMIT 100`)).rows
 const requests=(await client.query(`SELECT id,request_type,details,state,created_at,processed_at,resolution_note
 FROM citizen_data_rights_requests ORDER BY created_at DESC LIMIT 50`)).rows
 setHeader(event,'Cache-Control','private, no-store')
 return {policies,reviews,requests}
}))
