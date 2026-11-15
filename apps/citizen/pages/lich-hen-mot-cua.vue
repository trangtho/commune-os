<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { CalendarClock, RefreshCw, Ticket, XCircle } from 'lucide-vue-next'
import type { Procedure } from '~/types/models'
interface Slot {id:string;procedure_id:string;procedure_title:string;locality_name:string;starts_at:string;ends_at:string;remaining:number;capacity:number;serving_ticket_no:number|null}
interface Booking {id:string;procedure_id:string;procedure_title:string;ticket_number:number;status:string;starts_at:string;ends_at:string;serving_ticket_no:number|null;locality_name:string}
const {data:procedures}=await useFetch<Procedure[]>('/api/procedures',{key:'counter-procedures'})
const procedureId=ref('')
const selectedSlot=ref('')
const {data:slotData,error:slotError,refresh:refreshSlots}=await useFetch<{items:Slot[];publishedOnly:boolean}>('/api/counter/slots',{
 key:'citizen-counter-slots',query:computed(()=>({procedureId:procedureId.value}))})
const {data:bookingData,error:bookingError,refresh:refreshBookings}=await useFetch<{items:Booking[]}>('/api/counter/bookings',{key:'citizen-counter-bookings'})
const busy=ref(false),notice=ref(''),failure=ref('')
const {dateTime}=useFormat()
watch(procedureId,()=>{selectedSlot.value='';void refreshSlots()})
const selected=computed(()=>slotData.value?.items.find(x=>x.id===selectedSlot.value))
const labels:Record<string,string>={booked:'Đã đặt số',checked_in:'Đã đến quầy',serving:'Đang phục vụ',done:'Đã tiếp nhận',no_show:'Không có mặt',cancelled:'Đã hủy'}
async function book(){
 if(!selected.value||busy.value)return
 busy.value=true;notice.value='';failure.value=''
 try{
  const result=await $fetch<{ticket_number:number}>('/api/counter/bookings',{method:'POST',body:{slotId:selected.value.id}})
  notice.value=`Đã cấp số thứ tự ${result.ticket_number}. Bạn có thể xem trong Danh sách lịch hẹn.`
  selectedSlot.value=''
  await Promise.all([refreshBookings(),refreshSlots()])
 }catch(error){failure.value=readableError(error)}finally{busy.value=false}
}
async function cancel(id:string){
 if(!confirm('Bạn có chắc muốn hủy lịch tại quầy này?'))return
 failure.value='';notice.value=''
 try{await $fetch(`/api/counter/bookings/${encodeURIComponent(id)}/cancel`,{method:'POST'});notice.value='Đã hủy số thứ tự.';await Promise.all([refreshBookings(),refreshSlots()])}
 catch(error){failure.value=readableError(error)}
}
async function refreshAll(){await Promise.all([refreshSlots(),refreshBookings()])}
</script>
<template>
 <div class="space-y-4">
  <header><h2 class="text-xl font-black text-brand-900">Lịch hẹn và số thứ tự tại bộ phận một cửa</h2>
   <p class="mt-1 text-sm text-muted">Đặt số theo khung giờ đã được cán bộ công bố, xem mã hẹn và trạng thái phục vụ.</p></header>
  <div class="rounded-xl border-l-4 border-amber-600 bg-amber-50 p-4 text-sm text-amber-950">Chỉ khung giờ do cán bộ công bố mới có thể đặt. Số đang phục vụ chỉ hiển thị khi bộ phận một cửa cập nhật; không có dự đoán thời gian chờ. Lịch hẹn không thay thế thủ tục tiếp nhận chính thức.</div>
  <section class="panel space-y-4 p-4 sm:p-5">
   <h3 class="section-label"><CalendarClock :size="19"/>Chọn lịch tại quầy</h3>
   <div><label class="field-label" for="counter-procedure">Thủ tục hành chính</label>
    <select id="counter-procedure" v-model="procedureId" class="field"><option value="">Tất cả thủ tục</option><option v-for="p in procedures||[]" :key="p.id" :value="p.id">{{p.title}}</option></select></div>
   <p v-if="slotError" role="alert" class="text-sm text-rose-700">Không tải được lịch tiếp nhận. <button class="font-bold underline" @click="refreshSlots()">Thử lại</button></p>
   <p v-else-if="!slotData?.items.length" class="rounded-lg bg-slate-50 p-3 text-sm text-muted">Chưa có khung giờ còn chỗ được công bố tại địa phương của tài khoản. Bạn có thể theo dõi và thử lại sau.</p>
   <div v-else class="grid gap-3 sm:grid-cols-2">
    <label v-for="slot in slotData.items" :key="slot.id" class="cursor-pointer rounded-xl border p-3 text-sm" :class="selectedSlot===slot.id?'border-blue-500 bg-blue-50':'border-slate-200'">
     <input v-model="selectedSlot" type="radio" name="counter-slot" :value="slot.id" class="mr-2 accent-brand-600" />
     <b class="break-words">{{slot.procedure_title}}</b><span class="mt-1 block">{{dateTime(slot.starts_at)}} – {{dateTime(slot.ends_at)}}</span>
     <span class="mt-1 block text-xs text-muted">{{slot.locality_name}} · Còn {{slot.remaining}}/{{slot.capacity}} lượt</span>
    </label>
   </div>
   <p v-if="notice" role="status" class="rounded-lg bg-green-50 p-3 text-sm text-green-900">{{notice}}</p>
   <p v-if="failure" role="alert" class="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{{failure}}</p>
   <button class="btn-primary" type="button" :disabled="!selected||busy" @click="book"><Ticket :size="17"/>{{busy?'Đang cấp số...':'Xác nhận lấy số thứ tự'}}</button>
  </section>
  <section class="panel space-y-3 p-4 sm:p-5" aria-labelledby="counter-bookings-title">
   <div class="flex flex-wrap items-center justify-between gap-2"><h3 id="counter-bookings-title" class="section-label !mb-0">Lịch và số thứ tự của tôi</h3><button type="button" class="btn-outline !py-1.5" @click="refreshAll"><RefreshCw :size="15"/>Cập nhật</button></div>
   <p v-if="bookingError" role="alert" class="text-sm text-rose-700">Không tải được lịch đã đăng ký.</p>
   <p v-else-if="!bookingData?.items.length" class="text-sm text-muted">Bạn chưa đặt số thứ tự nào.</p>
   <div v-for="booking in bookingData?.items||[]" :key="booking.id" class="rounded-xl border border-slate-200 p-4">
    <div class="flex flex-wrap items-start justify-between gap-2"><div><p class="text-sm font-extrabold text-brand-900">Số {{booking.ticket_number}} · {{booking.procedure_title}}</p><p class="mt-1 text-xs text-muted">{{booking.locality_name}} · {{dateTime(booking.starts_at)}}</p></div><span class="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800">{{labels[booking.status]||booking.status}}</span></div>
    <p class="mt-3 text-sm">Đang phục vụ: <strong>{{booking.serving_ticket_no===null?'Chưa có dữ liệu cập nhật':`Số ${booking.serving_ticket_no}`}}</strong></p>
    <button v-if="booking.status==='booked'&&new Date(booking.starts_at).getTime()>Date.now()" type="button" class="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-rose-700 underline" @click="cancel(booking.id)"><XCircle :size="15"/>Hủy lịch</button>
   </div>
  </section>
 </div>
</template>
