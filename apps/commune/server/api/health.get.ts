// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
export default defineEventHandler(async()=>{
  try {
    const {db}=await import('../utils/database')
    await db().query('SELECT 1')
    return {status:'ok',database:'connected',mode:'demo'}
  } catch (e) {
    return {status:'degraded',database:'disconnected',mode:'demo'}
  }
})
