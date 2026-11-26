// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { readSession } from '../../utils/session'
export default defineEventHandler(async(event)=>{
  setHeader(event, 'Cache-Control', 'no-store')
  const actor=await readSession(event)
  return actor ? {authenticated:true,role:actor.role,name:actor.name} : {authenticated:false}
})
