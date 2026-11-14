// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawnSync} from 'node:child_process'

const root=resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read=file=>readFileSync(resolve(root,file),'utf8')
function execute(script) {
  const res=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','-e',script],{encoding:'utf8',timeout:12000})
  assert.equal(res.status,0,res.stderr || res.stdout)
}
const moduleUrl=new URL('../shared/ai-knowledge.ts',import.meta.url).href
const sample=`
const catalog=[
 {id:'khai-sinh',title:'Đăng ký khai sinh',category:'Hộ tịch',summary:'Đăng ký khai sinh cho trẻ em.',instructions:'Kê khai thông tin trẻ.',fee_note:'Miễn lệ phí (mẫu)',sla_days:3,documents:[{document_code:'giay-chung-sinh',document_name:'Giấy chứng sinh',is_required:true}]},
 {id:'chung-thuc',title:'Chứng thực bản sao',category:'Chứng thực',summary:'Chứng thực bản sao từ bản chính.',instructions:'Chuẩn bị bản chính.',fee_note:'Theo quy định hiện hành',sla_days:1,documents:[{document_code:'ban-chinh',document_name:'Bản chính cần đối chiếu',is_required:true}]}
];`
test('RAG retrieves published procedures directly on every request, no private tables or caches',()=>{
 const sql=read('server/utils/procedure-knowledge.ts')
 assert.match(sql,/FROM procedures p LEFT JOIN procedure_documents d/)
 assert.match(sql,/p\.published = true/)
 assert.doesNotMatch(sql,/FROM applications|FROM citizens|citizen_support_messages/)
 assert.match(sql,/createHash/)
 assert.doesNotMatch(sql,/setInterval|cache|redis|pgvector/i)
 const api=read('server/api/chat/index.post.ts')
 assert.match(api,/loadPublishedKnowledge\(\)/)
 assert.match(api,/Cache-Control.*no-store/)
 assert.match(api,/getRequestIP/)
 assert.match(api,/contextId.*catalog\.some/)
})
test('Answers are direct evidence with internal links; unknown values not hallucinated',()=>{
 execute(`import assert from 'node:assert/strict'; import {buildGroundedAnswer as a} from ${JSON.stringify(moduleUrl)}; ${sample}
  const docs=a('Đăng ký khai sinh cần giấy tờ gì?',catalog);
  assert.equal(docs.mode,'DATA');assert.match(docs.answer,/Giấy chứng sinh/);
  assert.equal(docs.sources[0].url,'/thu-tuc/khai-sinh');
  assert.ok(docs.sources[0].excerpt.includes('Giấy chứng sinh'));
  const fees=a('Lệ phí chứng thực bản sao bao nhiêu?',catalog);
  assert.match(fees.answer,/chưa có mức tiền cụ thể/);
  const authority=a('Cơ quan tiếp nhận đăng ký khai sinh ở đâu?',catalog);
  assert.match(authority.answer,/chưa ghi rõ/);
  assert.doesNotMatch(authority.answer,/UBND xã Tân Lập/);
  `)
})
test('Unsupported or out-of-scope questions return insufficient evidence',()=>{
 execute(`import assert from 'node:assert/strict'; import {buildGroundedAnswer as a} from ${JSON.stringify(moduleUrl)}; ${sample}
  for(const question of ['Thời tiết hôm nay thế nào?', 'Mua vé máy bay ở đâu?']) {
    const res=a(question,catalog,{contextId: question.includes('Thời')?'khai-sinh':''});
    assert.equal(res.mode,'INSUFFICIENT');assert.deepEqual(res.sources,[]);
  }
  const empty=a('Đăng ký khai sinh cần giấy tờ gì?',[]);
  assert.equal(empty.mode,'INSUFFICIENT');assert.equal(empty.sources.length,0);
  `)
})
test('Change to catalog data is reflected immediately, no index to rebuild',()=>{
 execute(`import assert from 'node:assert/strict'; import {buildGroundedAnswer as a} from ${JSON.stringify(moduleUrl)}; ${sample}
  const q='Lệ phí đăng ký khai sinh là bao nhiêu?';
  const before=a(q,catalog);assert.match(before.answer,/Miễn lệ phí/);
  const updated=catalog.map(p=>p.id==='khai-sinh'?{...p,fee_note:'Đã cập nhật tại cơ quan tiếp nhận'}:p);
  const after=a(q,updated);assert.match(after.answer,/Đã cập nhật/);
  assert.doesNotMatch(after.answer,/Miễn lệ phí/);
  const catalogAnswer=a('Hệ thống có những thủ tục nào?',catalog);
  assert.equal(catalogAnswer.sources.length,2);
  `)
})
test('External model chooses only valid IDs and fields, cannot inject arbitrary facts into answer',()=>{
 const classifier=read('server/utils/ai-classifier.ts')
 assert.match(classifier,/choices\.some\(hit => hit\.procedure\.id === selected\)/)
 assert.match(classifier,/ANSWER_FIELDS\.includes/)
 assert.match(classifier,/containsPersonalIdentifiers/)
 assert.doesNotMatch(classifier,/return \{answer:.*value\.answer/)
 const know=read('shared/ai-knowledge.ts')
 assert.match(know,/renderFacts\(p,/)
 assert.doesNotMatch(know,/javascript:/)
})
test('Accessible contextual UI and procedure update invalidation',()=>{
 const page=read('pages/tro-ly.vue')
 for(const marker of ['role="log"','aria-live="polite"','ai-procedure','shiftKey','copyAnswer','role="alert"','sugge'])assert.ok(page.includes(marker),marker)
 assert.match(read('pages/thu-tuc/[slug].vue'),/\/tro-ly\?procedure=/)
 assert.match(read('pages/index.vue'),/to="\/tro-ly"/)
 assert.match(read('layouts/default.vue'),/Trợ lý AI/)
 assert.match(read('plugins/live-updates.client.ts'),/knowledgeRevision\.value \+= 1/)
})

test('Portal usage questions use local FAQ only, not administrative facts',()=>{
 execute(`import assert from 'node:assert/strict'; import {buildGroundedAnswer as a} from ${JSON.stringify(moduleUrl)}; ${sample}
  const faq=[{id:1,question:'Làm sao nộp hồ sơ trực tuyến?',keywords:'nộp hồ sơ trực tuyến bắt đầu',answer:'Vào Danh mục thủ tục và chọn thủ tục phù hợp.'}];
  const answer=a('Làm sao nộp hồ sơ trực tuyến?',catalog,{faq});
  assert.equal(answer.mode,'DATA');assert.equal(answer.sources[0].url,'/huong-dan');
  assert.match(answer.answer,/Danh mục thủ tục/);
  const unknown=a('Tôi muốn thuê luật sư tranh chấp dân sự',catalog,{faq});
  assert.equal(unknown.mode,'INSUFFICIENT');
  `)
})
