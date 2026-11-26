// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
const read=(path)=>readFileSync(new URL(path,import.meta.url),'utf8')
const sql=read('../../../modules/xa/demo/expanded-catalog.sql')
const compose=read('../../../modules/xa/module.json')
const makefile=read('../../../Makefile')
const demo=read('../../../modules/xa/demo/demo.mjs')
const list=read('../pages/thu-tuc/index.vue')
const card=read('../components/ProcedureCard.vue')
const detail=read('../pages/thu-tuc/[slug].vue')
const coreSubmit=read('../../../modules/xa/db/21-citizen-api-core-flow.sql')
const recommended=read('../server/api/procedures/recommended.get.ts')
const publicApi=read('../../../modules/xa/db/33-citizen-api-public.sql')
const identity=read('../server/utils/identity.ts')

test('36 additional demo procedures use distinct IDs and preserve existing rows',()=>{
  const insert=sql.split('INSERT INTO procedures (id,title,category,summary,icon,sla_days,fee_note,instructions) VALUES')[1].split('ON CONFLICT (id) DO NOTHING;')[0]
  const ids=[...insert.matchAll(/^ \('([^']+)'/gm)].map(x=>x[1])
  assert.equal(ids.length,36)
  assert.equal(new Set(ids).size,36)
  assert.match(sql,/0, 'Chưa xác minh'/)
  assert.match(sql,/ON CONFLICT \(id\) DO NOTHING/)
  assert.match(sql,/ON CONFLICT \(procedure_id,document_code\) DO NOTHING/)
})
test('explicit demo loads expanded catalogue before creating demo tenants via core API',()=>{
  assert.doesNotMatch(compose,/expanded-catalog\.sql/)
  const recipe=makefile.split('\ndemo:')[1].split('\n\n')[0]
  assert.ok(recipe.includes('modules/xa/demo/expanded-catalog.sql'))
  assert.ok(recipe.indexOf('modules/xa/demo/expanded-catalog.sql') < recipe.indexOf('/demo/demo.mjs'))
  assert.match(demo,/set_tenant_procedures/)
  assert.match(demo,/code: 'xa-a'/)
  assert.match(demo,/code: 'xa-b'/)
  assert.match(sql,/INSERT INTO citizen_procedure_versions/)
  assert.match(sql,/'unverified_demo'/)
  assert.match(sql,/WHERE NOT EXISTS \(/)
  assert.doesNotMatch(sql,/INSERT INTO tenant_procedures/)
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
  assert.match(coreSubmit,/due_at\s*=\s*CURRENT_DATE\s*\+\s*\(SELECT\s+NULLIF\(sla_days,\s*0\)/)
})

test('recommendations exclude procedures not enabled for current tenant',()=>{
  assert.match(recommended,/catalogRpc<.*>\(event, 'public_recommendation_catalog'\)/)
  const rpc=publicApi.split('CREATE OR REPLACE FUNCTION api.public_recommendation_catalog()')[1].split('$$;')[0]
  assert.match(rpc,/public\.request_citizen_tenant\(\) IS NULL OR public\.procedure_enabled_for\(public\.request_citizen_tenant\(\), p\.id\)/)
  assert.match(identity,/readSession\(event\)\?\.authMethod === 'keycloak' \? citizenRpc<T>\(event, name, args\) : publicRpc<T>\(name, args\)/)
})
