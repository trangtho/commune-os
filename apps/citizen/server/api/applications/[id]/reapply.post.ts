// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Tạo bản nháp mới từ hồ sơ đã kết thúc: lõi trả biểu mẫu gốc (api.citizen_application_reapply_source), biểu mẫu
// được lọc lại theo mẫu hiện hành (sanitizeProcedureForm), rồi lõi tạo bản nháp bằng cùng quy tắc với bản nháp mới
// (api.citizen_application_reapply → api.citizen_application_create).
import { citizenRpc } from '../../../utils/identity'
import { sanitizeProcedureForm } from '../../../../shared/procedure-forms'
export default defineEventHandler(async event=>{
  if((await readBody(event))?.confirmed!==true)
    throw createError({statusCode:400,statusMessage:'Bạn phải xác nhận trước khi tạo bản nháp mới'})
  const id=String(getRouterParam(event,'id')||'')
  const original=await citizenRpc<{procedure_id:string;form_data:Record<string,unknown>}>(event,'citizen_application_reapply_source',{p_application_id:id})
  const result=await citizenRpc(event,'citizen_application_reapply',{p_application_id:id,
    p_form_data:sanitizeProcedureForm(original.procedure_id,(original.form_data||{}) as any)})
  setResponseStatus(event,201)
  return result
})
