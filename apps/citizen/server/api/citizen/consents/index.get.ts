// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Mục đích xử lý dữ liệu, quyết định đồng ý hiện tại và lịch sử (api.citizen_consents của lõi).
import {citizenRpc} from '../../../utils/identity'
export default defineEventHandler(event=>{
 setHeader(event,'Cache-Control','private, no-store')
 return citizenRpc(event,'citizen_consents')
})
