// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Tải tệp một phiên bản giấy tờ: lõi kiểm tra quyền, quyết định lưu trữ (citizen_retention_reviews) và ghi nhật ký
// sử dụng dữ liệu cá nhân (api.citizen_vault_file); nội dung đọc từ kho đối tượng của lõi.
import { z } from 'zod'
import { getObject } from '../../../../utils/object-store'
import { citizenRpc } from '../../../../utils/identity'
import { validate } from '../../../../utils/validation'
export default defineEventHandler(async event=>{
 const id=validate(z.string().uuid(),getRouterParam(event,'id'))
 const doc=await citizenRpc<{storage_key:string;original_name:string;mime_type:string}>(event,'citizen_vault_file',{p_version_id:id})
 const data=await getObject(doc.storage_key)
 if(!data)throw createError({statusCode:404,statusMessage:'Tệp không còn tồn tại trong kho lưu trữ'})
 setResponseHeader(event,'content-type',doc.mime_type)
 setResponseHeader(event,'content-disposition',`${getQuery(event).view==='1'?'inline':'attachment'}; filename*=UTF-8''${encodeURIComponent(doc.original_name)}`)
 setResponseHeader(event,'cache-control','private, no-store')
 setResponseHeader(event,'content-security-policy',"sandbox; default-src 'none'")
 setResponseHeader(event,'x-content-type-options','nosniff')
 return data
})
