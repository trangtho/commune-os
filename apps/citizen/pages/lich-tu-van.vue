<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { CalendarClock, RefreshCw, XCircle } from 'lucide-vue-next'
interface Slot {id:string;category:string;starts_at:string;ends_at:string;remaining:number}
interface Appointment {id:string;category:string;subject:string;description:string;channel:'phone'|'online';contact_phone:string;preferred_at:string;status:string;meeting_url?:string|null;staff_note?:string|null;created_at:string}
const {data:procedures}=await useFetch<{category:string}[]>('/api/procedures',{key:'consultation-procedures'})
const categories=computed(()=>[...new Set((procedures.value||[]).map(p=>p.category).filter(Boolean))])
const category=ref('')
watch(categories, c=>{if(c.length&&!category.value)category.value=c[0]},{immediate:true})
const {data:slotsData,refresh:refreshSlots}=await useFetch<{items:Slot[]}>('/api/consultations/slots',{query:computed(()=>({category:category.value})),key:'citizen-consultation-slots'})
const {data:appointments,error,refresh}=await useFetch<{items:Appointment[]}>('/api/consultations',{key:'citizen-consultations'})
const subject=ref(''),description=ref(''),contactPhone=ref(''),channel=ref<'phone'|'online'>('phone'),selectedSlot=ref(''),preferredLocal=ref('')
const loading=ref(false),message=ref(''),failure=ref('')
const {dateTime}=useFormat()
watch(category,()=>{selectedSlot.value='';void refreshSlots()})
const chosenSlot=computed(()=>slotsData.value?.items.find(s=>s.id===selectedSlot.value))
const futureMin=computed(()=>{const d=new Date(Date.now()+60*60*1000);return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(d).replace(' ','T')})
const labels:Record<string,string>={pending:'Chờ cán bộ xác nhận',confirmed:'Đã xác nhận',declined:'Không được chấp thuận',cancelled:'Đã hủy',completed:'Đã tư vấn'}
async function submit(){
 if(loading.value)return
 loading.value=true;message.value='';failure.value=''
 try{
  let preferredAt=''
  if(chosenSlot.value) preferredAt=new Date(chosenSlot.value.starts_at).toISOString()
  else if(preferredLocal.value) preferredAt=new Date(preferredLocal.value+':00+07:00').toISOString()
  if(!preferredAt||preferredAt==='Invalid Date')throw new Error('Vui lòng chọn hoặc đề xuất thời gian tư vấn.')
  await $fetch('/api/consultations',{method:'POST',body:{category:category.value,subject:subject.value,description:description.value,contactPhone:contactPhone.value,channel:channel.value,preferredAt,slotId:chosenSlot.value?.id||null}})
  message.value='Đã gửi yêu cầu tư vấn. Đây chưa phải lịch được cán bộ xác nhận.'
  subject.value='';description.value='';selectedSlot.value='';preferredLocal.value=''
  await Promise.all([refresh(),refreshSlots()])
 }catch(e){failure.value=readableError(e)}finally{loading.value=false}
}
async function cancel(id:string){if(!confirm('Bạn muốn hủy yêu cầu tư vấn này?'))return;failure.value='';try{await $fetch(`/api/consultations/${id}/cancel`,{method:'POST'});await refresh();await refreshSlots()}catch(e){failure.value=readableError(e)}}
</script>
<template>
 <div class="space-y-4">
  <header><h2 class="text-xl font-black text-brand-900">Đặt lịch tư vấn trực tuyến</h2><p class="mt-1 text-sm text-muted">Gửi câu hỏi và đề nghị cán bộ phụ trách tư vấn qua điện thoại hoặc trực tuyến.</p></header>
  <div class="rounded-xl border-l-4 border-l-amber-600 bg-amber-50 p-4 text-sm text-amber-950" role="note">Lịch chỉ có hiệu lực sau khi cán bộ xác nhận. Những khung giờ đề xuất không phải thời gian đã được đặt thành công. Liên kết họp chỉ xuất hiện khi cán bộ cung cấp.</div>
  <form class="panel space-y-4 p-4 sm:p-5" @submit.prevent="submit"><h3 class="section-label"><CalendarClock :size="20"/>Đề nghị tư vấn</h3>
   <div class="grid gap-4 sm:grid-cols-2"><div><label for="consult-category" class="field-label">Lĩnh vực <span aria-hidden="true">*</span></label><select id="consult-category" v-model="category" class="field" required><option value="" disabled>Chọn lĩnh vực</option><option v-for="c in categories" :key="c" :value="c">{{c}}</option></select></div>
    <div><label for="consult-channel" class="field-label">Hình thức <span aria-hidden="true">*</span></label><select id="consult-channel" v-model="channel" class="field"><option value="phone">Điện thoại</option><option value="online">Trao đổi trực tuyến</option></select></div>
    <div class="sm:col-span-2"><label for="consult-subject" class="field-label">Nội dung cần tư vấn <span aria-hidden="true">*</span></label><input id="consult-subject" v-model="subject" class="field" maxlength="150" minlength="5" required placeholder="Ví dụ: Hồ sơ đăng ký khai sinh có yếu tố nước ngoài"/></div>
    <div class="sm:col-span-2"><label for="consult-description" class="field-label">Mô tả tình huống <span aria-hidden="true">*</span></label><textarea id="consult-description" v-model="description" class="field" rows="3" minlength="10" maxlength="2000" required placeholder="Nêu câu hỏi cần cán bộ chuẩn bị trước buổi tư vấn. Không nhập mật khẩu hoặc số định danh nhạy cảm."/></div>
    <div><label for="consult-phone" class="field-label">Số điện thoại liên hệ <span aria-hidden="true">*</span></label><input id="consult-phone" v-model="contactPhone" type="tel" inputmode="tel" class="field" minlength="9" maxlength="15" required autocomplete="tel" placeholder="09xxxxxxxx"/></div>
    <div><label for="consult-slot" class="field-label">Khung giờ do cán bộ công bố</label><select id="consult-slot" v-model="selectedSlot" class="field"><option value="">Chưa chọn — tự đề xuất thời gian</option><option v-for="s in slotsData?.items||[]" :key="s.id" :value="s.id">{{dateTime(s.starts_at)}} · Còn {{s.remaining}} lượt</option></select></div>
    <div v-if="!selectedSlot" class="sm:col-span-2"><label for="consult-preferred" class="field-label">Thời gian bạn mong muốn <span aria-hidden="true">*</span></label><input id="consult-preferred" v-model="preferredLocal" type="datetime-local" class="field" :min="futureMin" required/><p class="mt-1 text-xs text-muted">Giờ Việt Nam (UTC+7). Thời gian đề xuất phải được cán bộ xem xét trước khi xác nhận.</p></div>
   </div><p v-if="!slotsData?.items?.length" class="text-xs text-muted">Chưa có khung giờ trống nào được cán bộ công bố cho lĩnh vực này. Bạn vẫn có thể gửi đề nghị thời gian mong muốn.</p>
   <p v-if="message" role="status" class="rounded-lg bg-green-50 p-3 text-sm text-green-800">{{message}}</p><p v-if="failure" role="alert" class="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{{failure}}</p>
   <button type="submit" class="btn-primary" :disabled="loading||!category">{{loading?'Đang gửi...':'Gửi yêu cầu tư vấn'}}</button>
  </form>
  <section class="panel p-4 sm:p-5"><div class="mb-3 flex items-center justify-between gap-2"><h3 class="section-label !mb-0">Lịch tư vấn của tôi</h3><button type="button" class="btn-outline !py-1.5" @click="refresh()"><RefreshCw :size="15"/>Làm mới</button></div>
   <p v-if="error" role="alert" class="text-sm text-rose-700">Không tải được lịch tư vấn.</p><p v-else-if="!appointments?.items.length" class="text-sm text-muted">Bạn chưa gửi yêu cầu tư vấn nào.</p>
   <div v-for="item in appointments?.items||[]" :key="item.id" class="mb-3 rounded-xl border border-slate-200 p-4 last:mb-0"><div class="flex flex-wrap items-start justify-between gap-2"><div><h4 class="font-bold text-brand-900">{{item.subject}}</h4><p class="mt-1 text-sm text-muted">{{item.category}} · {{dateTime(item.preferred_at)}} · {{item.channel==='phone'?'Điện thoại':'Trực tuyến'}}</p></div><span :class="['rounded-full px-3 py-1 text-xs font-bold',item.status==='confirmed'?'bg-green-100 text-green-800':item.status==='pending'?'bg-amber-100 text-amber-800':'bg-slate-100 text-slate-700']">{{labels[item.status]||item.status}}</span></div><p class="mt-2 whitespace-pre-wrap text-sm">{{item.description}}</p><p v-if="item.staff_note" class="mt-2 rounded-lg bg-blue-50 p-3 text-sm">Phản hồi cán bộ: {{item.staff_note}}</p><a v-if="item.status==='confirmed'&&item.meeting_url?.startsWith('https://')" class="mt-2 inline-block text-sm font-bold text-brand-700 underline" :href="item.meeting_url" target="_blank" rel="noopener noreferrer">Mở liên kết tư vấn</a><button v-if="['pending','confirmed'].includes(item.status)" type="button" class="mt-3 flex items-center gap-1 text-xs font-semibold text-rose-700 underline" @click="cancel(item.id)"><XCircle :size="15"/>Hủy lịch</button></div>
  </section>
 </div>
</template>
