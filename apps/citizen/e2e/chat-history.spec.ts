// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { test, expect } from '@playwright/test'

const username = process.env.E2E_USERNAME || 'congdan.demo'
const password = process.env.E2E_PASSWORD || 'Demo@2026!'

test('Lịch sử AI được lưu theo phiên đăng nhập, mở lại và xóa được', async ({ page }) => {
  await page.goto('/dang-nhap')
  await page.getByLabel('Tên đăng nhập').fill(username)
  await page.getByLabel('Mật khẩu').fill(password)
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await expect(page).not.toHaveURL(/dang-nhap/)

  await page.goto('/tro-ly')
  const question = 'Đăng ký khai sinh cần chuẩn bị những giấy tờ gì?'
  await page.locator('#ai-question').fill(question)
  await page.locator('form button[type="submit"]').click()
  await expect(page.getByRole('log')).toContainText('Giấy chứng sinh')
  await expect(page.getByText('Hội thoại được lưu riêng trong tài khoản')).toBeVisible()

  const summaries = await page.request.get('/api/chat/conversations')
  expect(summaries.ok()).toBeTruthy()
  const { items } = await summaries.json()
  const thread = items.find((item: { title: string }) => item.title === question)
  expect(thread).toBeTruthy()

  await page.reload()
  await page.getByRole('button', { name: new RegExp(question) }).first().click()
  await expect(page.getByRole('log')).toContainText('Giấy chứng sinh')
  const detail = await page.request.get(`/api/chat/conversations/${thread.id}`)
  expect(detail.ok()).toBeTruthy()
  const data = await detail.json()
  expect(data.messages.some((item: {role: string, content: string}) => item.role === 'citizen' && item.content === question)).toBeTruthy()
  expect(data.messages.some((item: {role: string, sources: unknown[]}) => item.role === 'assistant' && item.sources.length > 0)).toBeTruthy()

  const deleted = await page.request.delete(`/api/chat/conversations/${thread.id}`)
  expect(deleted.ok()).toBeTruthy()
  const missing = await page.request.get(`/api/chat/conversations/${thread.id}`)
  expect(missing.status()).toBe(404)
})

test('Khách có thể hỏi nhưng không được xem lịch sử tài khoản', async ({ request }) => {
  const list = await request.get('/api/chat/conversations')
  expect(list.status()).toBe(401)
  const answer = await request.post('/api/chat', {data: {message:'Đăng ký khai sinh cần giấy tờ gì?'}})
  expect(answer.ok()).toBeTruthy()
  const result = await answer.json()
  expect(result.saved).toBe(false)
  expect(result.conversationId).toBe(null)
})
