// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { readSession } from '../../utils/session'
export default defineEventHandler((event)=>{
  const actor=readSession(event)
  return actor ? {authenticated:true,role:'citizen',name:actor.name} : {authenticated:false}
})
