// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { z } from 'zod'
import { phoneIssue } from '../../shared/identity-validation'
export const loginSchema=z.object({username:z.string().trim().min(3).max(100), password:z.string().min(1).max(128)})
export const applicationSchema=z.object({
  representationId:z.string().uuid().nullable().optional(), receivingTenantId:z.string().uuid().optional(), procedureId:z.string().regex(/^[a-z0-9-]{2,80}$/), applicantName:z.string().trim().min(2).max(100),
  phone:z.string().trim().max(20).refine(value => !phoneIssue(value), {message:'Số điện thoại không hợp lệ'}).default(''), description:z.string().max(500).default(''),
  formData:z.record(z.string().max(500)).default({})
})
export const messageSchema=z.object({message:z.string().trim().min(5).max(2000)})
export function validate<T>(schema:z.ZodType<T>,input:unknown):T {const parsed=schema.safeParse(input);if(!parsed.success)throw createError({statusCode:400,statusMessage:parsed.error.issues[0]?.message||'Dữ liệu không hợp lệ'});return parsed.data}
