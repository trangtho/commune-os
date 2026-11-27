// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {loadManifests,moduleFile} from '../module-loader.mjs'
import {renderGateway} from '../gateway/generate-config.mjs'
import {identityConfig} from '../identity/module-config.mjs'
import {buildPrincipalRules,principal,resourceId} from '../ai/principals.mjs'
import {createModule,validateModule} from '../../tools/module-sdk.mjs'
const dir=fileURLToPath(new URL('../../modules/',import.meta.url))
const entries=(...modules)=>loadManifests({modules,directory:dir})
const base=readFileSync(new URL('../gateway/apisix.yaml',import.meta.url),'utf8')
const realm=JSON.parse(readFileSync(new URL('../identity/realm/communeos-realm.json',import.meta.url),'utf8'))
test('Gateway core only exposes platform RPC, no commune public endpoints',()=>{const result=renderGateway(base,entries());assert.match(result,/public_platform/);assert.doesNotMatch(result,/procedure_catalog|accounts\/register/);assert.match(result,/#END\n$/)})
test('Gateway installs exact public module paths with fixed limit and upstream',()=>{const x=renderGateway(base,entries('xa','doanh-nghiep'));assert.match(x,/\/public\/rpc\/procedure_catalog/);assert.match(x,/\/public\/accounts\/register/);assert.match(x,/remove: \["Authorization"\]/);assert.match(x,/count: 20/)})
test('Gateway rejects duplicate and wildcard paths and first-password alias',()=>{for(const gateway of [{publicRpc:['public_platform']},{publicRpc:['*']},{publicAccounts:['../x']},{publicAccounts:['first-password']},{publicRpc:'x'}])assert.throws(()=>renderGateway(base,[{manifest:{gateway}}]))})
test('Identity extensions absent in Core Only; module adds client, claims and role',()=>{const empty=identityConfig(realm,entries());assert.ok(!empty.clients.some(x=>x.clientId==='citizen-app'));assert.ok(!empty.roles.some(x=>x.name==='citizen'));const full=identityConfig(realm,entries('xa'));assert.ok(full.clients.some(x=>x.clientId==='citizen-app'));assert.ok(full.roles.some(x=>x.name==='citizen'));assert.ok(full.attributes.some(x=>x.name==='citizen_tenant'));assert.equal(full.confidential['citizen-app'],'CITIZEN_KEYCLOAK_SECRET')})
test('AI denies citizen principal without module, tenant or role; staff stays compatible',()=>{const c={sub:'x',azp:'citizen-app',citizen_id:'c',citizen_tenant:'xa-a',realm_access:{roles:['citizen']}};const rules=buildPrincipalRules(entries('xa'));assert.equal(principal(c,[]),null);assert.equal(principal(c,rules).tenant,'xa-a');assert.equal(principal({...c,citizen_tenant:''},rules),null);assert.equal(principal({...c,realm_access:{roles:[]}},rules),null);assert.equal(principal({sub:'s',azp:'commune-app',tenant_id:'cty'},[]).kind,'staff');assert.equal(resourceId({resourceId:'leave-01',procedureId:'old'}),'leave-01');assert.equal(resourceId({procedureId:'old'}),'old')})
test('SDK validates existing modules, creates safe scaffold, prevents overwrite and traversal',()=>{for(const n of ['xa','doanh-nghiep','iot-demo'])assert.equal(validateModule(dir,n).name,n);const tmp=mkdtempSync(join(tmpdir(),'dxos-sdk-'));try{createModule(tmp,'test-addon');assert.equal(validateModule(tmp,'test-addon').name,'test-addon');assert.throws(()=>createModule(tmp,'test-addon'));assert.throws(()=>createModule(tmp,'../test'));assert.throws(()=>moduleFile(join(tmp,'test-addon'),'../outside'))}finally{rmSync(tmp,{recursive:true,force:true})}})

test('Dynamic module roles share manifest loading; Core Only stays empty',()=>{
  assert.deepEqual(identityConfig(realm,entries()).moduleRoles,[])
  const full=identityConfig(realm,entries('xa','doanh-nghiep'))
  assert.ok(full.clients.some(c=>c.clientId==='citizen-app'))
  assert.ok(full.moduleRoles.some(r=>r.name==='doanh-nghiep:truong-phong' && r.description.includes('Trưởng phòng')))
  assert.ok(!full.moduleRoles.some(r=>r.name==='leader'))
  for(const roles of [[{name:'leader:admin'}],[{name:'x'},{name:'x'}],{},[null],[{name:'x',title:4}]]) {
    assert.throws(()=>identityConfig(realm,[{manifest:{name:'demo',roles}}]))
  }
  const [xa]=entries('xa')
  assert.throws(()=>identityConfig(realm,[{...xa,manifest:{...xa.manifest,name:'bad:name',roles:[{name:'x'}]}}]))
})
test('Compose identity setup preserves empty module list and loader mount',()=>{
  const compose=readFileSync(new URL('../../docker-compose.yml',import.meta.url),'utf8')
  const setup=compose.split('  identity-setup:')[1].split('  gateway-setup:')[0]
  assert.equal((setup.match(/^\s+COMMUNEOS_MODULES:/gm)||[]).length,1)
  assert.match(setup,/COMMUNEOS_MODULES: \$\{COMMUNEOS_MODULES-xa,doanh-nghiep\}/)
  assert.match(setup,/module-loader\.mjs:\/module-loader\.mjs:ro/)
})
