// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Chi tiết một nhóm thủ tục và hồ sơ đã tạo cho từng thủ tục (api.citizen_service_batch của lõi).
import { citizenRpc } from '../../../utils/identity'
export default defineEventHandler(event=>{
 setHeader(event,'Cache-Control','private, no-store')
 const id=getRouterParam(event,'id')
 if(!id || !/^[0-9a-f-]{36}$/i.test(id))throw createError({statusCode:404,statusMessage:'Không tìm thấy nhóm thủ tục'})
 return citizenRpc(event,'citizen_service_batch',{p_batch_id:id})
})
