// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { createHash, createHmac, createPublicKey, randomBytes, timingSafeEqual, verify } from 'node:crypto'
import type { H3Event } from 'h3'
import { getCookie, setCookie, deleteCookie } from 'h3'
const cookie = 'citizen_oidc_flow'
type Flow = { state:string; verifier:string; nonce:string; next:string; expires:number; useResidence?:boolean }
const digest = (text:string) => createHash('sha256').update(text).digest('base64url')
function sign(value:string) {return createHmac('sha256',String(useRuntimeConfig().sessionSecret)).update(value).digest('base64url')}
export function configOidc() {
  const c = useRuntimeConfig()
  const issuer = String(c.oidcIssuer||'')
  const authorizeUrl = String(c.oidcAuthorizeUrl||'')
  const tokenUrl = String(c.oidcTokenUrl||'')
  const jwksUrl = String(c.oidcJwksUrl||'')
  const clientId = String(c.oidcClientId||'')
  const clientSecret = String(c.oidcClientSecret||'')
  const redirectUri = String(c.oidcRedirectUri||'')
  const urls=[issuer,authorizeUrl,tokenUrl,jwksUrl,redirectUri]
  const provider = String(process.env.CITIZEN_OIDC_PROVIDER||'identity').toLowerCase()
  const approvedVneid = process.env.CITIZEN_VNEID_INTEGRATION_APPROVED === 'true'
  const configured = !!clientId && (provider !== 'vneid' || approvedVneid) && urls.every(url => {
    try {const parsed=new URL(url);return parsed.protocol==='https:' || (parsed.protocol==='http:'&&['localhost','127.0.0.1'].includes(parsed.hostname))}catch{return false}
  })
  return {configured, provider, vneid: configured && provider === 'vneid' && approvedVneid, issuer,authorizeUrl,tokenUrl,jwksUrl,clientId,clientSecret,redirectUri}
}
function secretCheck() {
  if(String(useRuntimeConfig().sessionSecret).length < 32) throw createError({statusCode:503,statusMessage:'Chưa cấu hình SESSION_SECRET an toàn'})
}
export function startOidc(event:H3Event,next:string,useResidence=false) {
  secretCheck()
  const c=configOidc()
  if(!c.configured)throw createError({statusCode:503,statusMessage:'Chưa cấu hình máy chủ Identity OIDC'})
  const flow:Flow={ state:randomBytes(24).toString('base64url'), verifier:randomBytes(48).toString('base64url'), nonce:randomBytes(24).toString('base64url'),next:next.startsWith('/')&&!next.startsWith('//')?next:'/',expires:Date.now()+10*60*1000,useResidence:useResidence&&c.vneid }
  const body=Buffer.from(JSON.stringify(flow)).toString('base64url')
  setCookie(event,cookie,`${body}.${sign(body)}`,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:600,path:'/'})
  const url=new URL(c.authorizeUrl)
  url.searchParams.set('response_type','code');url.searchParams.set('client_id',c.clientId)
  const localityScope = flow.useResidence ? String(process.env.CITIZEN_OIDC_LOCALITY_SCOPE||'').trim() : ''
  url.searchParams.set('redirect_uri',c.redirectUri);url.searchParams.set('scope',['openid','profile',localityScope].filter(Boolean).join(' '))
  url.searchParams.set('state',flow.state);url.searchParams.set('nonce',flow.nonce)
  url.searchParams.set('code_challenge',digest(flow.verifier));url.searchParams.set('code_challenge_method','S256')
  return url.toString()
}
export function consumeOidc(event:H3Event):Flow {
  secretCheck()
  const token=getCookie(event,cookie)||''
  deleteCookie(event,cookie,{path:'/'})
  const [body,signature,...rest]=token.split('.')
  if(!body||!signature||rest.length)throw createError({statusCode:400,statusMessage:'Phiên xác thực không hợp lệ hoặc đã hết hạn'})
  const expected=Buffer.from(sign(body)),received=Buffer.from(signature)
  if(expected.length!==received.length||!timingSafeEqual(expected,received))throw createError({statusCode:400,statusMessage:'Phiên xác thực không hợp lệ'})
  let flow:Flow
  try{flow=JSON.parse(Buffer.from(body,'base64url').toString('utf8'))}catch{throw createError({statusCode:400,statusMessage:'Phiên xác thực không hợp lệ'})}
  if(!flow.state||!flow.verifier||!flow.nonce||flow.expires<Date.now())throw createError({statusCode:400,statusMessage:'Phiên xác thực đã hết hạn'})
  return flow
}
function jsonPart(value:string):Record<string,unknown> {
  try {return JSON.parse(Buffer.from(value,'base64url').toString('utf8'))} catch {throw createError({statusCode:401,statusMessage:'Token định danh không hợp lệ'})}
}
/** Verify an ID token from a configured trusted IdP, never trust unverified username/email claims. */
export async function verifiedOidcSubject(jwt:string,expectedNonce:string):Promise<{iss:string;sub:string;residenceTenantCode?:string;temporaryTenantCode?:string}> {
  const c=configOidc()
  const parts=jwt.split('.')
  if(parts.length!==3)throw createError({statusCode:401,statusMessage:'Token OIDC không hợp lệ'})
  const header=jsonPart(parts[0]), payload=jsonPart(parts[1])
  if(header.alg!=='RS256'||typeof header.kid!=='string')throw createError({statusCode:401,statusMessage:'Thuật toán chữ ký OIDC không được hỗ trợ'})
  const response=await fetch(c.jwksUrl,{signal:AbortSignal.timeout(8000)})
  if(!response.ok)throw createError({statusCode:503,statusMessage:'Không xác minh được khóa công khai của Identity'})
  const jwks=await response.json() as {keys?:Record<string,unknown>[]}
  const key=jwks.keys?.find(item=>item.kid===header.kid&&item.kty==='RSA'&&(!item.use||item.use==='sig'))
  if(!key)throw createError({statusCode:401,statusMessage:'Không tìm thấy khóa xác minh token'})
  let valid=false
  try{valid=verify('RSA-SHA256',Buffer.from(`${parts[0]}.${parts[1]}`),createPublicKey({key:key as JsonWebKey,format:'jwk'}),Buffer.from(parts[2],'base64url'))}catch{/* Invalid key. */}
  if(!valid)throw createError({statusCode:401,statusMessage:'Chữ ký token Identity không hợp lệ'})
  const now=Math.floor(Date.now()/1000)
  const audience=payload.aud
  const accepted=audience===c.clientId||(Array.isArray(audience)&&audience.includes(c.clientId))
  if(payload.iss!==c.issuer||!accepted||typeof payload.sub!=='string'||!payload.sub||payload.nonce!==expectedNonce||typeof payload.exp!=='number'||payload.exp<=now-30||typeof payload.iat!=='number'||payload.iat>now+30||typeof payload.nbf==='number'&&payload.nbf>now+30)
    throw createError({statusCode:401,statusMessage:'Thông tin xác thực Identity không hợp lệ'})
  if(Array.isArray(audience)&&audience.length>1&&payload.azp!==c.clientId)throw createError({statusCode:401,statusMessage:'OIDC authorized party không hợp lệ'})
  // Only accepted from a verified ID token, never from query strings, cookies or user-submitted JSON.
  // These are CONTRACT-SPECIFIC tenant codes configured by the authorized identity team.
  const mappedCode=(envKey:string):string|undefined=>{
    const field=String(process.env[envKey]||'').trim()
    const value=field ? payload[field] : undefined
    return typeof value==='string' && /^[A-Za-z0-9_-]{2,64}$/.test(value) ? value : undefined
  }
  return {iss:c.issuer,sub:payload.sub,
    residenceTenantCode:c.vneid?mappedCode('CITIZEN_OIDC_RESIDENCE_TENANT_CLAIM'):undefined,
    temporaryTenantCode:c.vneid?mappedCode('CITIZEN_OIDC_TEMPORARY_TENANT_CLAIM'):undefined}

}
/** Stable account-link identifier, provisioned by Identity team in citizens.login_name. */
export function oidcLoginName(issuer:string,sub:string) {return 'oidc-'+createHash('sha256').update(issuer+'|'+sub).digest('hex').slice(0,48)}
