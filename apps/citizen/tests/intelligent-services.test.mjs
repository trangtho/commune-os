// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {matchSituation,nextCaseActions,groupQuestionTopic,compareObservedFields,getForecast,
 normalizePhrase,guideFormField} from '../shared/citizen-intelligence.mjs'
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8')
test('Situation search maps everyday Vietnamese to published procedures but not invented ones',()=>{
 const catalog=[
  {id:'khai-sinh',title:'Đăng ký khai sinh',summary:'Lập giấy khai sinh',category:'Hộ tịch'},
  {id:'dat-dai',title:'Thủ tục đất đai',summary:'Thửa đất',category:'Đất đai'}]
 const result=matchSituation('Tôi vừa sinh con, cần làm gì?',catalog)
 assert.equal(result.items[0].id,'khai-sinh')
 assert.match(result.notice,/demo/)
 assert.deepEqual(matchSituation('abcdef',[]).items,[])
 assert.equal(normalizePhrase('Giấy tờ của ĐẢO'), 'giay to cua dao')
})
test('Actions are linked to real state, not speculative workflow decisions',()=>{
 assert.match(nextCaseActions('draft','HS-01')[0].url,/ho-so/)
 assert.match(nextCaseActions('supplement','HS-01')[0].url,/bo-sung/)
 assert.match(nextCaseActions('completed','HS-01')[0].url,/ket-qua/)
 assert.equal(nextCaseActions('unknown','HS-01').length,1)
})
test('Unanswered questions record only bounded topic labels, never raw text',()=>{
 for(const q of ['Số định danh 012345678901','Số điện thoại anh A','Các giấy tờ cần nộp?', 'Hồ sơ bao lâu?']){
  const tag=groupQuestionTopic(q)
  assert(['documents','fees','duration','identity','routing','eligibility','other'].includes(tag))
  assert(!tag.includes('012345678901'))
 }
})
test('Cross-document comparison reports possible conflicts; does not reject validity',()=>{
 const mismatches=compareObservedFields({birthDate:'2020-01-01'},[
  {source:'Tài liệu 1',fields:{birthDate:'2020-01-01'}},
  {source:'Tài liệu 2',fields:{birthDate:'2021-01-01'}}])
 assert(mismatches.some(x=>x.kind==='between_documents'))
 assert(!mismatches.some(x=>x.kind==='against_form'))
 assert.equal(compareObservedFields({a:'NGUYỄN VĂN A'},[{fields:{a:'Nguyễn Văn A'}}]).length,0)
})
test('Historical forecast refuses tiny samples and gives transparent percentile interval',()=>{
 assert.equal(getForecast([1,2,3]).available,false)
 const forecast=getForecast([1,2,3,4,5,6,7,8,9,10])
 assert.equal(forecast.available,true)
 assert(forecast.lowerDays<=forecast.upperDays)
 assert.equal(forecast.sampleSize,10)
})
test('Field guidance stays non-automating and identifies legal provenance',()=>{
 const row=guideFormField({key:'birthDate',label:'Ngày sinh',type:'date',required:true},{source_url:'https://vbpl.vn'})
 assert.equal(row.source,'https://vbpl.vn')
 assert.equal(row.required,true)
 assert.match(row.notice,/không/)
})
test('QR result verification is issued only after external PDF verification and consent',()=>{
 const source=read('../server/api/applications/[id]/verification.post.ts')
 const qr=read('../server/utils/qr-proof.ts')
 assert.match(source,/confirmed!==true/)
 assert.match(source,/verifiedProviderPdf\(id\)/)
 assert.match(qr,/randomBytes\(32\)/)
 assert.match(qr,/sha256/)
 assert.match(qr,/detail\.verification!=='verified'/)
 assert.match(qr,/CITIZEN_PUBLIC_ORIGIN/)
 const check=read('../server/api/result-verifications/[token].get.ts')
 assert.match(check,/same\?'matched':'changed'/)
 assert.match(check,/status:'unavailable'/)
})
test('OCR requires user agreement and trusted endpoint; client never auto-fills',()=>{
 const source=read('../server/api/ai/document-review.post.ts')
 assert.match(source,/if\(!confirmed\)/)
 assert.match(source,/isInternalEndpoint\(url\)/)
 assert.match(read('../server/utils/internal-endpoint.ts'),/a === 192 && b === 168/)
 assert.match(source,/redirect:'error'/)
 const ui=read('../components/CitizenDocumentReview.vue')
 assert.match(ui,/ocrConsent/)
 assert.match(ui,/Xác nhận dữ liệu đối chiếu/)
 const form=read('../components/DocUploader.vue')
 assert.match(form,/CitizenDocumentReview/)
})
test('SQL uses RLS, staff authorization and non-destructive migration',()=>{
 const sql=read('../../../core/db/init/17-citizen-intelligent-services.sql')
 for(const name of ['citizen_result_verifications','citizen_sync_requests','citizen_document_observations']){
  assert.match(sql,new RegExp(`ALTER TABLE ${name} FORCE ROW LEVEL SECURITY`))
 }
 assert.match(sql,/SECURITY DEFINER/)
 assert.match(sql,/HAVING count\(\*\)>=5/)
 assert.match(sql,/total>=10/)
 assert.doesNotMatch(sql,/DROP TABLE|TRUNCATE|DELETE FROM applications/i)
 assert.match(read('../../../docker-compose.yml'),/17-citizen-intelligent-services\.sql/)
})
test('Private-case advice requires session-scoped SQL; staff analytics restricted',()=>{
 // Dữ liệu hồ sơ cá nhân chỉ lấy qua API của lõi bằng token công dân (RLS theo công dân), có ghi nhật ký sử dụng.
 assert.match(read('../server/api/applications/[id]/ask.post.ts'),/citizenRpc<Facts>\(event,'citizen_case_facts'/)
 assert.match(read('../server/api/applications/[id]/insights.get.ts'),/citizenRpc<Facts>\(event,'citizen_case_insight_facts'/)
 const caseApi=read('../../../core/db/init/28-citizen-api-case.sql')
 assert.match(caseApi,/citizen_record_access\('view_case', 'Trả lời câu hỏi về hồ sơ cá nhân'/)
 assert.match(caseApi,/citizen_record_access\('view_case', 'Gợi ý bước tiếp theo và cảnh báo hồ sơ'/)
 const staffApi=read('../../../core/db/init/26-citizen-staff-api.sql')
 assert.match(staffApi,/FUNCTION api\.citizen_unanswered_summary[\s\S]*?staff_tenant_id\(true\)/)
 assert.match(staffApi,/FUNCTION api\.citizen_sync_queue[\s\S]*?staff_tenant_id\(true\)/)
 assert.match(staffApi,/FUNCTION api\.decide_citizen_sync[\s\S]*?staff_tenant_id\(true\)/)
})
