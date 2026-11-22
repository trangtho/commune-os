// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
const read=file=>readFileSync(new URL(file,import.meta.url),'utf8')
const migration=read('../../../core/db/init/16-citizen-procedure-privacy.sql')
const readRoute=(path)=>read(`../server/api/${path}`)
test('Official-source URL validation avoids HTTPS lookalikes, HTTP and private hosts',()=>{
 const source=`import assert from 'node:assert/strict';
 import {isOfficialProcedureSource,changedSections} from './apps/citizen/shared/procedure-versions.ts';
 assert(isOfficialProcedureSource('https://vbpl.vn/example'));
 assert(isOfficialProcedureSource('https://dichvucong.gov.vn/test'));
 for(const url of ['http://gov.vn','https://gov.vn.example.com','https://evil-vbpl.vn',
 'https://localhost','https://127.0.0.1','https://attacker@vbpl.vn/x'])assert(!isOfficialProcedureSource(url));
 const a={title:'A',summary:'s',instructions:'c',feeNote:'0',slaDays:2,formRevision:'1',documents:[{documentCode:'a',documentName:'A',isRequired:true}]};
 const b={...a,feeNote:'10',slaDays:3,documents:[{...a.documents[0],isRequired:false}]};
 assert.deepEqual(changedSections(a,b),['documents','fees','deadline']);
 assert.deepEqual(changedSections(a,a),[]);`
 execFileSync(process.execPath,['--experimental-strip-types','--input-type=module','-e',source],{cwd:new URL('../../..',import.meta.url),stdio:'pipe'})
})
test('Migration preserves legacy demo source status, append-only audit and RLS',()=>{
 for(const table of ['citizen_consent_events','citizen_data_access_events','citizen_retention_reviews','citizen_data_rights_requests']){
  assert.match(migration,new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\(`))
  assert.match(migration,new RegExp(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`))
 }
 assert.match(migration,/provenance_status.*unverified_demo/s)
 assert.match(migration,/citizen_procedure_version_immutable/)
 assert.match(migration,/citizen_data_immutable/)
 assert.match(migration,/citizen_consent_immutable/)
 assert.match(migration,/citizen_data_event_digest/)
 assert.match(migration,/citizen_publish_procedure_version/)
 assert.match(migration,/citizen_staff_scan_retention/)
 assert.doesNotMatch(migration,/GRANT DELETE ON citizen_data_access_events/)
 assert.match(read('../../../docker-compose.yml'),/16-citizen-procedure-privacy\.sql/)
})
test('Staff publication is token-protected, validates official source and alerts drafts',()=>{
 const pub=readRoute('internal/procedures/publish.post.ts')
 assert.match(pub,/requireStaffBridge\(event\)/)
 assert.match(pub,/requireGovernanceToken\(event\)/)
 assert.match(pub,/isOfficialProcedureSource/)
 assert.match(pub,/confirmed:z\.literal\(true\)/)
 assert.match(migration,/citizen_procedure_change_notices/)
 assert.match(migration,/INSERT INTO citizen_notifications/)
 assert.match(migration,/AND a\.status='draft'/)
})
test('Creating a draft pins a snapshot, submission rejects unreviewed revision',()=>{
 assert.match(readRoute('applications/index.post.ts'),/acknowledged_procedure_version_id/)
 const submit=readRoute('applications/[id]/submit.post.ts')
 assert.match(submit,/lock_procedure_shared/)
 assert.match(submit,/acknowledged_procedure_version_id!==version\.id/)
 assert.match(submit,/submitted_procedure_version_id/)
 const ack=readRoute('applications/[id]/procedure-change/ack.post.ts')
 assert.match(ack,/reviewed:z\.literal\(true\)/)
 assert.match(ack,/currentId!==body\.currentVersionId/)
 assert.match(read('../components/DraftProcedureAlert.vue'),/Xác nhận đã rà soát/)
})
test('Consent is citizen-controlled, other bases cannot be toggled and vault reuse is gated',()=>{
 const consent=readRoute('citizen/consents/[purpose].post.ts')
 assert.match(consent,/legal_basis='consent'/)
 assert.match(consent,/pg_advisory_xact_lock/)
 assert.match(consent,/consent_withdrawn/)
 const vault=readRoute('applications/[id]/documents/from-vault.post.ts')
 assert.equal((vault.match(/activeConsent\(client,'vault_case_reuse'\)/g)||[]).length,2)
 assert.match(vault,/recordPersonalDataUse/)
 assert.match(read('../pages/quyen-chia-se.vue'),/Căn cứ pháp lý khác/)
})
test('Retention is staff-review first, access log does not expose sensitive values',()=>{
 const scan=readRoute('internal/privacy/retention/scan.post.ts')
 assert.match(scan,/requireStaffBridge\(event\)/)
 assert.match(migration,/ON CONFLICT DO NOTHING RETURNING citizen_id/)
 assert.match(migration,/citizen_staff_review_privacy_request/)
 assert.match(migration,/citizen_staff_review_retention/)
 assert.match(read('../server/plugins/retention-scheduler.ts'),/CITIZEN_RETENTION_SCAN_ENABLED/)
 assert.match(readRoute('citizen/data-access/index.get.ts'),/citizen_data_event_digest/)
 assert.match(readRoute('citizen/retention/requests/index.post.ts'),/citizenTx\(event/)
 assert.match(readRoute('citizen/vault/files/[id].get.ts'),/citizen_retention_reviews/)
})
