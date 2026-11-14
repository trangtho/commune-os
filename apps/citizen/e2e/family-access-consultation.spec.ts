// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { test,expect,type Page } from '@playwright/test'
async function login(page:Page){
  const methods=await (await page.request.get('/api/auth/methods')).json()
  test.skip(!methods.demo,'Cần tài khoản OIDC kiểm thử nếu tắt chế độ demo')
  await page.goto('/dang-nhap')
  await page.getByLabel('Tên đăng nhập').fill(process.env.E2E_USERNAME||'congdan.demo')
  await page.getByLabel('Mật khẩu').fill(process.env.E2E_PASSWORD||'Demo@2026!')
  await page.getByRole('button',{name:'Đăng nhập',exact:true}).click()
  await expect(page).not.toHaveURL(/dang-nhap/)
}
test('Assisted reading mode does not erase text entered in a form',async({page})=>{
  await login(page)
  await page.goto('/lich-tu-van')
  await expect(page.getByRole('heading',{name:'Đặt lịch tư vấn trực tuyến'})).toBeVisible()
  const subject=page.locator('#consult-subject')
  await subject.fill('Cần tư vấn về hồ sơ hộ tịch')
  await page.getByRole('button',{name:'Tùy chọn hỗ trợ tiếp cận'}).click()
  await page.getByLabel('Chữ lớn, dễ đọc').check()
  await page.getByLabel('Tương phản cao').check()
  await expect(subject).toHaveValue('Cần tư vấn về hồ sơ hộ tịch')
  await expect(page.locator('html')).toHaveClass(/citizen-access-large/)
  await page.getByRole('button',{name:'Đóng tùy chọn hỗ trợ'}).click()
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/citizen-access-contrast/)
})
test('Family requests and stage reviews are never available to guest sessions',async({page})=>{
  const family=await page.request.get('/api/family')
  const appointment=await page.request.get('/api/consultations')
  const review=await page.request.post('/api/applications/TEST-0001/reviews',{data:{stage:'result',rating:5,comment:''}})
  expect(family.status()).toBe(401)
  expect(appointment.status()).toBe(401)
  expect(review.status()).toBe(401)
})
test('Family screen remains scoped to approved representation',async({page})=>{
  await login(page)
  await page.goto('/ho-so-gia-dinh')
  await expect(page.getByRole('heading',{name:'Hồ sơ gia đình'})).toBeVisible()
  await expect(page.getByText(/Không tự động liên kết toàn bộ hồ sơ/)).toBeVisible()
  const data=await (await page.request.get('/api/family')).json()
  expect(Array.isArray(data.members)).toBe(true)
  expect(data.members.every((m:{status:string})=>m.status==='verified')).toBe(true)
})
test('Citizen can request preferred consultation time without fake confirmation',async({page})=>{
  await login(page)
  await page.goto('/lich-tu-van')
  await expect(page.getByText(/Lịch chỉ có hiệu lực sau khi cán bộ xác nhận/)).toBeVisible()
  const categories=await (await page.request.get('/api/procedures')).json()
  test.skip(!categories.length,'Không có thủ tục được công bố')
  const target=new Date(Date.now()+4*24*60*60*1000).toISOString()
  const response=await page.request.post('/api/consultations',{data:{
    category:categories[0].category,subject:'Cần hỏi chi tiết về giấy tờ',
    description:'Tôi muốn hỏi kỹ giấy tờ cần có trước khi nộp hồ sơ.',
    channel:'phone',contactPhone:'0912345678',preferredAt:target
  }})
  expect(response.status()).toBe(201)
  const created=await response.json()
  expect(created.status).toBe('pending')
  const cancelled=await page.request.post(`/api/consultations/${created.id}/cancel`)
  expect(cancelled.ok()).toBe(true)
})
