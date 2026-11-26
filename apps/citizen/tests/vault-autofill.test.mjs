// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
const read=file=>readFileSync(new URL(file,import.meta.url),'utf8')
const migration=read('../../../modules/xa/db/15-citizen-vault-autofill.sql')
// Thao tác dữ liệu của kho giấy tờ là API của lõi, gọi qua cổng bằng token công dân.
const coreApi=read('../../../modules/xa/db/27-citizen-api-vault.sql')
const fn=name=>coreApi.slice(coreApi.indexOf(`FUNCTION api.${name}(`)).split('END $$;')[0]

test('Magic bytes, 5MB bounds, archive and expiry are enforced in shared vault logic',()=>{
 const script=`import assert from 'node:assert/strict';
 import {validVaultContent,vaultIsUsable,MAX_VAULT_BYTES} from './apps/citizen/shared/citizen-vault.ts';
 assert(validVaultContent(Buffer.from('%PDF-1.7'), 'application/pdf'));
 assert(!validVaultContent(Buffer.from('evil content'), 'application/pdf'));
 assert(validVaultContent(Buffer.from([137,80,78,71,13,10,26,10]), 'image/png'));
 assert(!validVaultContent(Buffer.from([137,80,78,71,0,10,26,10]), 'image/png'));
 assert(validVaultContent(Buffer.from([255,216,255]), 'image/jpeg'));
 assert(!validVaultContent(Buffer.alloc(MAX_VAULT_BYTES+1), 'image/jpeg'));
 assert(vaultIsUsable(null,null,'2026-11-16'));
 assert(vaultIsUsable(null,'2026-11-16','2026-11-16'));
 assert(!vaultIsUsable(null,'2026-11-15','2026-11-16'));
 assert(!vaultIsUsable('2026-11-12',null,'2026-11-16'));`
 execFileSync(process.execPath,['--experimental-strip-types','--input-type=module','-e',script],{cwd:new URL('../../..',import.meta.url),stdio:'pipe'})
})

test('Autofill maps only clear self-fields, rejects invalid identity data and never fills relatives',()=>{
 const script=`import assert from 'node:assert/strict';
 import {safeVerifiedClaim,autofillSuggestions} from './apps/citizen/shared/citizen-autofill.ts';
 assert.equal(safeVerifiedClaim('citizenIdentifier','012345678901'),'012345678901');
 assert.equal(safeVerifiedClaim('citizenIdentifier','1111'),null);
 assert.equal(safeVerifiedClaim('birthDate','2026-02-31'),null);
 assert.equal(safeVerifiedClaim('birthDate','2099-01-01'),null);
 const name={key:'fullName',value:'Nguyễn An',source:'self_declared',sourceLabel:'Tự khai',verifiedAt:null};
 const id={key:'citizenIdentifier',value:'012345678901',source:'oidc_verified',sourceLabel:'OIDC',verifiedAt:'2026-11-16'};
 const business=autofillSuggestions('ho-kinh-doanh',[name,id]);
 assert.deepEqual(business.map(x=>x.fieldKey),['businessOwner','ownerIdentifier']);
 assert.equal(business[1].source,'oidc_verified');
 assert.deepEqual(autofillSuggestions('khai-sinh',[name,id]),[]);
 assert.deepEqual(autofillSuggestions('ket-hon',[name,id]),[]);
 assert.deepEqual(autofillSuggestions('ho-kinh-doanh',[name,id],true),[]);`
 execFileSync(process.execPath,['--experimental-strip-types','--input-type=module','-e',script],{cwd:new URL('../../..',import.meta.url),stdio:'pipe'})
})

test('Vault tables have RLS, owner tenant boundaries and no staff/global access grant',()=>{
 for(const table of ['citizen_vault_documents','citizen_vault_versions','citizen_vault_shares','citizen_self_facts','citizen_verified_facts']){
  assert.match(migration,new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\(`))
  assert.match(migration,new RegExp(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`))
 }
 assert.match(migration,/app\.citizen_id/);assert.match(migration,/app\.tenant_id/)
 assert.match(migration,/attachment_id uuid REFERENCES application_documents/)
 assert.match(migration,/GRANT UPDATE\(birth_date,citizen_identifier,updated_at\) ON citizen_self_facts/)
 assert.doesNotMatch(migration,/GRANT DELETE ON citizen_vault_shares/)
 assert.doesNotMatch(migration,/GRANT .* ON citizen_vault_\w+ TO "commune-app"/)
 assert.match(read('../../../modules/xa/module.json'),/15-citizen-vault-autofill\.sql/)
})

test('Upload validates file content, stores key+hash, and rejects attempts to overwrite other citizens',()=>{
 const post=read('../server/api/citizen/vault/index.post.ts')
 const middleware=read('../server/utils/vault.ts')
 assert.match(post,/requireCitizen\(event\)/)
 assert.match(post,/citizenRpc\(event,'citizen_vault_add'/)
 assert.match(fn('citizen_vault_add'),/SELECT id, archived_at INTO v_doc, v_archived FROM citizen_vault_documents WHERE id = p_document_id FOR UPDATE/)
 assert.match(fn('citizen_vault_add'),/LANGUAGE plpgsql SET search_path = public/)
 assert.doesNotMatch(fn('citizen_vault_add'),/SECURITY DEFINER/)
 assert.match(post,/deleteObject\(key\)/)
 assert.match(middleware,/validVaultContent/)
 assert.match(middleware,/MAX_VAULT_BYTES/)
 assert.match(read('../server/api/citizen/vault/files/[id].get.ts'),/citizenRpc<[^>]+>\(event,'citizen_vault_file'/)
 assert.match(fn('citizen_vault_file'),/citizen_vault_restricted\(p_version_id\)/)
})

test('Sharing requires explicit per-case consent, checks owner and expiry twice, copies content and audits',()=>{
 const source=read('../server/api/applications/[id]/documents/from-vault.post.ts')
 const uploader=read('../components/DocUploader.vue')
 assert.match(source,/confirmed:z\.literal\(true\)/)
 assert.match(source,/citizenRpc<Source>\(event,'citizen_vault_source'/)
 assert.match(source,/citizenRpc\(event,'citizen_vault_attach'/)
 // Chủ sở hữu, hạn dùng, quyết định lưu trữ kiểm tra cả trước khi đọc tệp và khi gắn vào hồ sơ.
 for(const name of ['citizen_vault_source','citizen_vault_attach']){
  assert.match(fn(name),/expires_on < public\.today_vietnam\(\)/)
  assert.match(fn(name),/citizen_vault_restricted\(p_version_id\)/)
  assert.match(fn(name),/FOR SHARE OF v, d/)
 }
 assert.match(source,/createHash\('sha256'\)\.update\(bytes\)\.digest\('hex'\)!==source\.sha256/)
 assert.match(source,/getObject\(source\.storage_key\)/)
 assert.match(source,/putObject\(bytes,source\.mime_type\)/)
 assert.match(fn('citizen_vault_attach'),/INSERT INTO citizen_vault_shares/)
 assert.match(source,/deleteObject\(key\)/)
 assert.match(uploader,/reuseConfirmed/)
 assert.match(uploader,/Dùng giấy tờ trong kho/)
 assert.match(uploader,/Xác nhận dùng giấy tờ/)
})

test('Autofill GET is provenance-aware, self edits cannot forge verified status; OIDC gate is opt-in',()=>{
 const get=read('../server/api/citizen/autofill/index.get.ts')
 const update=read('../server/api/citizen/autofill/self.patch.ts')
 const oidc=read('../server/utils/oidc.ts')
 const callback=read('../server/api/auth/oidc/callback.get.ts')
 const wizard=read('../pages/nop-ho-so/[slug].vue')
 assert.match(get,/citizenRpc<Sources>\(event,'citizen_autofill_sources'\)/)
 assert.match(fn('citizen_autofill_sources'),/citizen_record_access\('read_autofill'/)
 assert.match(get,/source:'oidc_verified'/)
 assert.match(update,/citizen_self_facts_update/)
 assert.match(fn('citizen_self_facts_update'),/INSERT INTO citizen_self_facts/)
 assert.doesNotMatch(coreApi,/INSERT INTO citizen_verified_facts/)
 assert.match(oidc,/CITIZEN_OIDC_PERSONAL_DATA_APPROVED/)
 assert.match(callback,/flow\.usePersonalData && c\.verifiedFacts/)
 assert.match(callback,/p_facts: flow\.usePersonalData && c\.verifiedFacts/)
 assert.match(read('../../../modules/xa/db/34-citizen-direct-access.sql'),/INSERT INTO citizen_verified_facts/)
 assert.match(wizard,/autofillReviewed/)
 assert.match(wizard,/Tôi đã kiểm tra lại từng giá trị/)
 assert.match(wizard,/actingFor==='self'/)
 assert.match(read('../pages/ho-so-ca-nhan.vue'),/CitizenAutofillProfile/)
})
