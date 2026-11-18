// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {createHash,randomBytes} from 'node:crypto'
import {resultConfig,requestResult} from './result-service'
export const makeToken=()=>randomBytes(32).toString('base64url')
export const hashToken=(token:string)=>createHash('sha256').update(token).digest('hex')
export const documentDigest=(value:Uint8Array)=>createHash('sha256').update(value).digest('hex')
export function publicOrigin(){
 const configured=String(process.env.CITIZEN_PUBLIC_ORIGIN||'').replace(/\/$/,'')
 const url=(()=>{try{return new URL(configured)}catch{return null}})()
 if(!url || (url.protocol!=='https:' && !(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname))))
  throw createError({statusCode:503,statusMessage:'CITIZEN_PUBLIC_ORIGIN chưa được cấu hình bằng địa chỉ HTTPS tin cậy'})
 return url.origin
}
export function tokenOk(token:string){return /^[A-Za-z0-9_-]{43}$/.test(token)}
export async function verifiedProviderPdf(id:string){
 if(!resultConfig().configured)throw createError({statusCode:503,statusMessage:'Chưa kết nối kho kết quả điện tử'})
 const metadata=await requestResult(id)
 if(!metadata)throw createError({statusCode:404,statusMessage:'Chưa có kết quả điện tử để kiểm chứng'})
 const detail=await metadata.json() as {verification?:unknown;reference?:unknown}
 if(detail.verification!=='verified')throw createError({statusCode:409,statusMessage:'Nhà cung cấp chưa xác nhận kết quả ký số hợp lệ; không cấp mã QR'})
 const file=await requestResult(id,'/file')
 if(!file||!String(file.headers.get('content-type')).startsWith('application/pdf'))throw createError({statusCode:502,statusMessage:'Không có PDF kết quả hợp lệ'})
 const data=Buffer.from(await file.arrayBuffer())
 if(data.length<5||data.length>15*1024*1024||data.subarray(0,5).toString()!=='%PDF-')
  throw createError({statusCode:502,statusMessage:'PDF kết quả không hợp lệ hoặc vượt 15 MB'})
 return {sha256:documentDigest(data),reference:String(detail.reference||'').slice(0,120),providerStatus:'verified' as const}
}
