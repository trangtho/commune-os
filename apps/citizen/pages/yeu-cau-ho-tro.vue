<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { Headset, Send, RefreshCw, Search } from 'lucide-vue-next'
interface Ticket {id:string;category:string;subject:string;status:string;assignedStaff:string|null;applicationId:string|null;updatedAt:string;createdAt:string}
interface Listing {items:Ticket[];total:number;page:number;pageSize:number}
const categories=[{id:'huong-dan',label:'Hướng dẫn thủ tục'},{id:'loi-ky-thuat',label:'Lỗi kỹ thuật'},{id:'gop-y',label:'Góp ý'},{id:'phan-anh',label:'Phản ánh'},{id:'khac',label:'Khác'}]
const labels:Record<string,string>={received:'Đã ghi nhận',processing:'Đang xử lý',waiting_citizen:'Cần bổ sung thông tin',answered:'Đã phản hồi',resolved:'Đã giải quyết',closed:'Đã đóng',reopened:'Yêu cầu xử lý lại'}
const status=ref(''),search=ref(''),page=ref(1)
const {data:auth}=await useFetch<{authenticated:boolean}>('/api/auth/me',{key:'support-center-auth'})
const {data:tickets,error,refresh,pending}=await useFetch<Listing>('/api/tickets',{
 key:'citizen-tickets-list',query:computed(()=>({status:status.value,q:search.value,page:page.value})),immediate:!!auth.value?.authenticated
})
watch([status,search],()=>{page.value=1})
const category=ref('huong-dan'),subject=ref(''),description=ref(''),applicationId=ref('')
const busy=ref(false),failure=ref(''),notice=ref('')
const {dateTime}=useFormat()
async function send(){if(busy.value)return;busy.value=true;failure.value='';notice.value=''
 try{const newTicket=await $fetch<{id:string;code:string}>('/api/tickets',{method:'POST',body:{category:category.value,subject:subject.value,message:description.value,applicationId:applicationId.value||undefined}})
  subject.value='';description.value='';applicationId.value='';notice.value=`Đã tạo yêu cầu ${newTicket.code}.`;
  await refresh();await navigateTo(`/yeu-cau-ho-tro/${newTicket.id}`)
 }catch(e){failure.value=readableError(e)}finally{busy.value=false}}
</script>
<template>
 <div class="space-y-4">
  <header><h2 class="flex items-center gap-2 text-xl font-black text-brand-900"><Headset :size="22"/>Trung tâm hỗ trợ và phản ánh</h2><p class="mt-1 text-sm text-muted">Gửi yêu cầu, theo dõi trạng thái và trao đổi lại khi chưa được giải quyết.</p></header>
  <div class="rounded-xl bg-blue-50 p-3 text-sm text-blue-950" role="note">Trạng thái “Đã ghi nhận” chỉ có nghĩa là hệ thống đã lưu yêu cầu. Người phụ trách và kết quả chỉ xuất hiện khi dịch vụ cán bộ thực sự cập nhật.</div>
  <div v-if="!auth?.authenticated" class="panel space-y-3 p-5"><p class="text-sm">Vui lòng đăng nhập để gửi và xem lịch sử yêu cầu hỗ trợ của tài khoản.</p><NuxtLink to="/dang-nhap" class="btn-primary">Đăng nhập</NuxtLink></div>
  <template v-else>
   <form class="panel space-y-4 p-4 sm:p-5" @submit.prevent="send"><h3 class="section-label">Gửi yêu cầu mới</h3>
    <div class="grid gap-4 sm:grid-cols-2"><div><label class="field-label" for="new-ticket-category">Phân loại *</label><select id="new-ticket-category" v-model="category" class="field"><option v-for="c in categories" :key="c.id" :value="c.id">{{c.label}}</option></select></div><div><label for="new-ticket-case" class="field-label">Mã hồ sơ liên quan (nếu có)</label><input id="new-ticket-case" v-model="applicationId" class="field" maxlength="50" placeholder="Ví dụ: HS-2026-100500"/></div></div>
    <div><label for="new-ticket-subject" class="field-label">Chủ đề *</label><input id="new-ticket-subject" v-model="subject" class="field" required minlength="3" maxlength="150" placeholder="Ví dụ: Cần hỗ trợ kê khai thủ tục"/></div>
    <div><label for="new-ticket-message" class="field-label">Nội dung *</label><textarea id="new-ticket-message" v-model="description" class="field" rows="4" required minlength="10" maxlength="3000" placeholder="Mô tả vấn đề. Không gửi mật khẩu hay mã OTP."/></div>
    <p v-if="failure" role="alert" class="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{{failure}}</p><p v-if="notice" role="status" class="rounded-lg bg-green-50 p-3 text-sm text-green-800">{{notice}}</p>
    <button class="btn-primary" type="submit" :disabled="busy||subject.trim().length<3||description.trim().length<10"><Send :size="16"/>{{busy?'Đang gửi...':'Gửi yêu cầu hỗ trợ'}}</button>
   </form>
   <section class="panel space-y-3 p-4 sm:p-5"><div class="flex flex-wrap items-center justify-between gap-2"><h3 class="section-label !mb-0">Yêu cầu của tôi</h3><button type="button" class="btn-outline !py-1.5" @click="refresh()"><RefreshCw :size="15"/>Làm mới</button></div>
    <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]"><div><label for="ticket-search" class="field-label">Tìm kiếm</label><div class="relative"><Search class="absolute left-3 top-3 text-slate-400" :size="17"/><input id="ticket-search" v-model="search" class="field !pl-10" placeholder="Chủ đề hoặc mã yêu cầu" maxlength="80"/></div></div><div><label for="ticket-status" class="field-label">Trạng thái</label><select id="ticket-status" v-model="status" class="field"><option value="">Tất cả trạng thái</option><option v-for="(label,key) in labels" :key="key" :value="key">{{label}}</option></select></div></div>
    <p v-if="error" role="alert" class="text-sm text-rose-700">Không tải được yêu cầu. Vui lòng thử lại.</p>
    <p v-else-if="pending" role="status" class="text-sm text-muted">Đang tải danh sách...</p>
    <p v-else-if="!tickets?.items.length" class="rounded-lg bg-slate-50 p-4 text-sm text-muted">Không tìm thấy yêu cầu phù hợp.</p>
    <NuxtLink v-for="t in tickets?.items||[]" :key="t.id" :to="`/yeu-cau-ho-tro/${t.id}`" class="block rounded-xl border border-slate-200 p-4 hover:border-brand-500 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"><div class="flex flex-wrap items-start justify-between gap-2"><div class="min-w-0"><p class="break-words font-bold text-brand-900">{{t.subject}}</p><p class="mt-1 text-xs text-muted">YC-{{t.id.slice(0,8).toUpperCase()}} · {{dateTime(t.updatedAt)}}</p></div><span class="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-brand-800">{{labels[t.status]||t.status}}</span></div><p v-if="t.assignedStaff" class="mt-2 text-xs text-muted">Người phụ trách: {{t.assignedStaff}}</p></NuxtLink>
    <div v-if="(tickets?.total||0)>10" class="flex flex-wrap items-center justify-between gap-2 pt-3 text-sm"><button type="button" class="btn-outline" :disabled="page<=1" @click="page--">Trang trước</button><span>Trang {{tickets?.page}} / {{Math.ceil((tickets?.total||0)/10)}}</span><button type="button" class="btn-outline" :disabled="page>=Math.ceil((tickets?.total||0)/10)" @click="page++">Trang sau</button></div>
   </section>
  </template>
 </div>
</template>
