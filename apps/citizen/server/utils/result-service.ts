// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import type { H3Event } from 'h3'
import { citizenTx } from './database'
export function resultConfig() {
  const config=useRuntimeConfig()
  const endpoint=String(config.resultEndpoint||'').replace(/\/$/,'')
  let configured=false
  try {const url=new URL(endpoint);configured=url.protocol==='https:'||(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname))}catch{/* Not configured */}
  return {configured,endpoint,token:String(config.resultToken||'')}
}
export async function requireCompleted(event:H3Event,id:string) {
  return citizenTx(event,async client => {
    const c=(await client.query('SELECT id,status FROM applications WHERE id=$1',[id])).rows[0]
    if(!c)throw createError({statusCode:404,statusMessage:'Không tìm thấy hồ sơ hoặc không có quyền truy cập'})
    if(c.status!=='completed')throw createError({statusCode:409,statusMessage:'Hồ sơ chưa có kết quả hoàn thành'})
    return c
  })
}
export async function requestResult(id:string,suffix='') {
  const config=resultConfig()
  if(!config.configured)throw createError({statusCode:503,statusMessage:'Kho kết quả có chữ ký số chưa được kết nối'})
  const response=await fetch(`${config.endpoint}/results/${encodeURIComponent(id)}${suffix}`,{headers:config.token?{authorization:`Bearer ${config.token}`}:{},signal:AbortSignal.timeout(10000)})
  if(response.status===404)return null
  if(!response.ok)throw createError({statusCode:502,statusMessage:'Dịch vụ trả kết quả đang không khả dụng'})
  return response
}
