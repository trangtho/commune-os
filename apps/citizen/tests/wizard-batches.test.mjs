// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { matchGuidance } from '../shared/procedure-wizard.mjs'
const read=file=>readFileSync(new URL(file,import.meta.url),'utf8')
const core=read('../../../core/db/init/21-citizen-api-core-flow.sql')
const migration=read('../../../core/db/init/11-citizen-guidance-batches.sql')
const draft=read('../server/api/applications/index.post.ts')
const createBatch=read('../server/api/service-batches/index.post.ts')
const matchApi=read('../server/api/procedures/match.post.ts')
test('Wizard only matches published procedures with explicit curated intent and never asserts unverified eligibility',()=>{
 const procedures=[{id:'khai-sinh',title:'Khai sinh',summary:'',category:'Hộ tịch',published:true},
 {id:'unpublished',title:'Không công bố',summary:'',category:'Khác',published:false}]
 const rules=[{procedure_id:'khai-sinh',purpose:'birth',audiences:['child'],situations:['first'],
   explanation:'Giới thiệu',distinction:'Phân biệt',source_reference:'',verified_at:null,enabled:true},
  {procedure_id:'unpublished',purpose:'birth',audiences:['child'],situations:['first'],
   explanation:'Ẩn',distinction:'Ẩn',source_reference:'',verified_at:'2026-11-14',enabled:true}]
 const result=matchGuidance(procedures,rules,{purpose:'birth',audience:'child',locality:'other',situation:'first'})
 assert.equal(result.length,1)
 assert.equal(result[0].id,'khai-sinh')
 assert.equal(result[0].verified,false)
 assert.match(result[0].notice,/chưa có quy tắc nghiệp vụ được xác minh/)
 assert.equal(matchGuidance(procedures,rules,{purpose:'marriage',audience:'child',situation:'first'}).length,0)
 assert.equal(matchGuidance(procedures,rules,{purpose:'unsure',audience:'child',situation:'first'}).length,0)
})
test('Guidance rules cannot be approved without source; app role is read-only',()=>{
 assert.match(migration,/CHECK \(\(verified_at IS NULL\) OR \(length\(trim\(source_reference\)\) > 0\)\)/)
 assert.match(migration,/ON CONFLICT \(id\) DO NOTHING/)
 assert.match(migration,/GRANT SELECT ON citizen_procedure_guidance_rules/)
 assert.doesNotMatch(migration,/GRANT (?:INSERT|UPDATE|DELETE) ON citizen_procedure_guidance_rules TO communeos_app/)
 assert.match(matchApi,/publicQuery/)
 assert.match(matchApi,/\.strict\(\)/)
 assert.match(matchApi,/WHERE r.enabled AND p.published/)
})
test('Guidance demo seed skips missing procedures on fresh init and can populate after seed',()=>{
 const demoIds=[...migration.matchAll(/\('demo-[a-z]+','([^']+)'/g)].map(match=>match[1])
 const seed=read('../../../core/db/seed/seed.sql')
 assert.equal(demoIds.length,6)
 for(const id of demoIds) assert.ok(seed.includes(`('${id}'`),`Missing seeded procedure: ${id}`)
 assert.match(migration,/FROM \(VALUES[\s\S]*?\) AS rule\(id,procedure_id,purpose,audiences,situations,explanation,distinction\)/)
 assert.match(migration,/WHERE EXISTS \(SELECT 1 FROM procedures p WHERE p.id = rule.procedure_id\)/)
 assert.match(migration,/ON CONFLICT \(id\) DO NOTHING/)
})
test('Batch preparation is private, consented, owner-scoped and never self-submits',()=>{
 assert.match(migration,/ALTER TABLE citizen_service_batches FORCE ROW LEVEL SECURITY/)
 assert.match(migration,/ALTER TABLE citizen_service_batch_items FORCE ROW LEVEL SECURITY/)
 assert.match(migration,/app.citizen_id/)
 assert.match(migration,/app.tenant_id/)
 assert.match(migration,/CHECK\(workflow_mode='preparation'\)/)
 assert.match(createBatch,/shareConsent/)
 assert.match(createBatch,/new Set\(input.procedureIds\)/)
 assert.match(createBatch,/citizenRpc\(event,'citizen_service_batch_create'/)
 const batchApi=read('../../../core/db/init/29-citizen-api-representation.sql')
 assert.match(batchApi,/WHERE id = ANY \(p_procedure_ids\) AND published = true/)
 assert.match(draft,/p_batch_id/)
 assert.match(core,/b\.citizen_id = a\.citizen_id AND b\.tenant_id = a\.tenant_id/)
 assert.match(core,/i\.procedure_id = p_procedure_id AND i\.application_id IS NULL/)
 assert.match(core,/citizen_fail\(409, 'Nhóm thủ tục không hợp lệ/)
 assert.match(read('../pages/lien-thong.vue'),/không phải quy trình liên thông chính thức/)
 assert.match(read('../pages/lien-thong/[id].vue'),/bundle=\$\{encodeURIComponent\(id\)\}/)
 assert.match(read('../pages/nop-ho-so/[slug].vue'),/batchId/)
 assert.match(read('../../../docker-compose.yml'),/11-citizen-guidance-batches\.sql/)
})
test('Both pages retain main navigation and public catalog access',()=>{
 const layout=read('../layouts/default.vue')
 assert.match(layout,/goi-y-thu-tuc/)
 assert.match(layout,/lien-thong/)
 assert.match(read('../pages/thu-tuc/index.vue'),/goi-y-thu-tuc/)
 assert.match(read('../pages/index.vue'),/lien-thong/)
 assert.match(read('../pages/goi-y-thu-tuc.vue'),/sr-only/)
})
