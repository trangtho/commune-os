<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { Home,FolderOpen,Search,Bell,UserRound,ChevronDown,Menu,X,LogOut,LogIn,ClipboardList,Users,BarChart3 } from 'lucide-vue-next'
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
// Menu trái 6 mục; hồ sơ cá nhân và đăng xuất nằm trong menu tài khoản.
const nav=[{to:'/',name:'Tổng quan',icon:Home},{to:'/ho-so',name:'Hồ sơ',icon:FolderOpen},{to:'/thu-tuc',name:'Thủ tục',icon:ClipboardList},{to:'/thong-bao',name:'Thông báo',icon:Bell},{to:'/bao-cao',name:'Báo cáo',icon:BarChart3},{to:'/tai-khoan',name:'Nhân viên',icon:Users,leaderOnly:true}]
// Menu Nhân viên chỉ hiện với lãnh đạo xã; quyền thật do dịch vụ tài khoản của lõi kiểm tra.
const menu=computed(()=>nav.filter(item=>!item.leaderOnly||auth.value?.role==='admin'))
const header=computed(()=>({
  '/':'Tổng quan hoạt động','/ho-so':'Quản lý hồ sơ hành chính','/thu-tuc':'Danh mục thủ tục hành chính',
  '/thong-bao':'Thông báo & công khai','/bao-cao':'Báo cáo thống kê','/tai-khoan':'Quản lý nhân viên','/ho-so-ca-nhan':'Hồ sơ cá nhân'
})[route.path]||(route.path.startsWith('/tai-khoan/')?'Quản lý nhân viên':route.path.startsWith('/ho-so/')?'Chi tiết hồ sơ':route.path.startsWith('/thu-tuc/')?'Chi tiết thủ tục':'Bảng quản trị cán bộ'))
const roleLabel=computed(()=>auth.value?.role==='admin'?'Lãnh đạo xã':'Cán bộ xử lý')
// Ô tìm nhanh theo mã hồ sơ ở đầu trang.
const quick=ref('')
function findDossier(){const v=quick.value.trim();if(!v)return;quick.value='';navigateTo(/^HS-\d{4}-\d+$/i.test(v)?`/ho-so/${v.toUpperCase()}`:`/ho-so?q=${encodeURIComponent(v)}`)}
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
  <header class="relative z-40 shrink-0 border-b border-slate-200 bg-white shadow-sm">
   <div class="mx-auto flex h-[60px] w-full max-w-[1440px] items-center gap-3 px-3 sm:h-[64px] sm:px-5">
    <NuxtLink to="/" class="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3" aria-label="CommuneOS – về trang tổng quan">
     <span class="flex shrink-0 items-center gap-1 sm:gap-2">
      <img src="/images/logo-communeos.svg" alt="" width="64" height="64" class="commune-brand-logo" />
     </span>
     <span class="min-w-0 leading-tight max-[359px]:hidden">
      <span class="block text-base font-bold text-brand-800 sm:text-xl">CommuneOS</span>
      <span class="hidden text-xs text-slate-600 sm:block">Màn hình cán bộ xã</span>
     </span>
    </NuxtLink>
    <form v-if="auth?.authenticated" class="relative ml-4 hidden w-full max-w-sm md:block" role="search" @submit.prevent="findDossier"><label for="commune-quick-search" class="sr-only">Tìm hồ sơ theo mã hoặc tên người nộp</label><Search class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" :size="17"/><input id="commune-quick-search" v-model="quick" class="field !py-2 !pl-9" placeholder="Tìm mã hồ sơ, ví dụ HS-2026-001248"/></form>
    <div class="ml-auto flex shrink-0 items-center gap-1 sm:gap-2"><NuxtLink to="/thong-bao" class="relative rounded-lg p-2 text-brand-800 hover:bg-brand-50" :aria-label="'Thông báo' + (unreadCount ? ', '+unreadCount+' chưa đọc' : '')"><Bell :size="21"/><span v-if="auth?.authenticated && unreadCount" class="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[11px] font-bold text-white" aria-live="polite">{{unreadCount>99?'99+':unreadCount}}</span></NuxtLink><NuxtLink v-if="!auth?.authenticated" to="/dang-nhap" class="btn-primary !px-3 sm:!px-4" aria-label="Đăng nhập"><LogIn :size="16"/><span class="hidden sm:inline">Đăng nhập</span></NuxtLink><div v-else class="group relative"><button class="flex items-center gap-2 rounded-lg px-1.5 py-1.5 hover:bg-brand-50" aria-haspopup="menu"><span class="grid h-9 w-9 place-items-center rounded-full bg-brand-100 text-brand-700"><UserRound :size="19"/></span><span class="hidden max-w-40 truncate text-left text-sm font-semibold text-ink lg:block">{{auth.name}}<small class="block text-xs font-normal text-slate-600">{{roleLabel}}</small></span><ChevronDown class="hidden sm:block" :size="15"/></button><div class="invisible absolute right-0 top-full z-50 w-56 rounded-xl border border-slate-200 bg-white p-1 shadow-lg group-hover:visible group-focus-within:visible" role="menu"><NuxtLink to="/ho-so-ca-nhan" class="side-link"><UserRound :size="16"/>Hồ sơ cá nhân</NuxtLink><NuxtLink v-if="auth?.role==='admin'" to="/tai-khoan" class="side-link"><Users :size="16"/>Quản lý nhân viên</NuxtLink><button class="side-link w-full text-left" @click="logout"><LogOut :size="16"/>Đăng xuất</button></div></div><button class="rounded-lg border border-slate-200 p-2 xl:hidden" :aria-label="showMobile ? 'Đóng menu' : 'Mở menu'" type="button" aria-controls="commune-mobile-menu" :aria-expanded="showMobile" @click="showMobile=!showMobile"><X v-if="showMobile" :size="21"/><Menu v-else :size="21"/></button></div>
   </div>
   <nav v-if="showMobile" id="commune-mobile-menu" class="scrollbar-hide absolute inset-x-0 top-full z-50 grid max-h-[min(65svh,440px)] grid-cols-1 gap-1 overflow-y-auto border-t bg-white p-2 shadow-xl sm:grid-cols-2 sm:p-3 xl:hidden" aria-label="Điều hướng trên điện thoại"><NuxtLink v-for="item in menu" :key="item.to" :to="item.to" class="side-link" @click="showMobile=false"><component :is="item.icon" :size="16"/>{{item.name}}</NuxtLink><NuxtLink to="/ho-so-ca-nhan" class="side-link" @click="showMobile=false"><UserRound :size="16"/>Hồ sơ cá nhân</NuxtLink></nav>
  </header>
  <div class="commune-workspace mx-auto grid min-h-0 w-full max-w-[1440px] min-w-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] gap-4 overflow-hidden px-2 py-3 sm:px-5 xl:grid-cols-[220px_minmax(0,1fr)] xl:gap-5">
   <aside class="commune-inner-scroll scrollbar-hide hidden min-h-0 min-w-0 self-stretch overflow-y-auto overscroll-contain rounded-2xl border border-[#d5e9e4] bg-white p-3 xl:block" aria-label="Điều hướng chính"><nav class="space-y-1"><NuxtLink v-for="item in menu" :key="item.to" :to="item.to" :class="['side-link',isActive(item.to)?'side-link-active':'']" :aria-current="isActive(item.to)?'page':undefined"><component :is="item.icon" :size="18"/><span class="flex-1">{{item.name}}</span></NuxtLink></nav><p class="mt-6 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">Dữ liệu trong bản trình diễn là dữ liệu giả lập, không có giá trị pháp lý.</p></aside>
   <main ref="mainScroll" class="commune-inner-scroll scrollbar-hide min-h-0 min-w-0 max-w-full overflow-x-hidden overflow-y-auto overscroll-contain" tabindex="0" aria-label="Nội dung chính, cuộn để xem thêm"><div class="commune-sheet"><h1 class="commune-hero-title mb-4 text-2xl font-bold text-ink">{{header}}</h1><slot/></div></main>
  </div>
 </div>
</template>
