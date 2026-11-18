// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test'
import assert from 'node:assert/strict'
import {buildLifeJourney,compareChannels,detectLifeEvent,clarificationQuestions,followupTasks,explainCaseStatus} from '../shared/life-journey.mjs'
const catalog=[{id:'khai-sinh',title:'Đăng ký khai sinh',category:'Hộ tịch',summary:'Thủ tục khai sinh',fee_note:'Theo quy định',documents:[{document_code:'01',document_name:'Tờ khai',is_required:true}]}]
test('identifies life events with accented citizen expressions',()=>{
 assert.equal(detectLifeEvent('Tôi vừa sinh con'),'birth')
 assert.equal(detectLifeEvent('Tôi chuyển đến nhà mới'),'residence')
 assert.equal(detectLifeEvent('không liên quan'),'other')
})
test('journey matches ONLY published catalog without inventing extra steps/dependencies',()=>{
 const result=buildLifeJourney('Tôi vừa sinh con',catalog)
 assert.deepEqual(result.items.map(x=>x.id),['khai-sinh'])
 assert.equal(result.items[0].dependency,'unverified')
 assert.equal(result.items[0].canParallel,null)
 assert.equal(result.items[0].legalSourceVerified,false)
 assert.equal(buildLifeJourney('Một sự kiện lạ',catalog).items.length,0)
})
test('everyday residence situation resolves only available residence catalog rows',()=>{
 const r=buildLifeJourney('Tôi chuyển đến nơi ở mới',[{id:'xac-nhan-cu-tru',title:'Xác nhận thông tin cư trú',summary:'Cư trú',category:'Cư trú'}])
 assert.deepEqual(r.items.map(x=>x.id),['xac-nhan-cu-tru'])
})
test('clarifies optional conditions without assuming anything',()=>{
 assert.equal(clarificationQuestions({}).length,3)
 assert.equal(clarificationQuestions({locality:'Nơi cư trú',representation:'Bản thân',channel:'Trực tuyến'}).length,0)
})
test('channel comparison never invents visit counts or legal eligibility',()=>{
 const a=compareChannels(catalog[0],{online:true,counter:false})
 assert.equal(a.ways.length,1);assert.equal(a.ways[0].visits,null)
})
test('follow-up actions come from stored case state and use case-specific links',()=>{
 const tasks=followupTasks([{id:'HS-123',status:'supplement',procedure_id:'khai-sinh',procedure_title:'Khai sinh'}])
 assert.match(tasks[0].url,/HS-123/)
})
test('status explanation reports no invented reason',()=>{
 const x=explainCaseStatus('processing')
 assert.equal(x.reason,null);assert.equal(x.latestNote,null)
})
