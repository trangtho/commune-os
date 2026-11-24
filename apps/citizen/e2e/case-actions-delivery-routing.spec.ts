// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { test,expect } from '@playwright/test'
test('Private case action routes reject unauthenticated visitors; staff APIs are no longer in the citizen app',async({page})=>{
 const id='HS-2026-000000'
 for(const pageName of ['yeu-cau','nhan-ket-qua','chuyen-co-quan']){
  const response=await page.request.get(`/api/applications/${id}/${pageName==='yeu-cau'?'deadline':pageName==='nhan-ket-qua'?'delivery':'routing'}`)
  expect(response.status()).toBe(401)
 }
 // Chức năng cán bộ nay là API của lõi (/rest/rpc/*, token Keycloak cán bộ); Kênh người dân không còn /api/internal.
 const staffScan=await page.request.post('/api/internal/deadlines/scan')
 expect(staffScan.status()).toBe(404)
})
