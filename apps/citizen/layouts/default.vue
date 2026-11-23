<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import type { Notice } from '~/types/models'
import { Home,FilePlus2,FolderOpen,UserRound,ChevronDown,BookOpen,ShieldCheck,Headset,Menu,X,LogIn,LogOut,CheckCircle2,UploadCloud,FileText,Bot,LayoutGrid } from 'lucide-vue-next'
const route=useRoute();const showMobile=ref(false)
// Close the compact navigation via Escape or a click outside its header.
function closeMobileOnEscape(event: KeyboardEvent) { if (event.key === 'Escape') showMobile.value=false }
function closeMobileOutside(event: PointerEvent) {
  const target=event.target
  if (showMobile.value && target instanceof Element && !target.closest('#citizen-navigation-header')) showMobile.value=false
}
onMounted(()=>{ document.addEventListener('keydown', closeMobileOnEscape); document.addEventListener('pointerdown', closeMobileOutside) })
onBeforeUnmount(()=>{ document.removeEventListener('keydown', closeMobileOnEscape); document.removeEventListener('pointerdown', closeMobileOutside) })
const mainScroll=ref<HTMLElement|null>(null)
const {data:auth,refresh:refreshAuth}=await useAsyncData('citizen-auth',()=>useRequestFetch()<{authenticated:boolean;name?:string}>('/api/auth/me'),{default:()=>({authenticated:false})})
// The badge has its own cache to avoid conflicting page-level fetch options.
// Reuse the paginated inbox API: unreadCount covers every notice, not only the first 100.
const {data:headerNotices,pending:headerNoticesLoading,error:headerNoticesError,refresh:refreshHeaderNotices,clear:clearHeaderNotices}=await useFetch<{
  items: Notice[]; unreadCount:number
}>('/api/notifications',{
  key:'citizen-notifications-badge',query:{paged:'1',page:'1'},immediate:Boolean(auth.value?.authenticated)
})
const unreadCount=computed(()=>headerNotices.value?.unreadCount||0)
watch(()=>auth.value?.authenticated,(loggedIn)=>{
  if(loggedIn) void refreshHeaderNotices()
  else clearHeaderNotices()
})
// Điều hướng chính chỉ gồm 4 việc người dân hay làm nhất; các trang phụ nằm trong "Tài khoản của tôi".
const nav=[{to:'/',name:'Trang chủ',icon:Home},{to:'/thu-tuc',name:'Thủ tục',icon:FilePlus2},{to:'/ho-so',name:'Hồ sơ của tôi',icon:FolderOpen},{to:'/tro-ly',name:'Trợ lý AI',icon:Bot}]
const mobileExtras=[{to:'/tai-khoan',name:'Tài khoản của tôi',icon:LayoutGrid},{to:'/huong-dan',name:'Hướng dẫn sử dụng',icon:BookOpen},{to:'/lien-he',name:'Liên hệ hỗ trợ',icon:Headset}]
const header=computed(()=>({
 '/':'Cổng dịch vụ hành chính công cấp xã','/thu-tuc':'Danh mục thủ tục hành chính','/ho-so':'Hồ sơ của tôi',
 '/khong-gian-ca-nhan':'Không gian hành chính cá nhân','/lo-trinh-hanh-chinh':'Lộ trình thủ tục theo nhu cầu','/lich-hanh-chinh':'Lịch và nhắc việc hành chính',
 '/so-giao-dich':'Sổ giao dịch hành chính','/dong-bo-du-lieu':'Đồng bộ dữ liệu liên địa phương','/tim-theo-tinh-huong':'Tìm thủ tục theo tình huống','/kiem-chung-ket-qua':'Kiểm chứng kết quả điện tử','/goi-y-thu-tuc':'Tìm thủ tục phù hợp','/lien-thong':'Nhóm hồ sơ nhiều thủ tục', '/tra-cuu':'Tra cứu tiến độ hồ sơ','/thong-bao':'Thông báo','/tro-ly':'Trợ lý AI tư vấn thủ tục hành chính','/huong-dan':'Hướng dẫn sử dụng','/ho-so-ca-nhan':'Hồ sơ cá nhân','/kho-giay-to':'Kho giấy tờ số cá nhân','/nhat-ky-du-lieu':'Nhật ký sử dụng dữ liệu cá nhân','/quyen-chia-se':'Trung tâm quyền chia sẻ dữ liệu','/vong-doi-du-lieu':'Quản lý vòng đời dữ liệu','/bao-mat':'Bảo mật tài khoản','/lien-he':'Liên hệ và phản hồi','/dai-dien':'Đại diện thực hiện thủ tục','/tai-quay':'Hỗ trợ thủ tục tại quầy','/ho-so-gia-dinh':'Hồ sơ gia đình','/lich-tu-van':'Đặt lịch tư vấn cán bộ','/lich-hen-mot-cua':'Đặt lịch và lấy số thứ tự tại quầy','/chuyen-tiep':'Chuyển tiếp hồ sơ trực tuyến – tại quầy','/yeu-cau-ho-tro':'Theo dõi yêu cầu hỗ trợ','/tai-khoan':'Tài khoản của tôi'
})[route.path]||(route.path.startsWith('/thu-tuc/')?'Chi tiết thủ tục':route.path.startsWith('/nop-ho-so/')?'Nộp hồ sơ trực tuyến':route.path.includes('/bo-sung')?'Bổ sung hồ sơ':route.path.includes('/ket-qua')?'Nhận kết quả điện tử':route.path.startsWith('/ho-so/')?'Chi tiết hồ sơ':'Dịch vụ công dân'))
// Mọi trang dùng chung một khung tiêu đề nền xanh trơn, cùng chiều cao; chỉ tiêu đề và dòng mô tả đổi theo trang.
const descriptions:Record<string,string>={'/thu-tuc':'Tìm thủ tục theo tên hoặc chủ đề, xem giấy tờ cần chuẩn bị rồi nộp trực tuyến.','/ho-so':'Theo dõi tiến độ, bổ sung giấy tờ và nhận kết quả.','/thong-bao':'Thông báo về hồ sơ và tin từ Ủy ban nhân dân xã.','/tai-khoan':'Giấy tờ, lịch hẹn, quyền riêng tư và hỗ trợ.'}
const description=computed(()=>route.path==='/'?'Nộp hồ sơ trực tuyến, theo dõi tiến độ và nhận kết quả.':route.path.startsWith('/nop-ho-so/')?'Khai báo thông tin, tải giấy tờ, kiểm tra rồi gửi hồ sơ.':route.path==='/tro-ly'?'Giải đáp từ dữ liệu thủ tục đã công bố, có trích dẫn nguồn.':(descriptions[route.path]||(route.path.startsWith('/ho-so/')?'Theo dõi tiến độ, bổ sung giấy tờ và nhận kết quả của hồ sơ.':route.path.startsWith('/thu-tuc/')?'Giấy tờ cần chuẩn bị, lệ phí, thời hạn và cách nộp.':'Cổng dịch vụ hành chính công cấp xã.')))
// Thanh 4 bước chỉ hiện trong luồng nộp hồ sơ; ảnh trụ sở chỉ ở trang chủ.
const isFiling=computed(()=>route.path.startsWith('/nop-ho-so/'))
const steps=computed(()=>[
  {title:'Chọn thủ tục',desc:'Tìm và chọn thủ tục cần thực hiện',icon:FileText},
  {title:'Điền thông tin',desc:'Khai báo đầy đủ theo mẫu',icon:FilePlus2},
  {title:'Tải tài liệu',desc:'Đính kèm giấy tờ theo yêu cầu',icon:UploadCloud},
  {title:'Xác nhận & nộp',desc:'Kiểm tra và gửi hồ sơ',icon:CheckCircle2}
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
 <a href="#citizen-main" class="citizen-skip-link">Bỏ qua điều hướng, đến nội dung chính</a>
 <div class="citizen-app-shell flex h-[100dvh] min-h-0 w-full max-w-full flex-col overflow-hidden">
  <header id="citizen-navigation-header" class="relative z-40 shrink-0 border-b border-slate-200 bg-white shadow-sm">
   <div class="mx-auto flex h-[60px] w-full max-w-[1280px] items-center gap-2 px-3 sm:h-[64px] sm:gap-4 sm:px-5">
    <NuxtLink to="/" class="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3" aria-label="CommuneOS – về trang chủ">
     <span class="flex shrink-0 items-center gap-1 sm:gap-2">
      <img src="/images/logo-communeos.svg" alt="" width="64" height="64" class="citizen-brand-logo" />
     </span>
     <span class="min-w-0 leading-tight max-[359px]:hidden">
      <span class="block text-base font-bold text-brand-800 sm:text-xl">CommuneOS</span>
      <span class="hidden text-xs text-slate-600 sm:block">Dịch vụ công cấp xã</span>
     </span>
    </NuxtLink>
    <nav class="ml-6 hidden min-w-0 items-center gap-1 xl:flex" aria-label="Điều hướng chính"><NuxtLink v-for="item in nav" :key="item.to" :to="item.to" :class="['nav-link',isActive(item.to)?'nav-link-active':'']"><component :is="item.icon" :size="17"/>{{item.name}}</NuxtLink></nav>
    <div class="ml-auto flex shrink-0 items-center gap-1 sm:gap-2"><CitizenAccessibilityPanel/><NotificationPopover
      :authenticated="Boolean(auth?.authenticated)"
      :notices="headerNotices?.items ?? []"
      :unread-count="unreadCount"
      :loading="headerNoticesLoading"
      :load-error="Boolean(headerNoticesError)"
      @refresh="refreshHeaderNotices()"
     /><NuxtLink v-if="!auth?.authenticated" to="/dang-nhap" class="btn-primary !px-3 sm:!px-4" aria-label="Đăng nhập"><LogIn :size="16"/><span class="hidden sm:inline">Đăng nhập</span></NuxtLink><div v-else class="group relative"><button class="flex items-center gap-2 rounded-lg px-1.5 py-1.5 hover:bg-brand-50" aria-haspopup="menu"><span class="grid h-9 w-9 place-items-center rounded-full bg-brand-100 text-brand-700"><UserRound :size="19"/></span><span class="hidden max-w-40 truncate text-left text-sm font-semibold text-ink lg:block">{{auth.name}}</span><ChevronDown class="hidden sm:block" :size="15"/></button><div class="invisible absolute right-0 top-full z-50 w-56 rounded-xl border border-slate-200 bg-white p-1 shadow-lg group-hover:visible group-focus-within:visible" role="menu"><NuxtLink to="/tai-khoan" class="side-link"><LayoutGrid :size="16"/>Tài khoản của tôi</NuxtLink><NuxtLink to="/ho-so-ca-nhan" class="side-link"><UserRound :size="16"/>Hồ sơ cá nhân</NuxtLink><NuxtLink to="/bao-mat" class="side-link"><ShieldCheck :size="16"/>Bảo mật</NuxtLink><button class="side-link w-full text-left" @click="logout"><LogOut :size="16"/>Đăng xuất</button></div></div><button class="rounded-lg border border-slate-200 p-2 xl:hidden" :aria-label="showMobile ? 'Đóng menu' : 'Mở menu'" type="button" aria-controls="citizen-mobile-menu" :aria-expanded="showMobile" @click="showMobile=!showMobile"><X v-if="showMobile" :size="21"/><Menu v-else :size="21"/></button></div>
   </div>
   <nav v-if="showMobile" id="citizen-mobile-menu" @keydown.esc="showMobile=false" class="scrollbar-hide absolute inset-x-0 top-full z-50 grid max-h-[min(72dvh,520px)] grid-cols-1 gap-1 overflow-y-auto border-t bg-white p-2 shadow-xl sm:grid-cols-2 sm:p-3 xl:hidden" aria-label="Điều hướng trên điện thoại"><NuxtLink v-for="item in nav" :key="item.to" :to="item.to" class="side-link" @click="showMobile=false"><component :is="item.icon" :size="16"/>{{item.name}}</NuxtLink><NuxtLink v-for="item in mobileExtras" :key="item.to" :to="item.to" class="side-link" @click="showMobile=false"><component :is="item.icon" :size="16"/>{{item.name}}</NuxtLink></nav>
  </header>
  <section class="hero-gradient relative z-10 isolate shrink-0 overflow-hidden text-white">
   <div class="relative mx-auto w-full max-w-[1280px] px-3 py-4 sm:px-5 sm:py-5">
    <h1 class="citizen-hero-title max-w-[860px] text-[clamp(1.25rem,2.2vw,1.85rem)] font-bold leading-tight text-white">{{header}}</h1>
    <p class="citizen-hero-description mt-1 max-w-[720px] truncate text-sm text-blue-50">{{description}}</p>
    <ol v-if="isFiling" class="citizen-steps scrollbar-hide mt-4 flex w-full min-w-0 gap-1.5 overflow-x-auto rounded-xl bg-white p-1.5 text-ink shadow-sm xl:grid xl:grid-cols-4 xl:overflow-visible" aria-label="Các bước nộp hồ sơ"><li v-for="(step,index) in steps" :key="step.title" :aria-current="currentStep===index+1?'step':undefined" :class="['flex min-w-[200px] shrink-0 items-center gap-2 rounded-lg px-2.5 py-2 xl:min-w-0',currentStep===index+1?'bg-brand-50':'']"><span :class="['grid h-8 w-8 shrink-0 place-items-center rounded-full border text-sm font-semibold',currentStep===index+1?'border-brand-600 bg-brand-600 text-white':currentStep>index+1?'border-emerald-600 bg-emerald-600 text-white':'border-slate-300 bg-white text-slate-600']"><component :is="step.icon" :size="17"/></span><div class="min-w-0"><p class="text-sm font-semibold leading-tight text-slate-900">{{index+1}}. {{step.title}}</p><p class="mt-0.5 text-xs text-slate-600">{{step.desc}}</p></div></li></ol>
   </div>
  </section>
  <div class="citizen-workspace mx-auto flex min-h-0 w-full max-w-[1280px] min-w-0 flex-1 flex-col overflow-hidden px-2 py-3 sm:px-5" :class="{ 'citizen-home-workspace': route.path === '/', 'citizen-subpage-workspace': route.path !== '/' }">
   <main ref="mainScroll" id="citizen-main" class="citizen-inner-scroll scrollbar-hide min-h-0 min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto overscroll-contain" tabindex="0" aria-label="Nội dung chính, cuộn để xem thêm"><div class="citizen-sheet"><slot/></div></main>
  </div>
 </div>
</template>
