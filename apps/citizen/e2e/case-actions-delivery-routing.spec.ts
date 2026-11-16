// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { test,expect } from '@playwright/test'
test('Private case action routes and internal staff APIs reject unauthenticated visitors',async({page})=>{
 const id='HS-2026-000000'
 for(const pageName of ['yeu-cau','nhan-ket-qua','chuyen-co-quan']){
  const response=await page.request.get(`/api/applications/${id}/${pageName==='yeu-cau'?'deadline':pageName==='nhan-ket-qua'?'delivery':'routing'}`)
  expect(response.status()).toBe(401)
 }
 const staffScan=await page.request.post('/api/internal/deadlines/scan')
 expect([401,503]).toContain(staffScan.status())
 const staffApprovals=await page.request.get('/api/internal/cases/requests')
 expect([401,503]).toContain(staffApprovals.status())
})
