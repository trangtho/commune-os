// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Không gian quản lý hành chính cá nhân: lõi trả dữ liệu và ghi nhật ký sử dụng (api.citizen_workspace);
// gợi ý công việc tiếp theo dùng mã dùng chung.
import {citizenRpc} from '../../../utils/identity'
import {followupTasks} from '../../../../shared/life-journey.mjs'
export default defineEventHandler(async event=>{
 setHeader(event,'Cache-Control','private, no-store')
 const w=await citizenRpc<{cases:any[]}&Record<string,unknown>>(event,'citizen_workspace')
 return {...w,nextActions:followupTasks(w.cases).slice(0,12),
  notice:'Dữ liệu chỉ thuộc tài khoản đang đăng nhập. Gợi ý công việc dựa trên trạng thái thực tế; không tự khởi tạo hoặc nộp hồ sơ.'}
})
