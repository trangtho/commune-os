// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Static tests executable without npm install or PostgreSQL. NOT integration tests.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
const dir=resolve(import.meta.dirname,'..')
const root=resolve(dir,'../..')
const get=(file)=>readFileSync(resolve(root,file),'utf8')
test('Required pages exist',()=>{
 for(const page of ['index.vue','thu-tuc/index.vue','thu-tuc/[slug].vue','nop-ho-so/[slug].vue','ho-so/index.vue','ho-so/[id]/index.vue','ho-so/[id]/bo-sung.vue','ho-so/[id]/ket-qua.vue','thong-bao.vue','dang-nhap.vue','tro-ly.vue','huong-dan.vue','ho-so-ca-nhan.vue','bao-mat.vue','lien-he.vue'])
   assert.ok(existsSync(resolve(dir,'pages',page)),page)
})
test('Database has policies and required citizen entities',()=>{
 const sql=get('modules/xa/db/01-schema.sql')
 for(const name of ['citizens','procedures','applications','application_documents','application_events','citizen_notifications','citizen_feedback'])assert.match(sql,new RegExp(`CREATE TABLE IF NOT EXISTS ${name}`))
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/g)
 assert.match(sql,/FORCE ROW LEVEL SECURITY/g)
 assert.match(sql,/citizen_login_lookup/)
})
test('Poka-yoke is enforced by the API, not only the button',()=>{
 // Poka-yoke nằm trong lõi (api.citizen_application_submit): thiếu giấy tờ bắt buộc thì không nộp được.
 assert.match(get('apps/citizen/server/api/applications/[id]/submit.post.ts'),/citizen_application_submit/)
 const core=get('modules/xa/db/21-citizen-api-core-flow.sql')
 assert.match(core,/AND d\.is_required AND NOT EXISTS/)
 assert.match(core,/citizen_fail\(422, 'Thiếu giấy tờ: '/)
})
test('No real ID data in seed and files are validated',()=>{
 // Dữ liệu mẫu tách khỏi seed (make demo); seed chỉ còn danh mục, không có tài khoản hay hồ sơ.
 const demo=get('modules/xa/demo/demo-data.sql')
 assert.match(demo,/GIẢ LẬP/)
 assert.match(demo,/congdan\.demo/)
 assert.doesNotMatch(get('modules/xa/db/seed.sql'),/INSERT INTO (tenants|citizens|applications)\b/)
 const upload=get('apps/citizen/server/api/applications/[id]/documents.post.ts')
 assert.match(upload,/5242880|5\*1024\*1024/)
 assert.match(upload,/application\/pdf/)
 assert.match(upload,/image\/png/)
})
test('Tailwind + Nuxt configured',()=>{
 const pkg=JSON.parse(get('apps/citizen/package.json'))
 assert.ok(pkg.dependencies.nuxt)
 assert.ok(pkg.devDependencies['@nuxtjs/tailwindcss'])
 assert.ok(existsSync(resolve(dir,'assets/css/main.css')))
})

test('Old PostgreSQL volumes can be repaired without deleting stored data',()=>{
 const compose=get('docker-compose.yml')
 assert.match(compose,/db-setup:/)
 assert.match(compose,/service_completed_successfully/)
 assert.match(get('modules/xa/module.json'),/01-schema\.sql/)
 assert.match(get('modules/xa/module.json'),/seed\.sql/)
 const makefile=get('Makefile')
 assert.match(makefile,/repair-db:/)
 assert.match(makefile,/doctor:/)
 const role=get('core/db/init/00-create-app-role.sh')
 assert.match(role,/ALTER ROLE/)
 const seed=get('modules/xa/db/seed.sql')
 assert.match(seed,/Preserve existing catalog edits/)
 const health=get('apps/citizen/server/api/health.get.ts')
 assert.match(health,/CORE_UNAVAILABLE/)
 assert.match(health,/NO_PROCEDURES/)
 assert.match(health,/publishedProcedures/)
})
