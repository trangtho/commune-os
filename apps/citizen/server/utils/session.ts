// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { createHmac, timingSafeEqual } from 'node:crypto'
import { getCookie, setCookie, deleteCookie, createError, type H3Event } from 'h3'
type Identity={ id:string; tenantId:string; name:string; role:'citizen'; exp:number; authMethod?:'demo'|'oidc' }
const cookieName = 'communeos_citizen_demo'
function secret(){
  const value=String(useRuntimeConfig().sessionSecret)
  if (value.length < 32) throw createError({statusCode:503, statusMessage:'SESSION_SECRET phải có ít nhất 32 ký tự'})
  return value
}
function signature(body:string){return createHmac('sha256',secret()).update(body).digest('base64url')}
export function signSession(event:H3Event, citizen:{id:string;tenantId:string;name:string;authMethod?:'demo'|'oidc'}) {
  const body=Buffer.from(JSON.stringify({...citizen,role:'citizen',exp:Date.now()+12*60*60*1000})).toString('base64url')
  setCookie(event,cookieName,`${body}.${signature(body)}`,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:12*60*60})
}
export function readSession(event:H3Event):Identity|null {
  const token=getCookie(event,cookieName)
  if(!token) return null
  const [body,mac,...extra]=token.split('.')
  if(!body||!mac||extra.length) return null
  const expected=Buffer.from(signature(body)); const got=Buffer.from(mac)
  if(got.length!==expected.length || !timingSafeEqual(expected,got)) return null
  try {
    const data=JSON.parse(Buffer.from(body,'base64url').toString()) as Identity
    if(data.role!=='citizen'||!data.id||!data.tenantId||data.exp<Date.now()) return null
    return data
  } catch {return null}
}
export function requireCitizen(event:H3Event):Identity {
  const actor=readSession(event)
  if(!actor) throw createError({statusCode:401,statusMessage:'Vui lòng đăng nhập tài khoản Công dân'})
  return actor
}
export function signOut(event:H3Event){deleteCookie(event,cookieName,{path:'/'})}
