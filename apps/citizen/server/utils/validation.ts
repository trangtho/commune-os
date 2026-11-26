// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { z } from 'zod'
import { phoneIssue } from '../../shared/identity-validation'
export const loginSchema=z.object({username:z.string().trim().min(3).max(100), password:z.string().min(1).max(128)})
// Đăng ký tài khoản công dân; dịch vụ tài khoản của lõi kiểm tra lại toàn bộ.
export const registerSchema=z.object({
  fullName:z.string().trim().min(2,'Họ tên từ 2 đến 100 ký tự').max(100,'Họ tên từ 2 đến 100 ký tự'),
  username:z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9._-]{2,49}$/,'Tên đăng nhập 3–50 ký tự: chữ thường không dấu, số, dấu chấm, gạch'),
  contact:z.string().trim().min(1,'Nhập email hoặc số điện thoại').max(100),
  tenantCode:z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/,'Chọn xã cư trú'),
  password:z.string().min(8,'Mật khẩu tối thiểu 8 ký tự').max(64,'Mật khẩu tối đa 64 ký tự')
    .refine(v=>/[A-Za-z]/.test(v)&&/[0-9]/.test(v),{message:'Mật khẩu phải có cả chữ và số'}),
  consent:z.literal(true,{errorMap:()=>({message:'Cần đồng ý cho phép xử lý dữ liệu cá nhân để đăng ký'})}),
})
export const applicationSchema=z.object({
  representationId:z.string().uuid().nullable().optional(), receivingTenantId:z.string().uuid().optional(), procedureId:z.string().regex(/^[a-z0-9-]{2,80}$/), applicantName:z.string().trim().min(2).max(100),
  phone:z.string().trim().max(20).refine(value => !phoneIssue(value), {message:'Số điện thoại không hợp lệ'}).default(''), description:z.string().max(500).default(''),
  formData:z.record(z.string().max(500)).default({})
})
export const messageSchema=z.object({message:z.string().trim().min(5).max(2000)})
export function validate<T>(schema:z.ZodType<T>,input:unknown):T {const parsed=schema.safeParse(input);if(!parsed.success)throw createError({statusCode:400,statusMessage:parsed.error.issues[0]?.message||'Dữ liệu không hợp lệ'});return parsed.data}
