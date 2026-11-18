// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {matchSituation,compareObservedFields,nextCaseActions} from '../shared/citizen-intelligence.mjs'
const read=rel=>readFileSync(new URL(rel,import.meta.url),'utf8')

test('Preserves commune-specific procedure availability while pinning drafts to legal version',()=>{
 const draft=read('../server/api/applications/index.post.ts')
 assert.match(draft,/procedure_enabled_for\(/)
 assert.match(draft,/latestProcedureVersion\(/)
 assert.match(draft,/acknowledged_procedure_version_id/)
 assert.match(read('../pages/thu-tuc/[slug].vue'),/available_in_my_commune/)
 const docker=read('../../../docker-compose.yml')
 const chain=['13-thu-tuc-theo-xa.sql','15-citizen-vault-autofill.sql','16-citizen-procedure-privacy.sql','17-citizen-intelligent-services.sql']
 let last=-1
 for(const filename of chain){ const pos=docker.indexOf(filename);assert(pos>last,`DB migration must include ${filename} in order`);last=pos }
})

test('Docker provides signed result provider config at runtime, without enabling it by default',()=>{
 const compose=read('../../../docker-compose.yml')
 const env=read('../../../.env.example')
 for(const key of ['CITIZEN_RESULTS_ENDPOINT','CITIZEN_RESULTS_TOKEN','NUXT_RESULT_ENDPOINT','NUXT_RESULT_TOKEN'])assert(compose.includes(key))
 assert.match(env,/^CITIZEN_RESULTS_ENDPOINT=\s*$/m)
 assert.match(env,/^CITIZEN_RESULTS_TOKEN=\s*$/m)
 assert.match(read('../server/utils/qr-proof.ts'),/publicOrigin\(/)
 assert.match(read('../server/api/applications/[id]/verification.post.ts'),/verifiedProviderPdf\(id\)/)
})

test('Situation assistant recommends only matching published catalog entries',()=>{
 const matches=matchSituation('Tôi vừa sinh con, cần làm thủ tục gì?',[
  {id:'khai-sinh',title:'Đăng ký khai sinh',summary:'Khai sinh cho em bé',category:'Hộ tịch'},
  {id:'dat-dai',title:'Cấp quyền sử dụng đất',summary:'Đất đai',category:'Đất đai'}])
 assert.deepEqual(matches.items.map(x=>x.id),['khai-sinh'])
 assert.equal(matchSituation('Tôi vừa sinh con',[]).items.length,0)
})

test('AI assistance is suggestions only: cross-document discrepancies are flagged, not rejected',()=>{
 const findings=compareObservedFields({fullName:'Nguyễn Văn A'},[
  {source:'Giấy tờ 1',fields:{fullName:'Nguyễn Văn A'}},
  {source:'Giấy tờ 2',fields:{fullName:'Nguyễn Văn B'}}])
 assert(findings.some(x=>x.kind==='between_documents'))
 assert(!findings.some(x=>x.kind==='invalid_document'))
 assert(nextCaseActions('supplement','HS-01').some(x=>x.url.includes('bo-sung')))
})
