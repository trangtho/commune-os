// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { z } from 'zod'
export const loginSchema=z.object({username:z.string().min(1),password:z.string().min(1)})
export const applicationSchema=z.object({
  procedureId:z.string().min(1),applicantName:z.string().min(1),phone:z.string().optional(),
  description:z.string().optional(),formData:z.record(z.string()).optional().default({})
})
export const statusSchema=z.object({status:z.enum(['draft','submitted','processing','supplement','completed','rejected']),note:z.string().optional()})
export const supplementSchema=z.object({note:z.string().optional()})
export const publishSchema=z.object({published:z.boolean()})
export const broadcastSchema=z.object({title:z.string().min(1),body:z.string().min(1)})
export const staffSchema=z.object({username:z.string().min(3),display_name:z.string().min(1),role:z.enum(['officer','admin'])})
export function validate<T extends z.ZodTypeAny>(schema:T,body:unknown){return schema.parse(body) as z.infer<T>}
export function readableError(error:unknown){
  const e=error as {data?:{statusMessage?:string;message?:string};statusMessage?:string;message?:string;issues?:{message:string}[]}
  if(e?.issues) return e.issues.map(i=>i.message).join('; ')
  return e?.data?.statusMessage||e?.statusMessage||e?.data?.message||e?.message||'Có lỗi xảy ra. Vui lòng thử lại.'
}
