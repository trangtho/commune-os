// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {db} from '../utils/database'
/**
 * Optional daily review-only scan. No physical deletion is executed.
 * Multi-replica runs are harmless: the SQL scanner uses ON CONFLICT DO NOTHING.
 * Disabled by default; enable with CITIZEN_RETENTION_SCAN_ENABLED=true.
 */
export default defineNitroPlugin(()=>{
 if(process.env.CITIZEN_RETENTION_SCAN_ENABLED!=='true')return
 let scanning=false
 async function scan(){
  if(scanning)return
  scanning=true
  try{
   const pool=db()
   const tenants=(await pool.query('SELECT id FROM tenants ORDER BY id')).rows
   let created=0
   for(const tenant of tenants){
    const result=(await pool.query('SELECT citizen_staff_scan_retention($1::uuid) AS created',[tenant.id])).rows[0]
    created+=Number(result?.created||0)
   }
   console.info('[citizen-retention] completed review-only scan', {tenants:tenants.length,created})
  }catch(error){console.error('[citizen-retention] review scan failed',error)}
  finally{scanning=false}
 }
 // Wait for db-setup and the Nitro server to finish starting, then run daily.
 const first=setTimeout(()=>{void scan()},60_000)
 const recurring=setInterval(()=>{void scan()},24*60*60*1000)
 first.unref?.()
 recurring.unref?.()
})
