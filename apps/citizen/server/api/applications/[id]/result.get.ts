// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { requireCompleted, requestResult, resultConfig } from '../../../utils/result-service'
export default defineEventHandler(async event => {
  const id=getRouterParam(event,'id') || ''
  await requireCompleted(event,id)
  if(!resultConfig().configured)return {available:false,configured:false,verification:'unknown',message:'Chưa kết nối kho kết quả ký số'}
  const response=await requestResult(id)
  if(!response)return {available:false,configured:true,verification:'unknown',message:'Chưa nhận được văn bản kết quả từ hệ thống xử lý'}
  const data=await response.json() as {title?:unknown;verification?:unknown;signer?:unknown;signedAt?:unknown;reference?:unknown}
  const verification=['verified','unverified','unknown'].includes(String(data.verification))?String(data.verification):'unknown'
  return {available:true,configured:true,verification,title:typeof data.title==='string'?data.title.slice(0,200):'Văn bản kết quả',signer:typeof data.signer==='string'?data.signer.slice(0,100):'',signedAt:typeof data.signedAt==='string'?data.signedAt:'',reference:typeof data.reference==='string'?data.reference.slice(0,100):''}
})
