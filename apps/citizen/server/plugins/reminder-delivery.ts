// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {db} from '../utils/database'
// Explicit opt-in at BOTH deployment and citizen level. Idempotency is enforced by PostgreSQL.
// For multi-replica deployments use an external schedule instead; this plugin may run in each replica.
export default defineNitroPlugin(()=>{
 if(process.env.CITIZEN_REMINDERS_ENABLED!=='true')return
 const scan=async()=>{
  try{await db().query('SELECT citizen_dispatch_reminders($1)',[300])}
  catch(error){console.error('[citizen-reminders] scheduled scan failed',error instanceof Error?error.message:'unknown')}
 }
 const interval=setInterval(()=>{void scan()},60*60*1000)
 interval.unref?.()
 void scan()
})
