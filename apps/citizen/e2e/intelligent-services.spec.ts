// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {test,expect} from '@playwright/test'
test('Public result verification never claims success with missing token',async({page})=>{
 await page.goto('/kiem-chung-ket-qua')
 await expect(page.getByText('Thiếu hoặc sai định dạng mã tra cứu')).toBeVisible()
 await expect(page.getByText('Kiểm chứng kết quả điện tử')).toBeVisible()
})
test('Everyday-situation discovery is reachable',async({page})=>{
 await page.goto('/tim-theo-tinh-huong')
 await expect(page.getByRole('heading',{name:'Tìm thủ tục bằng tình huống thực tế'})).toBeVisible()
 await expect(page.getByRole('button',{name:'Tìm thủ tục phù hợp'})).toBeDisabled()
})
