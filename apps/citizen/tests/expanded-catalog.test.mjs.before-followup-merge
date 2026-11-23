// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
const read=(path)=>readFileSync(new URL(path,import.meta.url),'utf8')
const sql=read('../../../core/db/init/19-citizen-expanded-catalog.sql')
const compose=read('../../../docker-compose.yml')
const list=read('../pages/thu-tuc/index.vue')
const card=read('../components/ProcedureCard.vue')
const detail=read('../pages/thu-tuc/[slug].vue')
const submit=read('../server/api/applications/[id]/submit.post.ts')
const recommended=read('../server/api/procedures/recommended.get.ts')

test('36 additional demo procedures use distinct IDs and preserve existing rows',()=>{
  const insert=sql.split('INSERT INTO procedures (id,title,category,summary,icon,sla_days,fee_note,instructions) VALUES')[1].split('ON CONFLICT (id) DO NOTHING;')[0]
  const ids=[...insert.matchAll(/^ \('([^']+)'/gm)].map(x=>x[1])
  assert.equal(ids.length,36)
  assert.equal(new Set(ids).size,36)
  assert.match(sql,/0, 'Chưa xác minh'/)
  assert.match(sql,/ON CONFLICT \(id\) DO NOTHING/)
  assert.match(sql,/ON CONFLICT \(procedure_id,document_code\) DO NOTHING/)
})
test('setup loads demo catalogue after version and tenant gates, creates provenance',()=>{
  assert.ok(compose.indexOf('/setup/init/13-thu-tuc-theo-xa.sql') < compose.indexOf('/setup/init/19-citizen-expanded-catalog.sql'))
  assert.ok(compose.indexOf('/setup/init/18-citizen-life-journeys.sql') < compose.indexOf('/setup/init/19-citizen-expanded-catalog.sql'))
  assert.match(sql,/INSERT INTO citizen_procedure_versions/)
  assert.match(sql,/'unverified_demo'/)
  assert.match(sql,/WHERE NOT EXISTS \(/)
  assert.match(sql,/t\.code IN \('xa-a','xa-b'\)/)
})
test('citizen UI paginates results and preserves filtering/search',()=>{
  assert.match(list,/const pageSize=ref\(12\)/)
  assert.match(list,/const paginated=computed/)
  assert.match(list,/v-for="p in paginated"/)
  assert.match(list,/Phân trang danh mục thủ tục/)
  assert.match(list,/const isFiltering=/)
  assert.match(list,/normalizeSearch/)
})
test('unknown SLA is never presented as 0 days or manufactured as due date',()=>{
  assert.match(card,/sla_days>0/)
  assert.match(detail,/sla_days>0/)
  assert.match(submit,/CASE WHEN sla_days > 0 THEN CURRENT_DATE \+ sla_days ELSE NULL END/)
})

test('recommendations exclude procedures not enabled for current tenant',()=>{
  assert.match(recommended,/procedure_enabled_for\(\$1::uuid,p\.id\)/)
  assert.match(recommended,/actor\?\.tenantId/)
})
