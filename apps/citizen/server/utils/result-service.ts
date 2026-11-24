// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import type { H3Event } from 'h3'
import { citizenRpc } from './identity'
export function resultConfig() {
  const config=useRuntimeConfig()
  const endpoint=String(config.resultEndpoint||'').replace(/\/$/,'')
  let configured=false
  try {const url=new URL(endpoint);configured=url.protocol==='https:'||(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname))}catch{/* Not configured */}
  return {configured,endpoint,token:String(config.resultToken||'')}
}
/** Hồ sơ của chính công dân và đã hoàn thành (api.citizen_result_check của lõi). */
export async function requireCompleted(event:H3Event,id:string) {
  await citizenRpc(event,'citizen_result_check',{p_application_id:id})
  return {id,status:'completed'}
}
export async function requestResult(id:string,suffix='') {
  const config=resultConfig()
  if(!config.configured)throw createError({statusCode:503,statusMessage:'Kho kết quả có chữ ký số chưa được kết nối'})
  const response=await fetch(`${config.endpoint}/results/${encodeURIComponent(id)}${suffix}`,{headers:config.token?{authorization:`Bearer ${config.token}`}:{},signal:AbortSignal.timeout(10000)})
  if(response.status===404)return null
  if(!response.ok)throw createError({statusCode:502,statusMessage:'Dịch vụ trả kết quả đang không khả dụng'})
  return response
}
