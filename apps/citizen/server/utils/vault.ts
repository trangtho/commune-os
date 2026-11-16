// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { z } from 'zod'
import { vaultCategories, validVaultContent, MAX_VAULT_BYTES } from '../../shared/citizen-vault'
export const documentSchema=z.object({title:z.string().trim().min(2).max(120),category:z.enum(vaultCategories.map(c=>c.value) as [string,...string[]])}).strict()
export const expirySchema=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().refine(v=>!v||!Number.isNaN(Date.parse(v)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0,10)===v,{message:'Ngày hết hạn không hợp lệ'})
export function uploadPart(parts:Awaited<ReturnType<typeof readMultipartFormData>>) {
  const file=parts?.find(p=>p.name==='file'&&p.filename)
  if(!file?.data || !file.filename || !file.type)throw createError({statusCode:400,statusMessage:'Chưa chọn tệp giấy tờ'})
  if(file.data.length<1 || file.data.length>MAX_VAULT_BYTES)throw createError({statusCode:413,statusMessage:'Giấy tờ tối đa 5 MB'})
  if(!validVaultContent(file.data,file.type))throw createError({statusCode:415,statusMessage:'Chỉ chấp nhận tệp PDF, PNG, JPG có nội dung hợp lệ'})
  return {bytes:file.data,mime:file.type,name:file.filename.replace(/[\\/\r\n\x00-\x1f]/g,'').slice(0,180)||'giay-to'}
}
export function partText(parts:NonNullable<Awaited<ReturnType<typeof readMultipartFormData>>>,name:string):string {
  return parts.find(p=>p.name===name)?.data.toString('utf8')||''
}
