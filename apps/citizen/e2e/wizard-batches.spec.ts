// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {test,expect,type Page} from '@playwright/test'
async function login(page:Page){
 await page.goto('/dang-nhap')
 await page.getByLabel('Tên đăng nhập').fill(process.env.E2E_USERNAME||'congdan.demo')
 await page.getByLabel('Mật khẩu').fill(process.env.E2E_PASSWORD||'Demo@2026!')
 await page.getByRole('button',{name:'Đăng nhập',exact:true}).click()
 await expect(page).not.toHaveURL(/\/dang-nhap/)
}
test('Bộ câu hỏi đưa ra gợi ý có giới hạn và dẫn đến thủ tục hiện có',async({page})=>{
 await page.goto('/goi-y-thu-tuc')
 await page.getByRole('radio',{name:'Đăng ký khai sinh cho trẻ'}).check()
 await page.getByRole('button',{name:'Tiếp tục'}).click()
 await page.getByRole('radio',{name:'Trẻ em'}).check()
 await page.getByRole('button',{name:'Tiếp tục'}).click()
 await page.getByRole('radio',{name:'Nơi thường trú'}).check()
 await page.getByRole('button',{name:'Tiếp tục'}).click()
 await page.getByRole('radio',{name:'Thực hiện lần đầu'}).check()
 await page.getByRole('button',{name:'Xem kết quả gợi ý'}).click()
 await expect(page.getByText('Đăng ký khai sinh',{exact:true})).toBeVisible()
 await expect(page.getByText(/chưa có quy tắc nghiệp vụ được xác minh/)).toBeVisible()
 await expect(page.getByRole('link',{name:/Xem chi tiết/})).toHaveAttribute('href','/thu-tuc/khai-sinh')
})
test('Nhóm hồ sơ lưu trên tài khoản, mỗi thủ tục được chuẩn bị riêng',async({page})=>{
 const methods=await (await page.request.get('/api/auth/methods')).json()
 test.skip(!methods.demo,'Requires demo login')
 await login(page)
 await page.goto('/lien-thong')
 const name=`Nhóm hồ sơ kiểm thử ${Date.now()}`
 await page.getByPlaceholder('Ví dụ: Hồ sơ gia đình tháng 11').fill(name)
 await page.getByText('Đăng ký khai sinh',{exact:true}).click()
 await page.getByText('Xác nhận thông tin cư trú',{exact:true}).click()
 await page.getByRole('button',{name:/Tạo nhóm và chuẩn bị hồ sơ/}).click()
 await expect(page).toHaveURL(/\/lien-thong\/[0-9a-f-]{36}/)
 await expect(page.getByText(name)).toBeVisible()
 await expect(page.getByText('0/2').first()).toBeVisible()
 await page.reload()
 await expect(page.getByText(name)).toBeVisible()
 await expect(page.getByText(/không phải thủ tục liên thông đã được phê duyệt/)).toBeVisible()
})
