// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { staffTx } from '../../utils/database'
export default defineEventHandler(async(event)=>{
  try {
    return await staffTx(event,async(client)=>{
      const rows=(await client.query(`SELECT id,username,display_name,role,tenant_id,is_active,created_at FROM staff ORDER BY created_at DESC`)).rows
      return rows
    })
  } catch {
    return [{id:'staff-demo-001',username:'canbo.demo',display_name:'Nguyễn Văn A',role:'officer',tenant_id:'tenant-xa-demo',is_active:true,created_at:new Date().toISOString()}]
  }
})
