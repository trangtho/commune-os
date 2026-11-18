// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import type {PoolClient} from 'pg'
type Actor={id:string;tenantId:string}
type Event={action:string;purpose:string;processingUnit?:string;resourceKind:string;resourceReference?:string;actorKind?:'citizen'|'system'|'authorized_unit'}
/** Do not include sensitive values in the audit metadata. Insert inside the same citizenTx. */
export async function recordPersonalDataUse(client:PoolClient,actor:Actor,item:Event){
 await client.query(`INSERT INTO citizen_data_access_events(citizen_id,tenant_id,action,purpose,
 processing_unit,resource_kind,resource_reference,actor_kind) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
 [actor.id,actor.tenantId,item.action,item.purpose,item.processingUnit||'Cổng công dân CommuneOS',
  item.resourceKind,item.resourceReference||'',item.actorKind||'citizen'])
}
export async function activeConsent(client:PoolClient,purposeId:string){
 const row=(await client.query(`SELECT decision,valid_until FROM citizen_consent_events
 WHERE purpose_id=$1 ORDER BY id DESC LIMIT 1`,[purposeId])).rows[0]
 return row?.decision==='granted'&&new Date(row.valid_until).getTime()>Date.now()
}
