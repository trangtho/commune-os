// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
const read=file=>readFileSync(new URL(file, import.meta.url),'utf8')
const migration=read('../../../core/db/init/04-citizen-personalization.sql')
const api=read('../server/api/procedures/recommended.get.ts')
const prefs=read('../server/api/citizen/preferences/index.patch.ts')
const get=read('../server/api/citizen/preferences/index.get.ts')
const del=read('../server/api/citizen/preferences/index.delete.ts')
const login=read('../server/api/auth/oidc/callback.get.ts')
const oidc=read('../server/utils/oidc.ts')
const routes=read('../server/utils/citizen-preferences.ts')
const form=read('../pages/nop-ho-so/[slug].vue')
const catalog=read('../pages/thu-tuc/index.vue')
const home=read('../pages/index.vue')

test('Scores are consented, deterministic, and explainable; unverified audience and locality metadata is ignored',()=>{
  const script=`import assert from 'node:assert/strict';
    import {rankProcedures,emptyPreferences,localityGuidance} from './apps/citizen/shared/personalization.ts';
    const ps=[{id:'a',title:'A',summary:'',category:'Cư trú',audience_groups:['parent'],metadata_verified:false,available_tenant_ids:['t2']},
      {id:'b',title:'B',summary:'',category:'Hộ tịch',audience_groups:['parent'],metadata_verified:true,available_tenant_ids:['t2']},
      {id:'c',title:'C',summary:'',category:'Kinh doanh'}];
    const prefs={...emptyPreferences,personalization_enabled:false,audience_group:'parent',interest_categories:['Hộ tịch'],residence_tenant_id:'t2'};
    const none=rankProcedures(ps,prefs,[{procedure_id:'c',uses:2}]);
    assert.deepEqual(none.map(x=>x.score),[0,0,0]);
    assert.deepEqual(none.map(x=>x.procedure.id),['a','b','c']);
    prefs.personalization_enabled=true;
    const yes=rankProcedures(ps,prefs,[{procedure_id:'c',uses:2}]);
    assert.equal(yes[0].procedure.id,'b');
    assert.equal(yes[0].score,12);
    assert.equal(yes[1].procedure.id,'c');
    assert.equal(yes[1].score,10);
    assert.equal(yes[2].score,0);
    assert(yes[0].reasons.some(r=>r.includes('lĩnh vực')));
    assert.equal(localityGuidance({accountTenantId:'t1',residenceTenantId:'t2',temporaryTenantId:null,preferredTenantId:null}).requiresRouteCheck,true);
    assert.equal(localityGuidance({accountTenantId:'t1',residenceTenantId:null,temporaryTenantId:null,preferredTenantId:null}).candidateTenantId,'t1');`
  execFileSync(process.execPath,['--experimental-strip-types','--input-type=module','-e',script],{cwd:new URL('../../..',import.meta.url),stdio:'pipe'})
})

test('Preferences migration uses FORCE RLS and does not allow application to authorize routes',()=>{
  assert.match(migration,/CREATE TABLE IF NOT EXISTS citizen_service_preferences/)
  assert.match(migration,/FORCE ROW LEVEL SECURITY/)
  assert.match(migration,/app\.citizen_id/)
  assert.match(migration,/app\.tenant_id/)
  assert.match(migration,/citizen_procedure_receivers/)
  assert.match(migration,/approval_reference/)
  assert.match(migration,/valid_until/)
  assert.doesNotMatch(migration,/GRANT (?:INSERT|UPDATE).*citizen_procedure_receivers TO communeos_app/)
  assert.match(migration,/ADD COLUMN IF NOT EXISTS receiving_tenant_id/)
  assert.match(read('../../../docker-compose.yml'),/04-citizen-personalization\.sql/)
})

test('Personalization endpoints are owner-scoped with opt-in and server-side validated categories and localities',()=>{
  assert.match(api,/citizenTx\(event/)
  assert.match(api,/personalization_enabled/)
  assert.match(api,/applications/)
  assert.match(api,/metadata_verified/)
  assert.match(prefs,/\.strict\(\)/)
  assert.match(prefs,/SELECT id FROM tenants WHERE id = ANY/)
  assert.match(prefs,/SELECT DISTINCT category FROM procedures/)
  assert.match(prefs,/citizenTx\(event/)
  assert.match(get,/citizenTx\(event/)
  assert.match(del,/citizenTx\(event/)
})

test('Receiving locality is checked when drafting, editing and final submitting, including permission expiry',()=>{
  assert.match(routes,/approval_reference/)
  assert.match(routes,/valid_until > now\(\)/)
  for(const source of ['../server/api/applications/index.post.ts','../server/api/applications/[id].patch.ts','../server/api/applications/[id]/submit.post.ts']){
    assert.match(read(source),/permittedReceivingTenant/)
  }
  assert.match(form,/localitySuggestion/)
  assert.match(form,/canReceive/)
  assert.match(form,/Cập nhật địa phương/)
})

test('Approved identity OIDC requires verified signed token, explicit consent, and configured tenant claim names',()=>{
  assert.match(oidc,/CITIZEN_VNEID_INTEGRATION_APPROVED/)
  assert.match(oidc,/CITIZEN_OIDC_PROVIDER/)
  assert.match(oidc,/nonce/)
  assert.match(oidc,/verify\('RSA-SHA256'/)
  assert.match(oidc,/CITIZEN_OIDC_RESIDENCE_TENANT_CLAIM/)
  assert.match(login,/flow\.useResidence && c\.vneid/)
  assert.match(login,/app.citizen_id/)
  assert.match(login,/db\(\).connect\(\)/)
  assert.doesNotMatch(login,/citizenId.*getQuery/)
  assert.match(read('../pages/dang-nhap.vue'),/shareLocality/)
  assert.match(read('../server/api/auth/methods.get.ts'),/vneid/)
})

test('Recommendations and consent controls render with an unfiltered catalog fallback',()=>{
  assert.match(catalog,/Gợi ý cho tôi/)
  assert.match(catalog,/Tất cả thủ tục/)
  assert.match(catalog,/ranked/)
  assert.match(catalog,/isFiltering/)
  assert.match(home,/citizen-procedure-recommendations/)
  const panel=read('../components/CitizenPreferencesPanel.vue')
  assert.match(panel,/personalization_enabled/)
  assert.match(panel,/residence_tenant_id/)
  assert.match(panel,/temporary_tenant_id/)
  assert.match(panel,/Xóa dữ liệu tự khai/)
  assert.match(read('../pages/ho-so-ca-nhan.vue'),/CitizenPreferencesPanel/)
})
