<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { Headset, Send, MessageSquareText, Clock3, RefreshCw, Search } from 'lucide-vue-next'
interface FeedbackItem { id: string; subject: string; message: string; created_at: string }
const subject = ref('')
const category = ref('huong-dan')
const filter = ref('')
const categoryOptions = [{id:'huong-dan',label:'Hướng dẫn thủ tục'},{id:'loi-ky-thuat',label:'Lỗi kỹ thuật'},{id:'gop-y',label:'Góp ý'},{id:'phan-anh',label:'Phản ánh'},{id:'khac',label:'Khác'}]
const displayed = computed(() => feedback.value?.filter(item => (item.subject+' '+item.message).toLowerCase().includes(filter.value.toLowerCase())) || [])
const message = ref('')
const busy = ref(false)
const result = ref('')
const success = ref(false)
const { dateTime } = useFormat()
interface Ticket {id:string;subject:string;status:string;reply:string|null;updatedAt:string}
const {data:staffTickets,error:staffError,refresh:refreshStaff} = await useFetch<{configured:boolean;tickets:Ticket[]}>('/api/support/tickets',{key:'citizen-support-tickets',default:()=>({configured:false,tickets:[]})})
const ticketStatus=(status:string)=>({received:'Đã ghi nhận',processing:'Đang xử lý',answered:'Đã trả lời',closed:'Đã đóng'}[status]||'Không xác định')
const { data: feedback, error, refresh } = await useFetch<FeedbackItem[]>('/api/feedback', { key: 'citizen-feedback' })
async function send() {
  result.value = ''
  success.value = false
  busy.value = true
  try {
    await $fetch('/api/feedback', { method: 'POST', body: { category: category.value,subject: subject.value, message: message.value } })
    subject.value = ''; message.value = ''
    success.value = true
    result.value = 'Đã ghi nhận phản hồi. Bạn có thể xem lại trong lịch sử gửi bên dưới.'
    await refresh()
  } catch (e) { result.value = readableError(e) }
  finally { busy.value = false }
}
</script>
<template>
  <div class="space-y-4">
    <NuxtLink to="/yeu-cau-ho-tro" class="btn-primary">Theo dõi mã yêu cầu, trạng thái và phản hồi cán bộ</NuxtLink>
    <div><h2 class="text-xl font-black">Liên hệ và phản hồi</h2><p class="text-sm text-muted">Gửi góp ý, xem lại nội dung đã gửi và tìm kênh hướng dẫn sử dụng.</p></div>
    <div class="grid gap-4 lg:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)]">
      <section class="panel space-y-4 p-5">
        <h3 class="section-label"><Headset :size="20" class="text-blue-600" />Kênh hỗ trợ</h3>
        <p class="text-sm leading-7 text-slate-600">Nếu cần giải đáp liên quan đến một hồ sơ cụ thể, mở trang chi tiết hồ sơ và chọn “Gửi câu hỏi”. Các phản hồi bên dưới hiện là yêu cầu đã ghi nhận, chưa có cơ chế trả lời tự động từ cán bộ.</p>
        <div class="flex flex-wrap gap-2"><NuxtLink to="/huong-dan" class="btn-outline">Xem hướng dẫn</NuxtLink><NuxtLink to="/ho-so" class="btn-outline">Hồ sơ của tôi</NuxtLink></div>
      </section>
      <form class="panel space-y-4 p-5" @submit.prevent="send">
        <h3 class="section-label"><MessageSquareText :size="20" class="text-brand-600" />Gửi phản hồi</h3>
        <div><label for="feedback-category" class="field-label">Loại yêu cầu *</label><select id="feedback-category" v-model="category" class="field"><option v-for="option in categoryOptions" :key="option.id" :value="option.id">{{option.label}}</option></select></div>
        <div><label for="feedback-subject" class="field-label">Chủ đề *</label><input id="feedback-subject" v-model="subject" class="field" required minlength="3" maxlength="150" placeholder="Ví dụ: Góp ý giao diện tra cứu" /></div>
        <div><label for="feedback-message" class="field-label">Nội dung *</label><textarea id="feedback-message" v-model="message" class="field" rows="5" required minlength="10" maxlength="3000" placeholder="Mô tả nội dung cần hỗ trợ (không gửi mật khẩu hay thông tin nhạy cảm)..." /></div>
        <p v-if="result" :class="['rounded-lg p-3 text-sm', success ? 'bg-green-50 text-green-800' : 'bg-rose-50 text-rose-700']" role="status">{{ result }}</p>
        <button class="btn-primary w-full sm:w-auto" :disabled="busy || subject.trim().length < 3 || message.trim().length < 10" type="submit"><Send :size="17" />{{ busy ? 'Đang gửi...' : 'Gửi phản hồi' }}</button>
      </form>
    </div>
    <section class="panel space-y-3 p-5">
      <div class="flex flex-wrap items-center justify-between gap-2"><h3 class="section-label !mb-0">Trạng thái yêu cầu từ hệ thống cán bộ</h3><button class="btn-outline !px-3 !py-1.5 !text-xs" @click="refreshStaff()"><RefreshCw :size="14"/>Làm mới</button></div>
      <p v-if="staffError" role="alert" class="text-sm text-rose-700">Không kết nối được dịch vụ phản hồi của cán bộ.</p>
      <p v-else-if="!staffTickets?.configured" class="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Kênh cán bộ chưa cung cấp API trạng thái và trả lời yêu cầu. Các phản hồi phía dưới mới được ghi nhận trong cơ sở dữ liệu công dân.</p>
      <p v-else-if="!staffTickets?.tickets.length" class="text-sm text-muted">Chưa có yêu cầu được đồng bộ từ kênh cán bộ.</p>
      <article v-for="ticket in staffTickets?.tickets||[]" :key="ticket.id" class="rounded-xl border p-3"><div class="flex flex-wrap items-center justify-between gap-2"><b class="break-words text-sm">{{ticket.subject}}</b><span class="rounded-full bg-blue-50 px-2 py-1 text-xs text-brand-700">{{ticketStatus(ticket.status)}}</span></div><p class="mt-1 text-xs text-muted">Mã: {{ticket.id}} · {{dateTime(ticket.updatedAt)}}</p><p v-if="ticket.reply" class="mt-2 whitespace-pre-wrap rounded-lg bg-green-50 p-3 text-sm text-green-900">Phản hồi từ cán bộ: {{ticket.reply}}</p></article>
    </section>
    <section class="panel space-y-3 p-5">
      <div class="flex flex-wrap items-center justify-between gap-2"><h3 class="section-label !mb-0"><Clock3 :size="20" class="text-brand-600" />Lịch sử phản hồi đã gửi</h3><button class="btn-outline !px-3 !py-1.5 !text-xs" @click="refresh()"><RefreshCw :size="14" />Làm mới</button></div>
      <div class="flex items-center gap-2"><Search :size="16" class="text-brand-600"/><label for="support-filter" class="sr-only">Tìm yêu cầu hỗ trợ đã gửi</label><input id="support-filter" v-model="filter" class="field" placeholder="Tìm theo chủ đề hoặc nội dung..." maxlength="100" /></div>
      <div v-if="error" class="rounded-lg bg-rose-50 p-3 text-sm text-rose-700" role="alert">Không tải được lịch sử phản hồi. Hãy thử làm mới.</div>
      <p v-else-if="!displayed.length" class="rounded-lg bg-slate-50 p-4 text-sm text-muted">Chưa có phản hồi nào được gửi.</p>
      <div v-for="item in displayed" :key="item.id" class="rounded-xl border border-slate-200 p-4">
        <div class="flex flex-wrap items-start justify-between gap-2"><h4 class="min-w-0 break-words text-sm font-bold">{{ item.subject }}</h4><span class="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">Đã ghi nhận</span></div>
        <p class="mt-1 text-xs text-muted">{{ dateTime(item.created_at) }}</p>
        <p class="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{{ item.message }}</p>
      </div>
      <p class="text-xs text-muted">Mỗi yêu cầu được phân loại ngay khi gửi; chưa có cột phản hồi của cán bộ trong cơ sở dữ liệu. Hiển thị tối đa 50 phản hồi gần đây. Trạng thái “Đã ghi nhận” không có nghĩa là cán bộ đã xử lý hoặc trả lời.</p>
    </section>
  </div>
</template>
