// SPDX-License-Identifier: Apache-2.0
export interface UserInfo { sub?:string; name:string;role:string;tenant_id:string|null }
export interface Procedure {code:string;name:string;version:string;sla_hours:number;required_documents:{code:string;name:string}[];form_schema:any;wiki?:string }
export interface Dossier { id:string;code:string;applicant:string;procedure_code:string;procedure_version:string;tenant_id:string;submitted_by:string;status:string;assigned_role:string;received_at:string;due_at:string;channel:string;supplement_reason:string;documents?:any[];events?:any[];form_data?:Record<string,any> }

export const roleNames:Record<string,string> = {
  citizen:'Công dân', receptionist:'Cán bộ tiếp nhận', officer:'Cán bộ xử lý',
  leader:'Lãnh đạo', supervisor:'Cấp trên – Theo dõi liên xã', sys_admin:'Quản trị hệ thống'
}
export const rolePreview:Record<string,string> = {
  citizen:'Nguyễn Thị Lan', receptionist:'Trần Minh Quân',officer:'Nguyễn Văn An',
  leader:'Lãnh đạo xã', supervisor:'Cán bộ cấp trên',sys_admin:'Quản trị viên'
}
export const statusNames:Record<string,string> = {
  submitted:'Đã nộp trực tuyến',received:'Đã tiếp nhận',in_review:'Đang thẩm định',
  need_supplement:'Cần bổ sung',pending_signature:'Chờ ký duyệt',approved:'Đã phê duyệt',
  rejected:'Đã từ chối',closed:'Đã trả kết quả'
}
export const statusClass = (s:string) => s==='need_supplement'?'warn':s==='closed'||s==='approved'?'success':s==='rejected'?'danger':s==='pending_signature'?'violet':'info'
export const fmtDate=(s?:string) => s ? new Date(s).toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—'
export const procName=(code:string, items:Procedure[])=>items.find(p=>p.code===code)?.name || code

export function useCommune() {
  const config=useRuntimeConfig()
  const user=useState<UserInfo|null>('commune-user',()=>null)
  const token=useState<string>('commune-token',()=> '')
  const loading=useState<boolean>('commune-loading',()=>false)
  const error=useState<string>('commune-error',()=> '')
  async function api<T=any>(url:string, options:any={}):Promise<T> {
    if (!token.value) throw new Error('Bạn chưa đăng nhập')
    const opts={...options,baseURL:config.public.apiBase as string,headers:{...(options.headers||{}),Authorization:`Bearer ${token.value}`}}
    return await $fetch<T>(url,opts) as T
  }
  function errText(e:any) {
    const detail=e?.data?.detail
    if(typeof detail==='string')return detail
    if(detail?.missing_documents) return 'Thiếu giấy tờ: '+detail.missing_documents.map((x:any)=>x.name).join(', ')
    if(detail?.invalid_fields?.length)return 'Trường không hợp lệ: '+detail.invalid_fields.join(', ')
    if(Array.isArray(detail))return detail.map(x=>x.msg).join('; ')
    return e?.message || 'Có lỗi xảy ra'
  }
  async function loginDemo(role:string) {
    loading.value=true;error.value=''
    try {
      const body:any=await $fetch('/api/auth/demo-login',{baseURL:config.public.apiBase as string,method:'POST',body:{role}})
      token.value=body.access_token
      user.value={sub:role,name:body.name,role:body.role,tenant_id:body.tenant_id}
      localStorage.setItem('commune-demo-token',token.value)
    } catch(e:any){error.value=errText(e)}
    finally{loading.value=false}
  }
  async function restoreDemo() {
    const saved=localStorage.getItem('commune-demo-token')
    if(!saved)return
    token.value=saved
    try {user.value=await api<UserInfo>('/api/me')}catch{token.value='';localStorage.removeItem('commune-demo-token')}
  }
  async function loginSSO() {
    loading.value=true;error.value=''
    try{
      const mod=await import('keycloak-js')
      const keycloak=new mod.default({url:config.public.oidcUrl as string,realm:config.public.oidcRealm as string,clientId:config.public.oidcClient as string})
      const ok=await keycloak.init({onLoad:'login-required',pkceMethod:'S256',checkLoginIframe:false})
      if(ok && keycloak.token){
        token.value=keycloak.token
        user.value=await api<UserInfo>('/api/me')
        keycloak.onTokenExpired=()=>{keycloak.updateToken(30).then(()=>{token.value=keycloak.token||''})}
        ;(window as any).__communeKeycloak=keycloak
      }
    }catch(e:any){error.value=errText(e)}finally{loading.value=false}
  }
  function logout(){
    token.value='';user.value=null;localStorage.removeItem('commune-demo-token')
    const kc=(window as any).__communeKeycloak
    if(kc)kc.logout({redirectUri:location.origin})
  }
  return {api,user,token,loading,error,loginDemo,loginSSO,restoreDemo,logout,errText,config}
}
