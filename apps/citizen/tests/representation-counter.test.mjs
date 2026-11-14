// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read = path => readFileSync(new URL(path,import.meta.url),'utf8')
const sql=read('../../../core/db/init/05-citizen-representation-counter.sql')
const compose=read('../../../docker-compose.yml')
const create=read('../server/api/applications/index.post.ts')
const update=read('../server/api/applications/[id].patch.ts')
const submit=read('../server/api/applications/[id]/submit.post.ts')
const helper=read('../server/utils/representations.ts')
const counter=read('../pages/tai-quay.vue')
const counterAPI=read('../server/api/counter/sessions/index.post.ts')
const counterGet=read('../server/api/counter/sessions/current.get.ts')
const session=read('../server/utils/counter-sessions.ts')

test('Representation tables have owner-tenant RLS, append-only audit and separate verification authority',()=>{
  assert.match(sql,/CREATE TABLE IF NOT EXISTS citizen_representations/)
  assert.match(sql,/CREATE TABLE IF NOT EXISTS citizen_representation_audit/)
  assert.match(sql,/citizen_representations FORCE ROW LEVEL SECURITY/)
  assert.match(sql,/citizen_representation_audit FORCE ROW LEVEL SECURITY/)
  assert.match(sql,/app\.citizen_id/)
  assert.match(sql,/app\.tenant_id/)
  assert.match(sql,/WITH CHECK \(citizen_id/)
  assert.match(sql,/verified_by IS NOT NULL AND verified_at IS NOT NULL AND evidence_key IS NOT NULL/)
  assert.match(sql,/GRANT UPDATE \(evidence_key, evidence_name, evidence_type, updated_at\)/)
  assert.doesNotMatch(sql,/GRANT UPDATE \(status/)
  assert.match(sql,/citizen_revoke_own_representation/)
  assert.match(sql,/audit_representation_status/)
  assert.match(compose,/05-citizen-representation-counter\.sql/)
})

test('Application draft, edit and submit validate approved scoped authority with final recheck',()=>{
  for(const f of [create,update,submit]){
    assert.match(f,/requireApprovedRepresentation/)
    assert.match(f,/representation_id|representationId/)
  }
  assert.match(helper,/status='verified'/)
  assert.match(helper,/valid_until >= CURRENT_DATE/)
  assert.match(helper,/procedure_id=\$2/)
  assert.match(helper,/represented_name/)
  assert.match(submit,/application_submitted/)
  assert.match(create,/application_created/)
  assert.match(read('../pages/nop-ho-so/[slug].vue'),/Đại diện người thân/)
})

test('Citizen may only request, upload and revoke; evidence is owner-scoped and format checked',()=>{
  assert.match(read('../server/api/representations/index.post.ts'),/citizenTx\(event/)
  assert.match(read('../server/api/representations/index.post.ts'),/statusMessage/)
  assert.match(read('../server/api/representations/[id]/evidence.post.ts'),/status='pending'/)
  assert.match(read('../server/api/representations/[id]/evidence.post.ts'),/5\*1024\*1024/)
  assert.match(read('../server/api/representations/[id]/evidence.get.ts'),/citizenTx\(event/)
  assert.match(read('../server/api/representations/[id]/revoke.post.ts'),/citizen_revoke_own_representation/)
  assert.match(read('../pages/dai-dien.vue'),/Chờ xác minh/)
  assert.match(read('../pages/dai-dien.vue'),/Lịch sử/)
})

test('Guest counter sessions are short-lived, non-identifying and do not grant citizen authentication',()=>{
  assert.match(sql,/CREATE TABLE IF NOT EXISTS citizen_counter_sessions/)
  assert.doesNotMatch(sql,/citizen_counter_sessions\s*\([^;]*citizen_id/)
  assert.match(counterAPI,/randomBytes\(10\)/)
  assert.match(counterAPI,/interval '15 minutes'/)
  assert.match(counterAPI,/published=true/)
  assert.match(counterAPI,/setCounterCookie/)
  assert.match(counterGet,/expires_at>now\(\)/)
  assert.match(session,/httpOnly:true/)
  assert.match(counter,/không xác thực danh tính/)
  assert.match(counter,/Đăng nhập để tiếp tục/)
  assert.match(counter,/api\/procedures\/\$\{encodeURIComponent\(selected.value\)\}/)
  assert.doesNotMatch(counter,/\/api\/applications/)
  assert.match(read('../middleware/citizen.global.ts'),/\/tai-quay/)
  assert.match(read('../server/api/counter/sessions/[code].get.ts'),/không chứng minh danh tính/)
})
