<script setup lang="ts">
import {Home,FilePlus2,Files,CalendarDays,CreditCard,Bell,Search,BookOpen,Bot,Star,ClipboardList,Clock3,ChartColumn,Settings,Layers3,Users,Building2,Database,ShieldCheck,Activity,LogOut,Menu,HelpCircle,ChevronDown,PanelLeftClose,ArrowRight,ClipboardCheck,BarChart3,Workflow,FileSearch,Ticket,Sun,RefreshCw} from 'lucide-vue-next'
import {roleNames,type Dossier,type Procedure} from '~/composables/useCommune'
const {user,config,api,error,loading,restoreDemo,loginSSO,logout}=useCommune()
const section=ref('home'),sidebarOpen=ref(false),allLoading=ref(false),loadError=ref(''),searchText=ref(''),searchRef=ref<HTMLInputElement|null>(null)
const dashboard=ref<any>({stats:{}}),dossiers=ref<Dossier[]>([]),procedures=ref<Procedure[]>([]),crossStats=ref<any[]>([]),appointments=ref<any[]>([]),services=ref<any>({})
const iconMap:any={home:Home,new:FilePlus2,dossiers:Files,appointments:CalendarDays,queue:Ticket,procedures:Workflow,
 knowledge:BookOpen,ai:Bot,reports:ChartColumn,feedback:Star,tenants:Building2,packs:Layers3,services:Activity,
 audit:ShieldCheck,notifications:Bell,settings:Settings,search:Search,tasks:ClipboardList}
const menuMap:Record<string,{id:string;name:string}[]>={
 citizen:[{id:'home',name:'Trang chủ'},{id:'new',name:'Nộp hồ sơ trực tuyến'},{id:'dossiers',name:'Hồ sơ của tôi'},{id:'appointments',name:'Lịch hẹn tại quầy'},{id:'queue',name:'Lấy số thứ tự'},{id:'notifications',name:'Thông báo'},{id:'procedures',name:'Tra cứu thủ tục'},{id:'knowledge',name:'Hướng dẫn & Biểu mẫu'},{id:'ai',name:'Trợ lý AI'},{id:'feedback',name:'Góp ý / Đánh giá'}],
 receptionist:[{id:'home',name:'Trang chủ'},{id:'new',name:'Tiếp nhận hồ sơ'},{id:'dossiers',name:'Hồ sơ hành chính'},{id:'appointments',name:'Lịch hẹn & Hàng chờ'},{id:'queue',name:'Gọi số thứ tự'},{id:'procedures',name:'Quy trình & Thủ tục'},{id:'reports',name:'Báo cáo quầy'},{id:'ai',name:'Trợ lý AI'},{id:'knowledge',name:'Kho tri thức (Wiki)'},{id:'notifications',name:'Thông báo'}],
 officer:[{id:'home',name:'Trang chủ'},{id:'dossiers',name:'Hồ sơ hành chính'},{id:'dossiers',name:'Công việc của tôi'},{id:'procedures',name:'Quy trình & Thủ tục'},{id:'reports',name:'Báo cáo & Điều hành'},{id:'ai',name:'Trợ lý AI'},{id:'knowledge',name:'Kho tri thức (Wiki)'},{id:'appointments',name:'Lịch làm việc & Lịch hẹn'},{id:'notifications',name:'Thông báo'},{id:'settings',name:'Cài đặt tài khoản'}],
 leader:[{id:'home',name:'Trang chủ'},{id:'dossiers',name:'Chỉ đạo & Điều hành'},{id:'dossiers',name:'Hồ sơ hành chính'},{id:'procedures',name:'Quy trình & Thủ tục'},{id:'reports',name:'Báo cáo & Thống kê'},{id:'notifications',name:'Giám sát tiến độ'},{id:'feedback',name:'Đánh giá & Chất lượng'},{id:'audit',name:'Sổ cái kiểm toán'},{id:'ai',name:'Trợ lý AI'},{id:'knowledge',name:'Kho tri thức'}],
 supervisor:[{id:'home',name:'Trang chủ'},{id:'reports',name:'Tổng hợp liên xã'},{id:'reports',name:'Theo dõi đơn vị'},{id:'reports',name:'So sánh chỉ số'},{id:'reports',name:'Báo cáo & Thống kê'},{id:'reports',name:'Phân tích dữ liệu'},{id:'notifications',name:'Cảnh báo'},{id:'ai',name:'Trợ lý AI'},{id:'knowledge',name:'Kho tri thức'},{id:'settings',name:'Cấu hình xem báo cáo'}],
 sys_admin:[{id:'home',name:'Trang chủ'},{id:'tenants',name:'Quản trị người dùng / Đơn vị'},{id:'tenants',name:'Quản lý xã / phường'},{id:'packs',name:'Gói thủ tục & Quy trình'},{id:'settings',name:'Quy tắc & Phân quyền'},{id:'services',name:'Dữ liệu & Tích hợp'},{id:'ai',name:'AI & Tri thức (RAG)'},{id:'services',name:'Giám sát & Vận hành'},{id:'reports',name:'Báo cáo & Thống kê'},{id:'audit',name:'Nhật ký & Kiểm toán'},{id:'settings',name:'Cấu hình hệ thống'}]
}
const menuItems=computed(()=>user.value?menuMap[user.value.role]||[]:[])
const sectionTitle=computed(()=>menuItems.value.find(m=>m.id===section.value)?.name||'Trang chủ')
const urgentCount=computed(()=>(dashboard.value.stats?.overdue||0)+(dossiers.value.filter(x=>x.status==='need_supplement').length))
function go(id:string){section.value=id;sidebarOpen.value=false}
function hotkey(event:KeyboardEvent){if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();searchRef.value?.focus()}}
function search(){if(searchText.value.trim())go('dossiers')}
async function loadData(){
 if(!user.value)return
 allLoading.value=true;loadError.value=''
 try{
  const role=user.value.role
  const calls:[string,Promise<any>][]=[['dashboard',api('/api/dashboard')],['procedures',api('/api/procedures')]]
  if(role!=='supervisor' && role!=='sys_admin')calls.push(['dossiers',api('/api/dossiers')],['appointments',api('/api/appointments')])
  if(['supervisor','sys_admin','leader'].includes(role))calls.push(['crossStats',api('/api/stats/communes')])
  if(role==='sys_admin')calls.push(['services',api('/api/admin/services')])
  const done=await Promise.allSettled(calls.map(async ([key,req])=>({key,data:await req})))
  done.forEach((r:any)=>{if(r.status==='fulfilled'){
   const {key,data}=r.value
   if(key==='dashboard')dashboard.value=data
   if(key==='procedures')procedures.value=data
   if(key==='dossiers')dossiers.value=data
   if(key==='appointments')appointments.value=data
   if(key==='crossStats')crossStats.value=data
   if(key==='services')services.value=data
  }else loadError.value='Một số dữ liệu chưa tải được. Kiểm tra API.'})
 }catch(e:any){loadError.value=e?.message||'Không tải được dữ liệu'}finally{allLoading.value=false}
}
watch(()=>user.value?.role,()=>{section.value='home';loadData()})
onMounted(async()=>{window.addEventListener('keydown',hotkey)
 if(String(config.public.demoMode)==='true')await restoreDemo();else if(!user.value)await loginSSO()
 if(user.value)await loadData()
})
onBeforeUnmount(()=>window.removeEventListener('keydown',hotkey))
</script>
<template>
<LoginPanel v-if="!user"/>
<div v-else class="app-shell"><div v-if="sidebarOpen" class="mobile-overlay" @click="sidebarOpen=false"></div>
 <aside class="sidebar" :class="{opened:sidebarOpen}"><div class="sidebar-brand"><div class="brand"><span class="brand-icon"><span class="leaf"></span></span><div><strong>CommuneOS</strong><small>Xã Thành Phú</small></div></div><button class="sidebar-collapse" title="Đóng menu" @click="sidebarOpen=false"><PanelLeftClose :size="22"/></button></div>
 <nav class="sidebar-nav" aria-label="Menu điều hướng chính"><button v-for="(item,i) in menuItems" :key="item.id+'-'+i" class="nav-item" :class="{active:section===item.id}" @click="go(item.id)"><component :is="iconMap[item.id]||Files" :size="22" :stroke-width="2.15"/><span>{{item.name}}</span><ChevronDown v-if="['dossiers','procedures','reports','packs','services'].includes(item.id)&&i>1" :size="15" class="nav-chevron"/></button></nav>
 <div class="sidebar-user"><div class="sidebar-divider"></div><div class="user-avatar">{{(user.name||'AD').replace('(mẫu)','').split(' ').filter(Boolean).slice(-2).map(x=>x[0]).join('').toUpperCase()}}</div><div class="sidebar-user-name"><strong>{{user.name.replace(' (mẫu)','')}}</strong><small>{{roleNames[user.role]}}</small></div><button title="Đăng xuất" class="sidebar-logout" @click="logout"><LogOut :size="21"/></button></div></aside>
 <main class="main-area"><header class="topbar"><div class="topbar-heading"><button class="mobile-menu" aria-label="Mở menu" @click="sidebarOpen=true"><Menu :size="24"/></button><div><h1>Chào mừng, {{user.name.replace(' (mẫu)','')}}!</h1><p>{{roleNames[user.role]}} – {{['supervisor','sys_admin'].includes(user.role)?'Hệ thống CommuneOS':'UBND xã Thành Phú'}}</p></div></div><div class="topbar-actions"><form class="global-search" @submit.prevent="search"><Search :size="22"/><input ref="searchRef" v-model="searchText" :placeholder="user.role==='sys_admin'?'Tìm đơn vị, gói thủ tục...':'Tìm hồ sơ, thủ tục, hướng dẫn...'"/><span>Ctrl + K</span></form><button class="header-icon" title="Thông báo" @click="go('notifications')"><Bell :size="28"/><small v-if="urgentCount">{{Math.min(urgentCount,9)}}</small></button><button class="header-icon" title="Trợ giúp và kho tri thức" @click="go('knowledge')"><HelpCircle :size="29"/></button></div></header>
  <div class="main-scroll"><div v-if="loadError" class="error-block top-error">{{loadError}} <button @click="loadData">Thử lại</button></div><div v-if="allLoading" class="loading-banner"><RefreshCw :size="16"/> Đang đồng bộ dữ liệu...</div>
   <DashboardView v-if="section==='home'" :user="user" :stats="dashboard.stats||{}" :dossiers="dossiers" :procedures="procedures" :cross-stats="crossStats" :appointments="appointments" :services="services" @refresh="loadData" @navigate="go"/>
   <SectionView v-else :section="section" :user="user" :stats="dashboard.stats||{}" :dossiers="dossiers" :procedures="procedures" :cross-stats="crossStats" :appointments="appointments" :services="services" @refresh="loadData" @navigate="go"/>
  </div></main>
</div>
</template>
