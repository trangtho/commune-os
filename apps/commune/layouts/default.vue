<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { Home,FolderOpen,Search,Bell,UserRound,ChevronDown,FileText,ShieldCheck,Building2,Menu,LogOut,CheckCircle2,FilePlus2,ClipboardList,Users,BarChart3,Settings,AlertCircle } from 'lucide-vue-next'
import type { Application,ApplicationStatus,Notice,Staff } from '~/types/models'
const route=useRoute();const showMobile=ref(false)
const mainScroll=ref<HTMLElement|null>(null)
const {data:auth,refresh:refreshAuth}=await useAsyncData('staff-auth',()=>useRequestFetch()<{authenticated:boolean;name?:string;role?:string}>('/api/auth/me'),{default:()=>({authenticated:false})})
const {data:headerNotices,refresh:refreshHeaderNotices,clear:clearHeaderNotices}=await useFetch<Notice[]>('/api/notifications',{
  key:'staff-notifications-badge',immediate:Boolean(auth.value?.authenticated)
})
const unreadCount=computed(()=>headerNotices.value?.filter(n=>!n.is_read).length||0)
watch(()=>auth.value?.authenticated,(loggedIn)=>{
  if(loggedIn) void refreshHeaderNotices()
  else clearHeaderNotices()
})
const nav=[{to:'/',name:'Tổng quan',icon:Home},{to:'/ho-so',name:'Quản lý hồ sơ',icon:FolderOpen},{to:'/thu-tuc',name:'Danh mục thủ tục',icon:ClipboardList},{to:'/thong-bao',name:'Thông báo',icon:Bell},{to:'/bao-cao',name:'Báo cáo',icon:BarChart3},{to:'/tai-khoan',name:'Nhân viên',icon:Users}]
const header=computed(()=>({
  '/':'Tổng quan hoạt động','/ho-so':'Quản lý hồ sơ hành chính','/thu-tuc':'Danh mục thủ tục hành chính',
  '/thong-bao':'Thông báo & công khai','/bao-cao':'Báo cáo thống kê','/tai-khoan':'Quản lý nhân viên'
})[route.path]||(route.path.startsWith('/ho-so/')?'Chi tiết hồ sơ':route.path.startsWith('/thu-tuc/')?'Chi tiết thủ tục':'Bảng quản trị cán bộ'))
const description=computed(()=>route.path==='/'?'Theo dõi tình trạng hồ sơ, duyệt và giải quyết đơn từ công dân.':route.path.startsWith('/ho-so/')?'Xem chi tiết, cập nhật tiến độ và xử lý hồ sơ.':'Quản trị minh bạch, an toàn với dữ liệu mô phỏng.')
function isActive(path:string){return path==='/'?route.path==='/':route.path===path||route.path.startsWith(`${path}/`)}
watch(()=>route.path,async()=>{
  showMobile.value=false
  await nextTick()
  if (mainScroll.value) mainScroll.value.scrollTop=0
})
async function logout(){await $fetch('/api/auth/logout',{method:'POST'});await refreshAuth();await navigateTo('/dang-nhap')}
</script>
<template>
 <div class="commune-app-shell flex h-[100dvh] min-h-0 w-full max-w-full flex-col overflow-hidden">
  <header class="relative z-40 shrink-0 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
   <div class="mx-auto flex h-[64px] w-full max-w-[1850px] items-center gap-1 px-2 sm:h-[68px] sm:gap-3 sm:px-4 xl:px-7">
    <NuxtLink to="/" class="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-3" aria-label="CommuneOS – về trang chủ">
     <span class="flex shrink-0 items-center gap-1 sm:gap-2">
      <img src="/images/logo-bo-cong-an.png" alt="Biểu trưng Bộ Công an" width="420" height="420" class="commune-brand-logo" />
      <img src="/images/logo-hoc-vien-ky-thuat-cong-nghe-an-ninh.png" alt="Biểu trưng Học viện Kỹ thuật và Công nghệ An ninh" width="420" height="420" class="commune-brand-logo" />
     </span>
     <span class="min-w-0 leading-tight max-[359px]:hidden">
      <span class="block text-[15px] font-black tracking-tight text-brand-800 sm:text-[22px]">CommuneOS</span>
      <span class="hidden text-[10px] font-semibold text-brand-900 sm:block sm:text-xs">Bảng quản trị cán bộ · Cấp xã</span>
     </span>
    </NuxtLink>
    <div class="mx-3 hidden h-9 border-l border-slate-300 2xl:block"/><p class="hidden whitespace-nowrap text-[13px] font-semibold text-slate-700 2xl:block">Bảng quản trị cán bộ quản lý</p>
    <nav class="ml-auto hidden min-w-0 items-center gap-0.5 2xl:flex"><NuxtLink v-for="item in nav" :key="item.to" :to="item.to" :class="['nav-link',isActive(item.to)?'nav-link-active':'']"><component :is="item.icon" :size="17"/>{{item.name}}</NuxtLink></nav>
    <div class="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-2 2xl:ml-1"><NuxtLink to="/thong-bao" class="relative rounded-lg p-1.5 text-brand-800 hover:bg-brand-50 sm:p-2" :aria-label="'Thông báo' + (unreadCount ? ', '+unreadCount+' chưa đọc' : '')"><Bell :size="21"/><span v-if="auth?.authenticated && unreadCount" class="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-black text-white" aria-live="polite">{{unreadCount>99?'99+':unreadCount}}</span></NuxtLink><NuxtLink v-if="!auth?.authenticated" to="/dang-nhap" class="btn-outline !px-2 sm:!px-4" aria-label="Đăng nhập"><LogOut :size="16"/><span class="hidden sm:inline">Đăng nhập</span></NuxtLink><div v-else class="group relative"><button class="flex items-center gap-1 rounded-lg px-1 py-1.5 hover:bg-brand-50 sm:gap-2 sm:px-2"><span class="grid h-8 w-8 place-items-center rounded-full bg-brand-100 text-brand-700 sm:h-9 sm:w-9"><UserRound :size="19"/></span><span class="hidden max-w-32 truncate text-left text-sm font-bold xl:block">{{auth.name}}<small class="block text-[11px] font-normal text-slate-500">{{auth?.role==='admin'?'Quản trị viên':'Cán bộ xử lý'}}</small></span><ChevronDown class="hidden sm:block" :size="15"/></button><div class="invisible absolute right-0 w-52 rounded-xl border bg-white p-1 shadow-lg group-hover:visible group-focus-within:visible"><NuxtLink to="/tai-khoan" class="side-link"><Users :size="16"/>Quản lý nhân viên</NuxtLink><NuxtLink to="/bao-cao" class="side-link"><BarChart3 :size="16"/>Báo cáo thống kê</NuxtLink><button class="side-link w-full text-left" @click="logout"><LogOut :size="16"/>Đăng xuất</button></div></div><button class="rounded-lg border p-1.5 sm:p-2 2xl:hidden" aria-label="Mở menu" aria-controls="commune-mobile-menu" :aria-expanded="showMobile" @click="showMobile=!showMobile"><Menu :size="21"/></button></div>
   </div>
   <nav v-if="showMobile" id="commune-mobile-menu" class="scrollbar-hide absolute inset-x-0 top-full z-50 grid max-h-[min(65svh,440px)] grid-cols-1 gap-1 overflow-y-auto border-t bg-white p-2 shadow-xl sm:grid-cols-2 sm:p-3 2xl:hidden" aria-label="Điều hướng trên điện thoại"><NuxtLink v-for="item in nav" :key="item.to" :to="item.to" class="side-link" @click="showMobile=false"><component :is="item.icon" :size="16"/>{{item.name}}</NuxtLink></nav>
  </header>
  <section class="hero-gradient hero-pattern relative z-10 isolate shrink-0 overflow-hidden text-white">
   <div class="pointer-events-none absolute inset-y-0 right-0 hidden w-[74%] opacity-60 sm:block lg:w-[60%] lg:opacity-80"><img src="/images/ubnd-hero-clean.png" alt="Hình minh họa trụ sở UBND xã" class="hero-building h-full w-full object-cover object-right object-top"/></div>
   <div class="relative mx-auto w-full max-w-[1850px] px-3 pb-3 pt-4 sm:px-5 sm:pb-4 sm:pt-5 lg:px-8 lg:pt-6"><div class="relative z-10 mb-3 max-w-[min(100%,920px)] sm:mb-4"><h1 class="commune-hero-title max-w-full text-[clamp(1.25rem,2.35vw,2.35rem)] font-extrabold leading-[1.2] tracking-tight text-white drop-shadow-sm">{{header}}</h1><p class="mt-2 max-w-[760px] text-xs leading-snug text-blue-50 sm:text-sm lg:text-[15px]">{{description}}</p></div></div>
  </section>
  <div class="commune-workspace mx-auto grid min-h-0 w-full max-w-[1850px] min-w-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] gap-4 overflow-hidden px-3 py-3 sm:px-5 xl:grid-cols-[220px_minmax(0,1fr)] xl:gap-5 2xl:grid-cols-[240px_minmax(0,1fr)_300px]">
   <aside class="commune-inner-scroll scrollbar-hide hidden min-h-0 min-w-0 self-stretch overflow-y-auto overscroll-contain rounded-2xl border border-[#dce7f6] bg-white p-3 xl:block"><div class="space-y-1 my-2"><NuxtLink v-for="item in nav" :key="item.to" :to="item.to" :class="['side-link',isActive(item.to)?'side-link-active':'']"><component :is="item.icon" :size="18"/><span class="flex-1">{{item.name}}</span></NuxtLink></div><div class="my-4 border-b border-slate-100"/><p class="mt-9 rounded-lg bg-brand-50 p-3 text-xs leading-relaxed text-brand-800">Dữ liệu trong bản dựng này đều là dữ liệu giả lập, không phải hồ sơ hành chính có giá trị pháp lý.</p></aside>
   <main ref="mainScroll" class="commune-inner-scroll scrollbar-hide min-h-0 min-w-0 max-w-full overflow-x-hidden overflow-y-auto overscroll-contain pb-5 pr-1" tabindex="0" aria-label="Nội dung chính, cuộn để xem thêm"><slot/></main>
   <aside class="commune-inner-scroll scrollbar-hide hidden min-h-0 min-w-0 self-stretch space-y-3 overflow-y-auto overscroll-contain 2xl:block">
    <section class="panel overflow-hidden" aria-labelledby="commune-support-title">
     <img src="/images/support.png" alt="Hướng dẫn cán bộ quản trị" class="h-36 w-full bg-brand-50 object-cover" />
     <div class="p-4">
      <div class="flex items-start gap-3">
       <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-100 text-brand-700"><ShieldCheck :size="22"/></span>
       <div class="min-w-0"><h3 id="commune-support-title" class="text-lg font-extrabold text-brand-900">Hướng dẫn xử lý hồ sơ</h3><p class="mt-1 text-xs leading-relaxed text-slate-600">Quy trình duyệt, giải quyết và trả kết quả hồ sơ hành chính số.</p></div>
      </div>
      <ul class="mt-4 space-y-2 border-t border-blue-100 pt-3 text-xs leading-relaxed text-brand-900">
       <li class="flex items-start gap-2"><CheckCircle2 :size="15" class="mt-0.5 shrink-0 text-emerald-600"/> Duyệt hồ sơ đã nộp</li>
       <li class="flex items-start gap-2"><CheckCircle2 :size="15" class="mt-0.5 shrink-0 text-emerald-600"/> Yêu cầu bổ sung giấy tờ</li>
       <li class="flex items-start gap-2"><CheckCircle2 :size="15" class="mt-0.5 shrink-0 text-emerald-600"/> Hoàn thành và trả kết quả</li>
      </ul>
      <NuxtLink to="/thu-tuc" class="side-link mt-3 !px-0"><ClipboardList :size="17"/>Xem danh mục thủ tục<ChevronDown class="ml-auto -rotate-90" :size="15"/></NuxtLink>
      <NuxtLink to="/bao-cao" class="btn-primary mt-2 flex w-full items-center justify-center gap-2 !text-xs"><BarChart3 :size="16"/>Xem báo cáo<FilePlus2 :size="15"/></NuxtLink>
      <p class="mt-3 text-center text-[11px] leading-relaxed text-slate-500">Kênh hướng dẫn mô phỏng · Chưa xử lý yêu cầu hành chính thật</p>
     </div>
    </section>
   </aside>
  </div>
  <footer class="hidden shrink-0 border-t border-slate-200 bg-white px-4 py-1 text-center text-[10px] text-slate-500 2xl:block">CommuneOS Open-Core · Bản mô phỏng chức năng quản trị · PostgreSQL · Nuxt + Tailwind CSS · Apache-2.0</footer>
 </div>
</template>
