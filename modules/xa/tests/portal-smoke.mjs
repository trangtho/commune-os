// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Run only against local demo. Verify anonymous rejection, health and browser-safe session contract.
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const env = Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).filter(l=>/^[A-Z_][A-Z0-9_]*=/.test(l)).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).trim().replace(/^(["'])(.*)\1$/,'$2')]}))
const demo = process.env.DEMO_PASSWORD || 'Demo@2026!'
const base = {citizen:`http://127.0.0.1:${env.CITIZEN_PORT||3000}`,commune:`http://127.0.0.1:${env.COMMUNE_PORT||3002}`,admin:`http://127.0.0.1:${env.ADMIN_PORT||3001}`}
for (const [name,url] of Object.entries(base)) {
  const health = await fetch(url+'/api/health', {signal:AbortSignal.timeout(10000)})
  assert.equal(health.status,200,`${name} health`)
  assert.equal((await health.json()).ok,true)
}
async function login(url,path,body) {
  const r = await fetch(url+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)})
  assert.equal(r.status,200,`login ${path}`)
  const data=await r.json();assert.equal(data.authenticated,true);assert.ok(!('access_token' in data));assert.ok(!('refresh_token' in data))
  const cookies=r.headers.getSetCookie();assert.ok(cookies.some(c=>/httponly/i.test(c)))
  return cookies.map(c=>c.split(';')[0]).join('; ')
}
assert.equal((await fetch(base.admin+'/api/core/rest/tenants')).status,401)
let staffCookie=await login(base.commune,'/api/auth/login',{username:'canbo.xa-a',password:demo})
let adminCookie=await login(base.admin,'/api/dang-nhap',{username:env.COMMUNEOS_ADMIN_USERNAME,password:env.COMMUNEOS_ADMIN_PASSWORD})
async function checkRefresh(url,cookie) {
  const me=await fetch(url+'/api/auth/me',{headers:{cookie}});assert.equal(me.status,200);assert.equal((await me.json()).authenticated,true)
  const refresh=cookie.split('; ').filter(c=>/^communeos_(staff|admin)_rt=/.test(c)).join('; ')
  assert.ok(refresh,'refresh cookie is present')
  const renewed=await fetch(url+'/api/auth/me',{headers:{cookie:refresh}})
  assert.equal(renewed.status,200);assert.equal((await renewed.json()).authenticated,true)
  assert.ok(renewed.headers.getSetCookie().some(c=>/^communeos_(staff|admin)_at=/.test(c)))
  return renewed.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ')
}
// A real document request must not redirect to login after a hard reload.
for (let i = 0; i < 2; i++) {
  const me = await fetch(base.commune+'/api/auth/me', {headers:{cookie:staffCookie}})
  assert.equal(me.status,200,'staff session API before hard reload')
  assert.equal((await me.json()).authenticated,true)
  const reload = await fetch(base.commune+'/', {headers:{cookie:staffCookie},redirect:'manual'})
  assert.equal(reload.status,200,`staff hard reload ${i+1} with a valid session`)
  await reload.text()
}
staffCookie=await checkRefresh(base.commune,staffCookie)
adminCookie=await checkRefresh(base.admin,adminCookie)
const forbidden=await fetch(base.admin+'/api/dang-nhap',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'canbo.xa-a',password:demo})})
assert.equal(forbidden.status,403,'staff cannot log into admin')
const csrf=await fetch(base.admin+'/api/auth/logout',{method:'POST',headers:{cookie:adminCookie,origin:'https://example.invalid'}})
assert.equal(csrf.status,403,'cross-origin mutation rejected')
const r=await fetch(base.admin+'/api/core/rest/tenants',{headers:{cookie:adminCookie}});assert.equal(r.status,200)
assert.equal((await fetch(base.admin+'/api/core/rest/tenants',{headers:{cookie:staffCookie}})).status,401)
for (const [url,cookie] of [[base.commune,staffCookie],[base.admin,adminCookie]]) {
  const r=await fetch(url+'/api/auth/logout',{method:'POST',headers:{cookie}});assert.equal(r.status,200)
}
console.log('Portal health, staff/admin login, session isolation and admin BFF: OK')
