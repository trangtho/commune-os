// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { securePortalCookie } from './cookie-policy'
import { createHash } from 'node:crypto'
import type { H3Event } from 'h3'
import { getRequestURL, getCookie, setCookie, deleteCookie } from 'h3'
export const counterCookie = 'communeos_counter_preparation'
export const counterTTLSeconds = 15 * 60
export function counterCodeHash(code:string) {return createHash('sha256').update(code).digest('hex')}
export function counterCookieCode(event:H3Event) {
  const code=getCookie(event,counterCookie) || ''
  return /^[A-F0-9]{20}$/.test(code) ? code : ''
}
export function setCounterCookie(event:H3Event,code:string) {
  setCookie(event,counterCookie,code,{httpOnly:true,sameSite:'strict',secure:securePortalCookie(getRequestURL(event)),path:'/api/counter/sessions',maxAge:counterTTLSeconds})
}
export function clearCounterCookie(event:H3Event) {
  deleteCookie(event,counterCookie,{path:'/api/counter/sessions'})
}
