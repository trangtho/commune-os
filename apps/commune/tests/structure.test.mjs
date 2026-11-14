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
test('Required admin pages exist',()=>{
 for(const page of ['index.vue','dang-nhap.vue','ho-so/index.vue','ho-so/[id].vue','ho-so/[id]/bo-sung.vue','ho-so/[id]/ket-qua.vue','thu-tuc/index.vue','thu-tuc/[slug].vue','thong-bao/index.vue','bao-cao/index.vue','tai-khoan/index.vue'])
  assert.ok(existsSync(resolve(dir,'pages',page)),page)
})
test('Staff session and role checks enforced',()=>{
 const session=get('apps/commune/server/utils/session.ts')
 assert.match(session,/requireStaff/)
 assert.match(session,/communeos_staff_demo/)
 const middleware=get('apps/commune/middleware/staff.global.ts')
 assert.match(middleware,/officer|admin/)
})
test('Tailwind + Nuxt configured',()=>{
 const pkg=JSON.parse(get('apps/commune/package.json'))
 assert.ok(pkg.dependencies.nuxt)
 assert.ok(pkg.devDependencies['@nuxtjs/tailwindcss'])
 assert.ok(existsSync(resolve(dir,'assets/css/main.css')))
})
test('Admin API routes exist',()=>{
 for(const route of ['server/api/auth/login.post.ts','server/api/auth/logout.post.ts','server/api/auth/me.get.ts','server/api/applications/index.get.ts','server/api/applications/[id].get.ts','server/api/applications/[id]/status.patch.ts','server/api/applications/[id]/supplement.post.ts','server/api/procedures/index.get.ts','server/api/notifications/index.get.ts','server/api/staff/index.get.ts','server/api/staff/index.post.ts'])
  assert.ok(existsSync(resolve(dir,route)),route)
})
test('No hardcoded secrets in source',()=>{
 const files=['server/utils/session.ts','server/api/auth/login.post.ts']
 for(const f of files){
  const c=get('apps/commune/'+f)
  assert.ok(!c.includes('SECRET=')||c.includes('process.env'),f)
 }
})
