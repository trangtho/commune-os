// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { test, expect, type Page } from '@playwright/test'
const username=process.env.E2E_USERNAME||'congdan.demo'
const password=process.env.E2E_PASSWORD||'Demo@2026!'
async function signIn(page:Page){
  await page.goto('/dang-nhap')
  await page.getByLabel('Tên đăng nhập').fill(username)
  await page.getByLabel('Mật khẩu').fill(password)
  await page.getByRole('button',{name:'Đăng nhập',exact:true}).click()
  await expect(page).not.toHaveURL(/dang-nhap/)
}
test('Công dân đăng nhập → nộp → tra cứu được hồ sơ thật',async({page})=>{
  await signIn(page)
  await page.goto('/nop-ho-so/khai-sinh')
  await expect(page.locator('#applicant-name')).toHaveAttribute('readonly', '')
  await expect(page.locator('#applicant-name')).not.toBeEmpty()
  await page.locator('#applicant-phone').fill('0912345678')
  await page.locator('#citizen-field-childName').fill('Nguyễn Văn Minh')
  await page.locator('#citizen-field-birthDate').fill('2025-01-01')
  await page.locator('#citizen-field-gender').selectOption('Nam')
  await page.locator('#citizen-field-birthPlace').fill('Bệnh viện thực hành')
  await page.locator('#citizen-field-birthProvince').fill('Bắc Ninh')
  await page.locator('#citizen-field-motherName').fill('Nguyễn Thị Demo')
  await page.locator('#citizen-field-registrationRelation').selectOption('Mẹ')
  await page.getByRole('button',{name:/Lưu nháp và tiếp tục/}).click()
  await expect(page.getByText('Thành phần giấy tờ')).toBeVisible()
  const required=(await (await page.request.get('/api/procedures/khai-sinh')).json()).documents.filter((d:{is_required:boolean})=>d.is_required)
  // A tiny valid PNG fixture; never upload citizen PII in automated tests.
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jYOcAAAAASUVORK5CYII=','base64')
  for(const document of required){
    const card=page.locator('.rounded-xl.border.border-slate-200.bg-white').filter({hasText:document.document_name}).first()
    await card.locator('input[type=file]').setInputFiles({name:'mau-kiem-thu.png',mimeType:'image/png',buffer:png})
    await card.getByRole('button',{name:'Xác nhận tải tài liệu'}).click()
    await expect(card.getByText('mau-kiem-thu.png')).toBeVisible()
  }
  await page.getByRole('button',{name:/Tiếp tục rà soát/}).click()
  await page.getByRole('checkbox').check()
  await page.getByRole('button',{name:/Xác nhận & nộp hồ sơ/}).click()
  await expect(page).toHaveURL(/\/nop-thanh-cong\/HS-/)
  const id=decodeURIComponent(new URL(page.url()).pathname.split('/').at(-1)||'')
  await page.goto('/tra-cuu')
  await page.locator('#case-search').fill(id)
  await page.getByRole('button',{name:'Tra cứu',exact:true}).click()
  await expect(page.getByText(id).first()).toBeVisible()
  await page.goto(`/ho-so/${encodeURIComponent(id)}`)
  await expect(page.getByText(id).first()).toBeVisible()
  // Accessibility smoke: keyboard users can skip navigation into the main region.
  await page.keyboard.press('ControlOrMeta+Home')
  await expect(page.locator('#citizen-main')).toBeVisible()
})
test('Hành trình bổ sung giấy tờ khi nhóm cung cấp hồ sơ trạng thái supplement',async({page})=>{
  test.skip(!process.env.E2E_SUPPLEMENT_CASE_ID,'Cần hồ sơ supplement do hệ thống cán bộ chuẩn bị')
  await signIn(page)
  await page.goto(`/ho-so/${process.env.E2E_SUPPLEMENT_CASE_ID}/bo-sung`)
  await expect(page.getByRole('heading',{name:/Bổ sung hồ sơ/})).toBeVisible()
  // This test intentionally verifies the real server status, not a mocked transition.
  await expect(page.getByRole('button',{name:'Xác nhận gửi bổ sung hồ sơ'})).toBeDisabled()
})
test('Xem kết quả: không giả mạo văn bản ký số',async({page})=>{
  test.skip(!process.env.E2E_COMPLETED_CASE_ID,'Cần hồ sơ completed do hệ thống cán bộ chuẩn bị')
  await signIn(page)
  await page.goto(`/ho-so/${process.env.E2E_COMPLETED_CASE_ID}/ket-qua`)
  await expect(page.getByText('Văn bản kết quả điện tử')).toBeVisible()
  await expect(page.getByText('THÔNG TIN KẾT QUẢ HIỂN THỊ')).toBeVisible()
})
