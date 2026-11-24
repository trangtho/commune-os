// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Nhật ký sử dụng dữ liệu cá nhân, kiểm tra toàn bộ chuỗi mã băm (api.citizen_data_access của lõi).
import {citizenRpc} from '../../../utils/identity'
export default defineEventHandler(event=>{
 setHeader(event,'Cache-Control','private, no-store')
 return citizenRpc(event,'citizen_data_access')
})
