// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {test,expect,type Page} from '@playwright/test'
async function signIn(page:Page){
 await page.goto('/dang-nhap')
 const methods=await (await page.request.get('/api/auth/methods')).json()
 test.skip(!methods.demo,'Bài thử nghiệm yêu cầu chế độ đăng nhập demo trên môi trường test')
 await page.getByLabel('Tên đăng nhập').fill(process.env.E2E_USERNAME||'congdan.demo')
 await page.getByLabel('Mật khẩu').fill(process.env.E2E_PASSWORD||'Demo@2026!')
 await page.getByRole('button',{name:'Đăng nhập',exact:true}).click()
 await expect(page).not.toHaveURL(/dang-nhap/)
}
test('Trang thủ tục thể hiện phiên bản và cảnh báo nguồn chưa xác minh',async({page})=>{
 await page.goto('/thu-tuc/chung-thuc')
 await expect(page.getByRole('heading',{name:'Phiên bản và nguồn công bố'})).toBeVisible()
 await expect(page.getByText(/Phiên bản 1/)).toBeVisible()
 await expect(page.getByText(/dữ liệu mô phỏng chưa xác minh nguồn/i)).toBeVisible()
 await page.getByRole('button',{name:/Xem lịch sử cập nhật/}).click()
 await expect(page.getByText(/Bản 1/)).toBeVisible()
})
test('Công dân xem nhật ký, cấp rồi rút quyền và gửi yêu cầu dữ liệu',async({page})=>{
 await signIn(page)
 await page.goto('/nhat-ky-du-lieu')
 await expect(page.getByRole('heading',{name:'Nhật ký sử dụng dữ liệu cá nhân'})).toBeVisible()
 await page.goto('/quyen-chia-se')
 await expect(page.getByRole('heading',{name:'Trung tâm quyền chia sẻ dữ liệu'})).toBeVisible()
 const purpose=page.getByRole('article').filter({hasText:'Tái sử dụng giấy tờ trong hồ sơ mới'})
 const grant=purpose.getByRole('button',{name:'Cấp sự đồng ý'})
 if(await grant.isVisible()){
  await grant.click()
  await purpose.getByRole('button',{name:'Xác nhận cấp quyền'}).click()
  await expect(purpose.getByText('Đã đồng ý')).toBeVisible()
 }
 await purpose.getByRole('button',{name:'Rút sự đồng ý'}).click()
 await purpose.getByRole('button',{name:'Xác nhận rút quyền'}).click()
 await expect(purpose.getByText('Chưa đồng ý / Đã rút')).toBeVisible()
 await page.goto('/vong-doi-du-lieu')
 await expect(page.getByRole('heading',{name:'Vòng đời và lưu trữ dữ liệu'})).toBeVisible()
 await page.locator('#privacy-request-details').fill('Xin kiểm tra lại thời hạn lưu giữ giấy tờ thử nghiệm của tôi.')
 await page.getByRole('button',{name:'Gửi yêu cầu'}).click()
 await expect(page.getByText('Đã tiếp nhận yêu cầu.')).toBeVisible()
})
