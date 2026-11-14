// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {test,expect,type Page} from '@playwright/test'
const username=process.env.E2E_USERNAME||'congdan.demo'
const password=process.env.E2E_PASSWORD||'Demo@2026!'
async function signIn(page:Page){
 await page.goto('/dang-nhap')
 await page.getByLabel('Tên đăng nhập').fill(username)
 await page.getByLabel('Mật khẩu').fill(password)
 await page.getByRole('button',{name:'Đăng nhập',exact:true}).click()
 await expect(page).not.toHaveURL(/\/dang-nhap/)
}
test('Tài khoản công dân gửi, xem lại và phản hồi yêu cầu hỗ trợ',async({page})=>{
 await signIn(page)
 await page.goto('/yeu-cau-ho-tro')
 await page.locator('#new-ticket-category').selectOption('huong-dan')
 const title=`Cần hỗ trợ kiểm thử ${Date.now()}`
 await page.locator('#new-ticket-subject').fill(title)
 await page.locator('#new-ticket-message').fill('Tôi muốn được giải thích cách chuẩn bị giấy tờ thủ tục.')
 await page.getByRole('button',{name:'Gửi yêu cầu hỗ trợ'}).click()
 await expect(page).toHaveURL(/\/yeu-cau-ho-tro\/[0-9a-f-]+/)
 await expect(page.getByRole('heading',{name:title})).toBeVisible()
 await expect(page.getByText('Đã ghi nhận').first()).toBeVisible()
 await page.locator('#ticket-reply').fill('Tôi cần cán bộ tư vấn thêm về thời gian giải quyết.')
 await page.getByRole('button',{name:'Gửi phản hồi'}).click()
 await expect(page.getByText('Tôi cần cán bộ tư vấn thêm về thời gian giải quyết.')).toBeVisible()
 await page.goto('/yeu-cau-ho-tro')
 await expect(page.getByText(title)).toBeVisible()
})
test('Mã chuyển tiếp chỉ được tạo cho hồ sơ nháp, được thu hồi trước khi tiếp nhận',async({page})=>{
 test.skip(!process.env.E2E_DRAFT_CASE_ID,'Cần mã hồ sơ nháp thuộc tài khoản công dân thử nghiệm')
 await signIn(page)
 await page.goto(`/chuyen-tiep?case=${encodeURIComponent(process.env.E2E_DRAFT_CASE_ID!)}`)
 await expect(page.getByRole('heading',{name:/Chuyển tiếp hồ sơ đến quầy/})).toBeVisible()
 await page.getByRole('button',{name:'Tạo mã chuyển tiếp'}).click()
 await expect(page.locator('#handoff-issued')).toHaveValue(/^[A-Z0-9_-]{32}$/)
 page.once('dialog',dialog=>dialog.accept())
 await page.getByRole('button',{name:'Thu hồi'}).first().click()
 await expect(page.getByText('Đã thu hồi')).toBeVisible()
})
