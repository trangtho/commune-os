// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Xác nhận đã rà soát phiên bản thủ tục mới cho bản nháp (api.citizen_procedure_change_ack của lõi; lõi khóa thủ tục,
// kiểm tra currentId!==body.currentVersionId thì từ chối).
import {z} from 'zod'
import {citizenRpc} from '../../../../utils/identity'
import {validate} from '../../../../utils/validation'
export default defineEventHandler(async event=>{
 const body=validate(z.object({currentVersionId:z.string().uuid(),reviewed:z.literal(true)}).strict(),await readBody(event))
 return citizenRpc(event,'citizen_procedure_change_ack',{p_application_id:String(getRouterParam(event,'id')),p_current_version_id:body.currentVersionId})
})
