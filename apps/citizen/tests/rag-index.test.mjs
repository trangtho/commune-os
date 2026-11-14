// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
const root=resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read=p=>readFileSync(resolve(root,p),'utf8')
const moduleUrl=new URL('../shared/rag-evidence.ts',import.meta.url).href
function run(source) {
  const result=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','-e',source],{encoding:'utf8',timeout:10000})
  assert.equal(result.status,0, result.stderr || result.stdout)
}
const chunk={id:'procedure:khai-sinh:document:giay',source_type:'procedure',procedure_id:'khai-sinh',field:'documents',source_title:'Đăng ký khai sinh',content:'Giấy chứng sinh (bắt buộc theo dữ liệu hệ thống)',score:2}
test('RAG query syntax is normalized; no untrusted query operators',()=>{
  run(`import assert from 'node:assert/strict'; import {safeTsQuery} from ${JSON.stringify(moduleUrl)};
    const q=safeTsQuery('Khai sinh cần giấy tờ nào?');assert.match(q,/khai/);assert.match(q,/sinh/);
    assert.doesNotMatch(safeTsQuery('foo:* && bar|baz'), /[:*&]/);
    assert.equal(safeTsQuery('   '),'');`)
})
test('Model can only quote exact retrieved published text, URLs are locally built',()=>{
  run(`import assert from 'node:assert/strict';import {composeExtractiveAnswer as build} from ${JSON.stringify(moduleUrl)};
    const item=${JSON.stringify(chunk)};
    const ok=build([item],[{id:item.id,quote:'Giấy chứng sinh'}]);
    assert.equal(ok.mode,'RAG');assert.equal(ok.sources[0].url,'/thu-tuc/khai-sinh');
    assert.match(ok.answer,/Giấy chứng sinh/);assert.equal(ok.sources[0].id,'procedure:khai-sinh');
    for (const bad of ['Giấy tờ không có trong hồ sơ', 'https://evil.example','']) {
      assert.equal(build([item],[{id:item.id,quote:bad}]),null)
    }
    assert.equal(build([item],[{id:'procedure:other',quote:'Giấy chứng sinh'}]),null);
    assert.equal(build([item],[]),null);`)
})
test('RAG migrations implement public-only transactional index and least privilege',()=>{
  const sql=read('../../core/db/init/02-ai-knowledge.sql')
  for(const text of ['citizen_knowledge_chunks','public.unaccent','AFTER INSERT OR UPDATE OR DELETE','communeos_rag_refresh_procedure','p.published=true','public.citizen_faq','GRANT SELECT','REVOKE EXECUTE','USING GIN']) assert.ok(sql.includes(text),text)
  assert.doesNotMatch(sql,/FROM public\.applications|FROM public\.citizens|GRANT (?:INSERT|UPDATE|DELETE) ON TABLE public\.citizen_knowledge_chunks/i)
  const compose=read('../../docker-compose.yml')
  assert.match(compose,/02-ai-knowledge\.sql/)
  const coreSchema=read('../../core/db/init/01-schema.sql')
  assert.match(coreSchema,/citizen_faq'.*applications/)
})
test('RAG endpoint only uses canonical published source citations and privacy gate',()=>{
  const api=read('server/api/chat/index.post.ts')
  assert.match(api,/loadPublishedKnowledge/)
  assert.match(api,/allowedSources\.has/)
  assert.match(api,/result\.mode !== 'INSUFFICIENT'/)
  const remote=read('server/utils/rag-answer.ts')
  assert.match(remote,/privateData\.test\(question\)/)
  assert.match(remote,/composeExtractiveAnswer/)
  assert.match(remote,/redirect:'error'/)
  assert.match(remote,/AbortSignal\.timeout/)
  const ui=read('pages/tro-ly.vue')
  assert.match(ui,/knowledgeStatus\?\.ready/)
  assert.match(ui,/make repair-db/)
})
