// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {citizenTx} from '../../../utils/database'
export default defineEventHandler(event=>citizenTx(event,async client=>{
 const items=(await client.query(`SELECT p.id,p.title,p.description,p.legal_basis,p.basis_explanation,
 p.categories,p.recipients,p.validity_days,e.decision,e.valid_until,e.decided_at,
 (e.decision='granted' AND e.valid_until>now()) AS active
 FROM citizen_processing_purposes p
 LEFT JOIN LATERAL (SELECT decision,valid_until,decided_at FROM citizen_consent_events
  WHERE purpose_id=p.id ORDER BY id DESC LIMIT 1) e ON true
 WHERE p.published ORDER BY p.id`)).rows
 const history=(await client.query(`SELECT e.id,e.purpose_id,p.title,e.decision,e.decided_at,e.valid_until
 FROM citizen_consent_events e JOIN citizen_processing_purposes p ON p.id=e.purpose_id
 ORDER BY e.id DESC LIMIT 50`)).rows
 setHeader(event,'Cache-Control','private, no-store')
 return {items,history}
}))
