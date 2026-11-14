// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { scryptSync, timingSafeEqual } from 'node:crypto'
import { publicQuery } from '../../utils/database'
import { signSession } from '../../utils/session'
import { loginSchema, validate, readableError } from '../../utils/validation'
function validPassword(password:string,hash:string){
  const [method,salt,digest]=hash.split('$')
  if(method!=='scrypt'||!salt||!digest) return false
  const current=scryptSync(password,salt,64)
  const expected=Buffer.from(digest,'hex')
  return current.length===expected.length&&timingSafeEqual(current,expected)
}
const DEMO_STAFF={id:'staff-demo-001',tenant_id:'tenant-xa-demo',display_name:'Nguyễn Văn A',role:'officer' as const,is_active:true,password_hash:'scrypt$test$test'}
export default defineEventHandler(async(event)=>{
  try {
    if(!useRuntimeConfig().public.demoMode) throw createError({statusCode:403,statusMessage:'Chế độ đăng nhập demo đã tắt; cần cấu hình OIDC'})
    const credentials=validate(loginSchema,await readBody(event))
    // Demo fallback khi PostgreSQL chưa sẵn sàng
    if(credentials.username==='canbo.demo'&&credentials.password==='Demo@2026!'){
      signSession(event,{id:DEMO_STAFF.id,tenantId:DEMO_STAFF.tenant_id,name:DEMO_STAFF.display_name,role:DEMO_STAFF.role})
      return {authenticated:true,role:DEMO_STAFF.role,name:DEMO_STAFF.display_name}
    }
    let user:typeof DEMO_STAFF|null=null
    try {
      const rows=await publicQuery<{id:string;tenant_id:string;display_name:string;password_hash:string;role:string;is_active:boolean}>(
        'SELECT * FROM staff_login_lookup($1)',[credentials.username])
      user=rows[0]??null
    } catch { user=null }
    if(!user||!user.is_active||!validPassword(credentials.password,user.password_hash)) throw createError({statusCode:401,statusMessage:'Tên đăng nhập hoặc mật khẩu không đúng'})
    signSession(event,{id:user.id,tenantId:user.tenant_id,name:user.display_name,role:user.role as 'officer'|'admin'})
    return {authenticated:true,role:user.role,name:user.display_name}
  } catch (e) {
    throw createError({statusCode:500,statusMessage:readableError(e)})
  }
})
