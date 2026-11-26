// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'

const source = readFileSync(new URL('../middleware/staff.global.ts', import.meta.url), 'utf8')
function setup({server = true, data = {authenticated:true, role:'officer'}, error, cookies = []} = {}) {
  const calls = [], forwarded = [], redirects = [], warnings = []
  const request = {}
  const incoming = {cookie:'staff-session=mock', host:'localhost:3002'}
  const scoped = async () => { throw Error('Request-scoped fetch must not be used for raw responses') }
  // Deliberately no scoped.raw: mirrors Nitro's plain request-scoped function.
  const code = stripTypeScriptTypes(source.replace(/^import .* from 'h3'\s*$/m, '').replace('export default ', '').replaceAll('import.meta.server', String(server)))
  const middleware = runInNewContext(code, {
    defineNuxtRouteMiddleware: fn => fn,
    useRequestFetch: () => scoped,
    useRequestEvent: () => request,
    useRequestHeaders: keys => Object.fromEntries(keys.map(k => [k, incoming[k]])),
    $fetch: {raw: async (url, options) => {
      calls.push({url, options})
      if (error) throw error
      return {_data:data, headers:{getSetCookie:()=>cookies}}
    }},
    appendResponseHeader: (event, key, value) => {assert.equal(event,request); forwarded.push([key,value])},
    navigateTo: url => {redirects.push(url); return url},
    createError: input => Object.assign(new Error(input.message), input),
    console: {warn: (...args) => warnings.push(args)},
  })
  return {middleware, calls, forwarded, redirects, warnings}
}
const page = {path:'/',fullPath:'/'}
test('Staff SSR reload uses global raw fetch with incoming cookies and forwards refreshed cookies', async () => {
  const s = setup({cookies:['communeos_staff_at=mock; HttpOnly','communeos_staff_rt=mock; HttpOnly']})
  await s.middleware(page)
  assert.equal(s.calls.length,1)
  assert.equal(s.calls[0].url,'/api/auth/me')
  assert.equal(s.calls[0].options.headers.cookie,'staff-session=mock')
  assert.equal(s.calls[0].options.headers.host,'localhost:3002')
  assert.equal(s.calls[0].options.retry,0)
  assert.equal(s.forwarded.length,2)
  assert.equal(s.redirects.length,0)
})
test('Browser navigation relies on same-origin cookies, not SSR request headers', async () => {
  const s = setup({server:false})
  await s.middleware(page)
  assert.equal(s.calls[0].options.headers,undefined)
  assert.equal(s.calls[0].options.credentials,'same-origin')
  assert.equal(s.redirects.length,0)
})
test('Anonymous and forbidden users still go to login; the login page is public', async () => {
  for (const opts of [{data:{authenticated:false}},{data:{authenticated:true,role:'citizen'}},{error:{statusCode:401}},{error:{response:{status:403}}}]) {
    const s = setup(opts)
    await s.middleware(page)
    assert.equal(s.redirects[0],'/dang-nhap?next=%2F')
  }
  const s = setup()
  await s.middleware({path:'/dang-nhap',fullPath:'/dang-nhap'})
  assert.equal(s.calls.length,0)
})
test('Temporary upstream errors remain visible and do not force logout', async () => {
  const s = setup({error:{statusCode:503,name:'FetchError'}})
  await assert.rejects(s.middleware(page), {statusCode:503})
  assert.equal(s.redirects.length,0)
  assert.equal(s.warnings.length,1)
})
