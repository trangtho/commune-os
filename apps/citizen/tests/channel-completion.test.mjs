// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {resolve,dirname} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {spawnSync} from 'node:child_process'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const read=path=>readFileSync(resolve(root,path),'utf8')
test('Server-side owner-scoped document DELETE and no result forgery',()=>{
  const deletion=read('server/api/applications/[id]/documents/[documentId].delete.ts')
  assert.match(deletion,/citizenTx/)
  assert.match(deletion,/\['draft', 'supplement'\]/)
  assert.match(deletion,/DELETE FROM application_documents/)
  assert.match(read('server/api/documents/[id].get.ts'),/inline/)
  const result=read('server/api/applications/[id]/result.get.ts')
  assert.match(result,/requireCompleted/)
  assert.match(read('pages/ho-so/[id]/ket-qua.vue'),/không tự xác minh mật mã/)
})
test('OIDC verifies state+nonce, RSA signature and never trusts email as account ID',()=>{
  const source=read('server/utils/oidc.ts')
  for(const key of ['code_challenge','timingSafeEqual','verify(',"payload.nonce",'payload.iss','payload.aud','oidcLoginName'])assert.ok(source.includes(key),key)
  assert.match(read('server/api/auth/oidc/callback.get.ts'),/verifiedOidcSubject/)
  assert.match(read('server/api/auth/oidc/callback.get.ts'),/code_verifier/)
  assert.match(read('pages/dang-nhap.vue'),/methods\?\.oidc/)
})
test('RAG answer only uses published database evidence and signed results require backend',()=>{
  assert.match(read('server/api/chat/index.post.ts'),/loadPublishedKnowledge/)
  assert.match(read('server/api/chat/index.post.ts'),/buildGroundedAnswer/)
  assert.match(read('server/utils/ai-classifier.ts'),/selectedProcedureId/)
  assert.match(read('shared/ai-knowledge.ts'),/INSUFFICIENT/)
  assert.match(read('server/api/applications/[id]/result-file.get.ts'),/requireCompleted/)
  assert.match(read('server/api/applications/[id]/result-file.get.ts'),/application\/pdf/)
})
test('Search, profile validation, notice paging and locality routing are server-side',()=>{
  assert.match(read('pages/tra-cuu.vue'),/citizen-applications-lookup/)
  assert.match(read('server/api/applications/index.get.ts'),/applicant_name/)
  assert.match(read('server/api/notifications/index.get.ts'),/pageSize/)
  assert.match(read('server/api/profile/index.patch.ts'),/phoneIssue/)
  assert.match(read('server/api/applications/index.post.ts'),/receivingTenantId/)
})
test('Form metadata validates identity and numeric bounds',t=>{
  if(Number(process.versions.node.split('.')[0])<22)return t.skip('Node 22 required')
  const location=pathToFileURL(resolve(root,'shared/procedure-forms.ts')).href
  const check=`import {validateProcedureForm as v,getProcedureFormFields} from ${JSON.stringify(location)};
  import assert from 'node:assert/strict';
  assert.ok(getProcedureFormFields('khai-sinh').length>=9);
  assert.ok(v('ho-kinh-doanh',{businessCapital:'-1'}).length);
  assert.ok(v('xac-nhan-cu-tru',{subjectIdentifier:'123'}).some(e=>e.key==='subjectIdentifier'));
  assert.ok(v('khai-sinh',{birthDate:'2026-13-50'}).some(e=>e.key==='birthDate'));`
  const result=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','-e',check],{encoding:'utf8'})
  assert.equal(result.status,0,result.stderr)
})
