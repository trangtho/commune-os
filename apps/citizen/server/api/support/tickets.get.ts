// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { requireCitizen } from '../../utils/session'
/** Staff replies must come from a trusted backend; never fabricate replies or workflow status. */
export default defineEventHandler(async event => {
  const actor=requireCitizen(event)
  const c=useRuntimeConfig()
  const endpoint=String(c.supportEndpoint||'').replace(/\/$/,'')
  let address:URL
  try {
    address=new URL(endpoint)
    if(address.protocol!=='https:'&&!(address.protocol==='http:'&&['localhost','127.0.0.1'].includes(address.hostname)))throw new Error('insecure')
  }catch{return {configured:false,tickets:[]}}
  const url=new URL(`${address.toString().replace(/\/$/,'')}/citizen/tickets`)
  url.searchParams.set('citizenId',actor.id)
  const response=await fetch(url,{headers:{...(c.supportToken?{authorization:`Bearer ${c.supportToken}`}:{})},signal:AbortSignal.timeout(8000)})
  if(!response.ok)throw createError({statusCode:502,statusMessage:'Không tải được yêu cầu từ kênh cán bộ'})
  const data=await response.json() as {tickets?:unknown}
  const raw=Array.isArray(data.tickets)?data.tickets:[]
  const tickets=raw.filter((item):item is Record<string,unknown> => {
    if(!item||typeof item!=='object')return false
    const ticket=item as Record<string,unknown>
    return ticket.citizenId===actor.id && ticket.tenantId===actor.tenantId
  }).slice(0,100).map(ticket=>({
    id:String(ticket.id||'').slice(0,100),subject:String(ticket.subject||'Yêu cầu hỗ trợ').slice(0,150),
    status:['received','processing','answered','closed'].includes(String(ticket.status))?String(ticket.status):'unknown',
    reply:typeof ticket.reply==='string'?ticket.reply.slice(0,3000):null,
    updatedAt:typeof ticket.updatedAt==='string'?ticket.updatedAt:''
  }))
  return {configured:true,tickets}
})
