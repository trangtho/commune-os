// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { test, expect } from '@playwright/test'

// Requires the actual running citizen + PostgreSQL stack with seeded data.
// Does not access private citizen records or mutate administrative data.
test('AI assistant returns only a grounded procedure answer with a working link', async ({page,request}) => {
  const status = await request.get('/api/chat/knowledge')
  expect(status.ok()).toBeTruthy()
  const knowledge = await status.json()
  expect(typeof knowledge.ready).toBe('boolean')

  await page.goto('/tro-ly')
  await expect(page.getByRole('heading',{name:'Trợ lý thủ tục hành chính'})).toBeVisible()
  await page.locator('#ai-question').fill('Đăng ký khai sinh cần giấy tờ gì?')
  await page.locator('form button[type="submit"]').click()
  await expect(page.getByRole('log')).toContainText('Giấy chứng sinh')
  await expect(page.getByRole('log').getByRole('link',{name:/Đăng ký khai sinh/}).first()).toHaveAttribute('href','/thu-tuc/khai-sinh')
})

test('Out-of-scope question is rejected without citations', async ({request}) => {
  const response=await request.post('/api/chat',{data:{message:'Dự báo thời tiết hôm nay như thế nào?'}})
  expect(response.ok()).toBeTruthy()
  const data=await response.json()
  expect(data.mode).toBe('INSUFFICIENT')
  expect(data.sources).toEqual([])
})
