// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { scryptSync, timingSafeEqual } from 'node:crypto'
import { publicQuery } from '../../utils/database'
import { signSession } from '../../utils/session'
import { loginSchema, validate } from '../../utils/validation'
function validPassword(password:string,hash:string){
  const [method,salt,digest]=hash.split('$')
  if(method!=='scrypt'||!salt||!digest) return false
  const current=scryptSync(password,salt,64)
  const expected=Buffer.from(digest,'hex')
  return current.length===expected.length&&timingSafeEqual(current,expected)
}
export default defineEventHandler(async(event)=>{
  if(!useRuntimeConfig().public.demoMode) throw createError({statusCode:403,statusMessage:'Chế độ đăng nhập demo đã tắt; cần cấu hình OIDC'})
  const credentials=validate(loginSchema,await readBody(event))
  const rows=await publicQuery<{id:string;tenant_id:string;display_name:string;password_hash:string}>(
    'SELECT * FROM citizen_login_lookup($1)',[credentials.username])
  const user=rows[0]
  if(!user||!validPassword(credentials.password,user.password_hash)) throw createError({statusCode:401,statusMessage:'Tên đăng nhập hoặc mật khẩu không đúng'})
  signSession(event,{id:user.id,tenantId:user.tenant_id,name:user.display_name})
  return {authenticated:true,role:'citizen',name:user.display_name}
})
