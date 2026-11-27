// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
const read=file=>readFileSync(new URL(file,import.meta.url),'utf8')
const core=read('../../../modules/xa/db/21-citizen-api-core-flow.sql')
const personal=read('../../../modules/xa/db/32-citizen-api-personal.sql')
const personalFn=name=>personal.slice(personal.indexOf(`FUNCTION api.${name}(`)).split('END $$;')[0]
const migration=read('../../../modules/xa/db/16-citizen-procedure-privacy.sql')
const readRoute=(path)=>read(`../server/api/${path}`)
const staffApi=read('../../../modules/xa/db/26-citizen-staff-api.sql')
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
 assert.match(read('../../../modules/xa/module.json'),/16-citizen-procedure-privacy\.sql/)
})
test('Procedure publication is sys_admin only, validates official source and alerts drafts',()=>{
 assert.match(staffApi,/FUNCTION api\.publish_procedure_version[\s\S]*public\.require_sys_admin\(\)/)
 assert.match(staffApi,/v_host LIKE '%\.gov\.vn'/)
 assert.match(staffApi,/'confirmed' IS DISTINCT FROM 'true'::jsonb/)
 assert.match(staffApi,/Chưa hỗ trợ công bố trước thời điểm hiệu lực/)
 assert.match(migration,/citizen_procedure_change_notices/)
 assert.match(migration,/INSERT INTO citizen_notifications/)
 assert.match(migration,/AND a\.status='draft'/)
})
test('Creating a draft pins a snapshot, submission rejects unreviewed revision',()=>{
 assert.match(core,/procedure_version_id, acknowledged_procedure_version_id/)
 assert.match(core,/PERFORM public\.lock_procedure_shared\(r\.procedure_id\)/)
 assert.match(core,/acknowledged_procedure_version_id IS DISTINCT FROM v_version/)
 assert.match(core,/submitted_procedure_version_id = v_version/)
 const ack=readRoute('applications/[id]/procedure-change/ack.post.ts')
 assert.match(ack,/reviewed:z\.literal\(true\)/)
 assert.match(ack,/currentId!==body\.currentVersionId/)
 assert.match(read('../components/DraftProcedureAlert.vue'),/Xác nhận đã rà soát/)
})
test('Consent is citizen-controlled, other bases cannot be toggled and vault reuse is gated',()=>{
 assert.match(readRoute('citizen/consents/[purpose].post.ts'),/'citizen_consent_decide'/)
 const consent=personalFn('citizen_consent_decide')
 assert.match(consent,/legal_basis = 'consent'/)
 assert.match(consent,/pg_advisory_xact_lock/)
 assert.match(consent,/consent_withdrawn/)
 const vaultApi=read('../../../modules/xa/db/27-citizen-api-vault.sql')
 // Quyền tái sử dụng kiểm tra cả trước khi đọc tệp nguồn và trong giao dịch gắn vào hồ sơ (có khóa tư vấn).
 assert.equal((vaultApi.match(/public\.citizen_active_consent\('vault_case_reuse'\)/g)||[]).length,2)
 assert.match(vaultApi,/pg_advisory_xact_lock\(hashtext\(v_citizen::text \|\| ':vault_case_reuse'\)\)/)
 assert.match(vaultApi,/citizen_record_access\('share_vault_to_case'/)
 assert.match(read('../pages/quyen-chia-se.vue'),/Căn cứ pháp lý khác/)
})
test('Retention is staff-review first, access log does not expose sensitive values',()=>{
 assert.match(staffApi,/FUNCTION api\.scan_citizen_retention[\s\S]*public\.staff_tenant_id\(true\)/)
 assert.match(migration,/ON CONFLICT DO NOTHING RETURNING citizen_id/)
 assert.match(migration,/citizen_staff_review_privacy_request/)
 assert.match(migration,/citizen_staff_review_retention/)
 assert.ok(JSON.parse(read('../../../modules/xa/module.json')).jobs.some(j=>j.rpc==="system_scan_citizen_retention" && j.everyMinutes===1440 && j.enabledBy==="CITIZEN_RETENTION_SCAN_ENABLED"))
 assert.match(read('../../../modules/xa/db/34-citizen-direct-access.sql'),/FUNCTION api\.system_scan_citizen_retention[\s\S]*is_workflow_call\(\)/)
 assert.match(readRoute('citizen/data-access/index.get.ts'),/'citizen_data_access'/)
 assert.match(personalFn('citizen_data_access'),/citizen_data_event_digest/)
 assert.match(readRoute('citizen/retention/requests/index.post.ts'),/'citizen_privacy_request_create'/)
 assert.match(personalFn('citizen_privacy_request_create'),/citizen_record_access\('privacy_request_created'/)
 assert.match(readRoute('citizen/vault/files/[id].get.ts'),/citizen_retention_reviews/)
})
