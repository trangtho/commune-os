// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Test on a disposable database after make example-enterprise. Uses demo accounts only.
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {readFileSync} from 'node:fs'
const env=Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1)]))
const val=(k,f)=>process.env[k]??env[k]??f
const gw=val('GATEWAY_URL',`http://localhost:${val('GATEWAY_PORT','9080')}`)
const kc=val('KEYCLOAK_URL','http://localhost:8080')
async function token(username,password){const r=await fetch(kc+'/realms/communeos/protocol/openid-connect/token',{method:'POST',body:new URLSearchParams({grant_type:'password',client_id:'commune-app',username,password}),signal:AbortSignal.timeout(15000),redirect:'error'});assert.equal(r.status,200,'Demo account login');return(await r.json()).access_token}
async function api(t,path,method='GET',body,expected=200){const r=await fetch(gw+path,{method,headers:{Authorization:`Bearer ${t}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(30000)});const result=await r.json().catch(()=>null);assert.equal(r.status,expected,`${method} ${path}: ${r.status}`);return result}
const admin=await token(val('COMMUNEOS_ADMIN_USERNAME',''),val('COMMUNEOS_ADMIN_PASSWORD',''))
const leader=await token('giamdoc.cong-ty-a',val('DEMO_PASSWORD','Demo@2026!'))
const staff=await token('nhanvien.cong-ty-a',val('DEMO_PASSWORD','Demo@2026!'))
await api(admin,'/rest/rpc/set_tenant_module','POST',{tenant_code:'cong-ty-a',module:'iot-demo',enabled:true})
const reading={p_event_id:randomUUID(),p_device:'sensor-demo-01',p_observed_at:new Date(Date.now()-86400000).toISOString(),p_value:38.5}
const result=await api(staff,'/rest/rpc/telemetry_ingest','POST',reading)
assert.equal(result.alert,true);assert.equal(result.duplicate,false)
assert.equal((await api(staff,'/rest/rpc/telemetry_ingest','POST',reading)).duplicate,true)
await api(staff,'/rest/rpc/telemetry_ingest','POST',{...reading,p_value:39},409)
assert.equal((await api(staff,`/rest/telemetry_readings?id=eq.${result.id}`)).length,1)
assert.ok((await api(staff,'/rest/telemetry_daily?device=eq.sensor-demo-01')).length)
const actions=await api(leader,`/workflow/telemetry-alerts/${result.id}/actions`)
assert.ok(actions.actions.includes('resolved'))
await api(staff,`/workflow/telemetry-alerts/${result.id}/actions`,'POST',{action:'resolved'},403)
await api(leader,'/rest/rpc/telemetry_alert_status','POST',{p_id:result.id,status:'resolved'},403)
assert.equal((await api(leader,`/workflow/telemetry-alerts/${result.id}/actions`,'POST',{action:'resolved',note:'Kiểm tra mô phỏng'})).status,'resolved')
console.log('IT/OT demo PASS: ingest idempotent, daily aggregate, workflow authorization, alert resolved.')
