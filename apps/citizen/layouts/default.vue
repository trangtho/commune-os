<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { Home,FilePlus2,FolderOpen,Search,Bell,UserRound,ChevronDown,BookOpen,Building2,Baby,House,Store,Layers3,ShieldCheck,Headset,Menu,LogIn,LogOut,CheckCircle2,UploadCloud,FileText,ArrowRight } from 'lucide-vue-next'
import type { Notice } from '~/types/models'
const route=useRoute();const showMobile=ref(false)
const mainScroll=ref<HTMLElement|null>(null)
const {data:auth,refresh:refreshAuth}=await useAsyncData('citizen-auth',()=>useRequestFetch()<{authenticated:boolean;name?:string}>('/api/auth/me'),{default:()=>({authenticated:false})})
// The badge has its own cache to avoid conflicting page-level fetch options.
const {data:headerNotices,refresh:refreshHeaderNotices,clear:clearHeaderNotices}=await useFetch<Notice[]>('/api/notifications',{
  key:'citizen-notifications-badge',immediate:Boolean(auth.value?.authenticated)
})
const unreadCount=computed(()=>headerNotices.value?.filter(n=>!n.is_read).length||0)
watch(()=>auth.value?.authenticated,(loggedIn)=>{
  if(loggedIn) void refreshHeaderNotices()
  else clearHeaderNotices()
})
const nav=[{to:'/',name:'Trang chủ',icon:Home},{to:'/thu-tuc',name:'Nộp hồ sơ trực tuyến',icon:FilePlus2},{to:'/ho-so',name:'Hồ sơ của tôi',icon:FolderOpen},{to:'/tra-cuu',name:'Tra cứu tiến độ',icon:Search},{to:'/thong-bao',name:'Thông báo',icon:Bell}]
const mobileExtras=[{to:'/huong-dan',name:'Hướng dẫn sử dụng',icon:BookOpen},{to:'/lien-he',name:'Liên hệ hỗ trợ',icon:Headset},{to:'/ho-so-ca-nhan',name:'Hồ sơ cá nhân',icon:UserRound}]
const categories=[{name:'Tất cả lĩnh vực',icon:Layers3,to:'/thu-tuc'}, {name:'Hộ tịch',icon:Baby,to:'/thu-tuc?category=Hộ tịch'},{name:'Cư trú',icon:House,to:'/thu-tuc?category=Cư trú'},{name:'Kinh doanh',icon:Store,to:'/thu-tuc?category=Kinh doanh'},{name:'Đất đai – Xây dựng',icon:Building2,to:'/thu-tuc?category=Đất đai – Xây dựng'},{name:'Chứng thực',icon:ShieldCheck,to:'/thu-tuc?category=Chứng thực'}]
const header=computed(()=>({
 '/':'Cổng dịch vụ hành chính công cấp xã','/thu-tuc':'Danh mục thủ tục hành chính','/ho-so':'Hồ sơ của tôi',
 '/tra-cuu':'Tra cứu tiến độ hồ sơ','/thong-bao':'Thông báo','/tro-ly':'Trợ lý hướng dẫn','/huong-dan':'Hướng dẫn sử dụng','/ho-so-ca-nhan':'Hồ sơ cá nhân','/bao-mat':'Bảo mật tài khoản','/lien-he':'Liên hệ và phản hồi'
})[route.path]||(route.path.startsWith('/thu-tuc/')?'Chi tiết thủ tục':route.path.startsWith('/nop-ho-so/')?'Nộp hồ sơ trực tuyến':route.path.includes('/bo-sung')?'Bổ sung hồ sơ':route.path.includes('/ket-qua')?'Nhận kết quả điện tử':route.path.startsWith('/ho-so/')?'Chi tiết hồ sơ':'Dịch vụ công dân'))
const description=computed(()=>route.path==='/'?'Nộp hồ sơ trực tuyến, theo dõi tiến độ và nhận kết quả một cách minh bạch.':route.path.startsWith('/nop-ho-so/')?'Khai báo thông tin, tải tài liệu, rà soát và gửi hồ sơ.':'Thao tác thuận tiện, theo dõi minh bạch và an toàn với dữ liệu mô phỏng.')
const steps=computed(()=>[
  {title:'Chọn thủ tục',desc:'Tìm và chọn thủ tục cần thực hiện',icon:FileText},
  {title:'Điền thông tin',desc:'Khai báo đầy đủ theo mẫu',icon:FilePlus2},
  {title:'Tải tài liệu',desc:'Đính kèm giấy tờ theo yêu cầu',icon:UploadCloud},
  {title:'Xác nhận & nộp',desc:'Kiểm tra và gửi hồ sơ',icon:CheckCircle2},
  ...(route.path==='/'?[{title:'Theo dõi kết quả',desc:'Tra cứu, nhận kết quả điện tử',icon:FolderOpen}]:[])
])
const currentStep=computed(()=>Number(route.query.step)|| (route.path.startsWith('/nop-ho-so/')?2:1))
function isActive(path:string){return path==='/'?route.path==='/':route.path===path||route.path.startsWith(`${path}/`)}
// The browser viewport stays still; reset only the inner reading area on navigation.
watch(()=>route.path,async()=>{
  showMobile.value=false
  await nextTick()
  if (mainScroll.value) mainScroll.value.scrollTop=0
})
async function logout(){await $fetch('/api/auth/logout',{method:'POST'});await refreshAuth();await navigateTo('/dang-nhap')}
</script>
<template>
 <div class="citizen-app-shell flex h-[100dvh] min-h-0 w-full max-w-full flex-col overflow-hidden">
  <header class="relative z-40 shrink-0 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
   <div class="mx-auto flex h-[64px] w-full max-w-[1850px] items-center gap-1 px-2 sm:h-[68px] sm:gap-3 sm:px-4 xl:px-7">
    <NuxtLink to="/" class="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-3" aria-label="CommuneOS – về trang chủ">
     <span class="flex shrink-0 items-center gap-1 sm:gap-2">
      <img src="/images/logo-bo-cong-an.png" alt="Biểu trưng Bộ Công an" width="420" height="420" class="citizen-brand-logo" />
      <img src="/images/logo-hoc-vien-ky-thuat-cong-nghe-an-ninh.png" alt="Biểu trưng Học viện Kỹ thuật và Công nghệ An ninh" width="420" height="420" class="citizen-brand-logo" />
     </span>
     <span class="min-w-0 leading-tight max-[359px]:hidden">
      <span class="block text-[15px] font-black tracking-tight text-brand-800 sm:text-[22px]">CommuneOS</span>
      <span class="hidden text-[10px] font-semibold text-brand-900 sm:block sm:text-xs">Chính quyền số cấp xã</span>
     </span>
    </NuxtLink>
    <div class="mx-3 hidden h-9 border-l border-slate-300 2xl:block"/><p class="hidden whitespace-nowrap text-[13px] font-semibold text-slate-700 2xl:block">Cổng dịch vụ hành chính công cấp xã</p>
    <nav class="ml-auto hidden min-w-0 items-center gap-0.5 2xl:flex"><NuxtLink v-for="item in nav" :key="item.to" :to="item.to" :class="['nav-link',isActive(item.to)?'nav-link-active':'']"><component :is="item.icon" :size="17"/>{{item.name}}</NuxtLink></nav>
    <div class="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-2 2xl:ml-1"><NuxtLink to="/thong-bao" class="relative rounded-lg p-1.5 text-brand-800 hover:bg-brand-50 sm:p-2" :aria-label="'Thông báo' + (unreadCount ? ', '+unreadCount+' chưa đọc' : '')"><Bell :size="21"/><span v-if="auth?.authenticated && unreadCount" class="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-black text-white" aria-live="polite">{{unreadCount>99?'99+':unreadCount}}</span></NuxtLink><NuxtLink v-if="!auth?.authenticated" to="/dang-nhap" class="btn-outline !px-2 sm:!px-4" aria-label="Đăng nhập"><LogIn :size="16"/><span class="hidden sm:inline">Đăng nhập</span></NuxtLink><div v-else class="group relative"><button class="flex items-center gap-1 rounded-lg px-1 py-1.5 hover:bg-brand-50 sm:gap-2 sm:px-2"><span class="grid h-8 w-8 place-items-center rounded-full bg-brand-100 text-brand-700 sm:h-9 sm:w-9"><UserRound :size="19"/></span><span class="hidden max-w-32 truncate text-left text-sm font-bold xl:block">{{auth.name}}<small class="block text-[11px] font-normal text-slate-500">Công dân</small></span><ChevronDown class="hidden sm:block" :size="15"/></button><div class="invisible absolute right-0 w-52 rounded-xl border bg-white p-1 shadow-lg group-hover:visible group-focus-within:visible"><NuxtLink to="/ho-so-ca-nhan" class="side-link"><UserRound :size="16"/>Hồ sơ cá nhân</NuxtLink><NuxtLink to="/bao-mat" class="side-link"><ShieldCheck :size="16"/>Bảo mật</NuxtLink><button class="side-link w-full text-left" @click="logout"><LogOut :size="16"/>Đăng xuất</button></div></div><button class="rounded-lg border p-1.5 sm:p-2 2xl:hidden" aria-label="Mở menu" aria-controls="citizen-mobile-menu" :aria-expanded="showMobile" @click="showMobile=!showMobile"><Menu :size="21"/></button></div>
   </div>
   <nav v-if="showMobile" id="citizen-mobile-menu" class="scrollbar-hide absolute inset-x-0 top-full z-50 grid max-h-[min(65svh,440px)] grid-cols-1 gap-1 overflow-y-auto border-t bg-white p-2 shadow-xl sm:grid-cols-2 sm:p-3 2xl:hidden" aria-label="Điều hướng trên điện thoại"><NuxtLink v-for="item in nav" :key="item.to" :to="item.to" class="side-link" @click="showMobile=false"><component :is="item.icon" :size="16"/>{{item.name}}</NuxtLink><NuxtLink v-for="item in mobileExtras" :key="item.to" :to="item.to" class="side-link" @click="showMobile=false"><component :is="item.icon" :size="16"/>{{item.name}}</NuxtLink></nav>
  </header>
  <section class="hero-gradient hero-pattern relative z-10 isolate shrink-0 overflow-hidden text-white">
   <div class="pointer-events-none absolute inset-y-0 right-0 hidden w-[74%] opacity-60 sm:block lg:w-[60%] lg:opacity-80"><img src="/images/ubnd-hero-clean.png" alt="Hình minh họa trụ sở UBND xã" class="hero-building h-full w-full object-cover object-right object-top"/></div>
   <div class="relative mx-auto w-full max-w-[1850px] px-3 pb-3 pt-4 sm:px-5 sm:pb-4 sm:pt-5 lg:px-8 lg:pt-6"><div class="relative z-10 mb-3 max-w-[min(100%,920px)] sm:mb-4"><h1 class="citizen-hero-title max-w-full text-[clamp(1.25rem,2.35vw,2.35rem)] font-extrabold leading-[1.2] tracking-tight text-white drop-shadow-sm">{{header}}</h1><p class="mt-2 max-w-[760px] text-xs leading-snug text-blue-50 sm:text-sm lg:text-[15px]">{{description}}</p></div>
    <div  :class="['citizen-steps scrollbar-hide relative z-10 flex w-full min-w-0 snap-x snap-mandatory gap-1.5 overflow-x-auto overscroll-x-contain rounded-[17px] border border-white bg-white p-2 text-ink shadow-[0_7px_18px_rgba(5,44,99,0.18)] xl:grid xl:gap-1 xl:overflow-visible',route.path==='/'?'xl:grid-cols-5':'xl:grid-cols-4']"><div v-for="(step,index) in steps" :key="step.title" :class="['flex min-w-[214px] max-w-[270px] shrink-0 snap-start items-center gap-2 rounded-xl px-2 py-1.5 sm:min-w-[235px] sm:px-3 sm:py-2 xl:max-w-none xl:min-w-0 xl:shrink',currentStep===index+1?'bg-[#ddecff]':'']"><span :class="['grid h-9 w-9 shrink-0 place-items-center rounded-full border sm:h-10 sm:w-10',currentStep===index+1?'border-brand-600 bg-brand-600 text-white':'border-brand-200 bg-white text-brand-700']"><component :is="step.icon" :size="22"/></span><div class="min-w-0"><p class="text-[13px] font-bold leading-tight text-slate-900 sm:text-sm">{{index+1}}. {{step.title}}</p><p class="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-600">{{step.desc}}</p></div><ArrowRight v-if="index<steps.length-1" class="ml-auto hidden shrink-0 text-brand-700 2xl:block" :size="14"/></div></div>
   </div>
  </section>
  <div class="citizen-workspace mx-auto grid min-h-0 w-full max-w-[1850px] min-w-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] gap-4 overflow-hidden px-3 py-3 sm:px-5 xl:grid-cols-[205px_minmax(0,1fr)] xl:gap-5 2xl:grid-cols-[220px_minmax(0,1fr)_280px]">
   <aside class="citizen-inner-scroll scrollbar-hide hidden min-h-0 min-w-0 self-stretch overflow-y-auto overscroll-contain rounded-2xl border border-[#dce7f6] bg-white p-3 xl:block"><div class="space-y-1"><NuxtLink v-for="item in categories" :key="item.name" :to="item.to" :class="['side-link',route.path.startsWith('/thu-tuc')&&decodeURI(route.fullPath).includes(item.name)?'side-link-active':'']"><component :is="item.icon" :size="18"/><span class="flex-1">{{item.name}}</span></NuxtLink></div><div class="my-4 border-b border-slate-100"/><div class="space-y-1"><NuxtLink to="/ho-so" class="side-link"><FolderOpen :size="18"/>Hồ sơ của tôi</NuxtLink><NuxtLink to="/thong-bao" class="side-link"><Bell :size="18"/>Thông báo</NuxtLink><NuxtLink to="/ho-so-ca-nhan" class="side-link"><UserRound :size="18"/>Hồ sơ cá nhân</NuxtLink><NuxtLink to="/huong-dan" class="side-link"><BookOpen :size="18"/>Hướng dẫn</NuxtLink><NuxtLink to="/lien-he" class="side-link"><Headset :size="18"/>Liên hệ hỗ trợ</NuxtLink></div><p class="mt-9 rounded-lg bg-brand-50 p-3 text-xs leading-relaxed text-brand-800">Dữ liệu trong bản dựng này đều là dữ liệu giả lập, không phải hồ sơ hành chính có giá trị pháp lý.</p></aside>
   <main ref="mainScroll" class="citizen-inner-scroll scrollbar-hide min-h-0 min-w-0 max-w-full overflow-x-hidden overflow-y-auto overscroll-contain pb-5 pr-1" tabindex="0" aria-label="Nội dung chính, cuộn để xem thêm"><slot/></main>
   <aside class="citizen-inner-scroll scrollbar-hide hidden min-h-0 min-w-0 self-stretch space-y-3 overflow-y-auto overscroll-contain 2xl:block">
    <section class="panel overflow-hidden" aria-labelledby="citizen-support-title">
     <img src="/images/support.png" alt="Nhân viên hướng dẫn và hỗ trợ công dân" class="h-36 w-full bg-blue-50 object-cover" />
     <div class="p-4">
      <div class="flex items-start gap-3">
       <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-100 text-brand-700"><Headset :size="22"/></span>
       <div class="min-w-0"><h3 id="citizen-support-title" class="text-lg font-extrabold text-brand-900">Hỗ trợ công dân</h3><p class="mt-1 text-xs leading-relaxed text-slate-600">Tư vấn thao tác trên cổng dịch vụ công mô phỏng.</p></div>
      </div>
      <ul class="mt-4 space-y-2 border-t border-blue-100 pt-3 text-xs leading-relaxed text-brand-900">
       <li class="flex items-start gap-2"><CheckCircle2 :size="15" class="mt-0.5 shrink-0 text-emerald-600"/> Hướng dẫn nộp hồ sơ trực tuyến</li>
       <li class="flex items-start gap-2"><CheckCircle2 :size="15" class="mt-0.5 shrink-0 text-emerald-600"/> Hỗ trợ bổ sung giấy tờ</li>
       <li class="flex items-start gap-2"><CheckCircle2 :size="15" class="mt-0.5 shrink-0 text-emerald-600"/> Tra cứu tiến độ và nhận kết quả</li>
      </ul>
      <NuxtLink to="/huong-dan" class="side-link mt-3 !px-0"><BookOpen :size="17"/>Xem hướng dẫn<ChevronDown class="ml-auto -rotate-90" :size="15"/></NuxtLink>
      <NuxtLink to="/lien-he" class="btn-primary mt-2 flex w-full items-center justify-center gap-2 !text-xs"><Headset :size="16"/>Gửi yêu cầu hỗ trợ<ArrowRight :size="15"/></NuxtLink>
      <p class="mt-3 text-center text-[11px] leading-relaxed text-slate-500">Kênh hỗ trợ mô phỏng · Chưa tiếp nhận yêu cầu hành chính thật</p>
     </div>
    </section>
   </aside>
  </div>
  <footer class="hidden shrink-0 border-t border-slate-200 bg-white px-4 py-1 text-center text-[10px] text-slate-500 2xl:block">CommuneOS Open-Core · Bản mô phỏng chức năng Công dân · PostgreSQL · Nuxt + Tailwind CSS · Apache-2.0</footer>
 </div>
</template>
