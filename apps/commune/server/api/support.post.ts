// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
export default defineEventHandler(async(event)=>{
  const body=await readBody(event)
  await $fetch('/api/support',{method:'POST',body:{applicationId:body.applicationId,message:body.message,from:'staff'}})
  return {ok:true}
})
