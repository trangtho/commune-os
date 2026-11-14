// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
export default defineEventHandler(async(event)=>{
  try {
    const res=await fetch(`${event.node.req.protocol}//${event.node.req.host}/api/health`)
    const h=await res.json()
    return {status:h.status||'online',time:new Date().toISOString()}
  } catch {return {status:'online',time:new Date().toISOString()}}
})
