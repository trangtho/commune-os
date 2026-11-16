<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import {ArrowLeft,PackageCheck,Truck,MonitorDown,Building2,Save} from 'lucide-vue-next'
const id=String(useRoute().params.id)
interface Method {method:'online'|'counter'|'postal';approval_reference:string;instructions:string}
interface Delivery {method:'online'|'counter'|'postal';delivery_address:string;contact_phone:string;status:string;shipment_reference:string;staff_note:string;updated_at:string}
interface DeliveryResponse {options:Method[];selection:Delivery|null;applicationStatus:string;notice:string}
const {data,error,refresh}=await useFetch<DeliveryResponse>(`/api/applications/${encodeURIComponent(id)}/delivery`)
const method=ref<'online'|'counter'|'postal'>('counter')
const address=ref('')
const phone=ref('')
const busy=ref(false)
const notice=ref('')
const problem=ref('')
const labels={online:'Kết quả điện tử',counter:'Nhận tại bộ phận một cửa',postal:'Chuyển phát đến địa chỉ'}
const statusLabels:Record<string,string>={selected:'Đã đăng ký',ready:'Sẵn sàng trả kết quả',in_transit:'Đang chuyển phát',delivered:'Đã giao kết quả',failed:'Giao nhận chưa thành công'}
const icons={online:MonitorDown,counter:Building2,postal:Truck}
watch(data,value=>{if(value?.selection){method.value=value.selection.method;address.value=value.selection.delivery_address;phone.value=value.selection.contact_phone}
 else if(value?.options.length)method.value=value.options[0].method},{immediate:true})
const locked=computed(()=>Boolean(data.value?.selection&&data.value.selection.status!=='selected'))
const available=computed(()=>Boolean(data.value?.options.some(o=>o.method===method.value)))
async function save(){
 if(busy.value||locked.value||!available.value)return
 busy.value=true;notice.value='';problem.value=''
 try{await $fetch(`/api/applications/${encodeURIComponent(id)}/delivery`,{method:'POST',body:{method:method.value,deliveryAddress:address.value,contactPhone:phone.value}})
 notice.value='Đã ghi nhận lựa chọn của bạn. Thời điểm và cách giao kết quả còn phụ thuộc xác nhận của cơ quan.';await refresh()}
 catch(e){problem.value=readableError(e)}finally{busy.value=false}
}
</script>
<template>
 <div class="space-y-4">
  <NuxtLink :to="`/ho-so/${encodeURIComponent(id)}`" class="inline-flex items-center gap-2 text-sm font-semibold text-brand-700"><ArrowLeft :size="16"/>Về hồ sơ</NuxtLink>
  <div><h2 class="text-xl font-black">Lựa chọn nhận kết quả giải quyết</h2><p class="text-sm text-muted">Hồ sơ {{id}} · Chỉ chọn phương thức được cơ quan có thẩm quyền công bố.</p></div>
  <section v-if="error" class="panel p-5 text-rose-700" role="alert">Không tải được thông tin nhận kết quả. <button class="underline" @click="refresh()">Thử lại</button></section>
  <template v-else-if="data">
   <section class="panel space-y-4 p-5"><h3 class="section-label"><PackageCheck :size="18"/>Phương thức nhận kết quả</h3>
    <p class="text-sm text-muted">{{data.notice}}</p>
    <p v-if="!data.options.length" class="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Chưa có phương thức được duyệt. Hệ thống sẽ không tự giả định nhận trực tuyến hoặc chuyển phát.</p>
    <form v-else class="space-y-4" @submit.prevent="save">
     <fieldset class="grid gap-2"><legend class="field-label">Chọn phương thức</legend>
      <label v-for="option in data.options" :key="option.method" class="flex cursor-pointer gap-3 rounded-lg border border-slate-200 p-3 text-sm"><input v-model="method" type="radio" :value="option.method" :disabled="locked" class="mt-1"/><span><b class="flex items-center gap-2"><component :is="icons[option.method]" :size="16"/>{{labels[option.method]}}</b><span class="mt-1 block text-xs text-muted">{{option.instructions||'Theo hướng dẫn của cơ quan tiếp nhận'}} · Căn cứ: {{option.approval_reference}}</span></span></label>
     </fieldset>
     <div v-if="method==='postal'" class="grid gap-3 sm:grid-cols-2"><div class="sm:col-span-2"><label for="delivery-address" class="field-label">Địa chỉ nhận kết quả</label><textarea id="delivery-address" v-model="address" class="field" rows="3" minlength="10" maxlength="500" required :disabled="locked"/></div><div><label for="delivery-phone" class="field-label">Số điện thoại nhận hàng</label><input id="delivery-phone" v-model="phone" class="field" maxlength="20" required :disabled="locked"/></div></div>
     <button type="submit" class="btn-primary" :disabled="locked||busy||!available||(method==='postal'&&(address.trim().length<10||phone.trim().length<9))"><Save :size="16"/>{{busy?'Đang lưu...':'Lưu lựa chọn nhận kết quả'}}</button>
     <p v-if="locked" class="text-sm text-amber-900">Cơ quan đã cập nhật trạng thái giao nhận; lựa chọn không thể tự thay đổi.</p>
    </form>
   </section>
   <section v-if="data.selection" class="panel space-y-2 p-5 text-sm"><h3 class="section-label">Theo dõi giao nhận</h3>
    <p>Phương thức: <b>{{labels[data.selection.method]}}</b></p>
    <p>Trạng thái: <b>{{statusLabels[data.selection.status]||data.selection.status}}</b></p>
    <p v-if="data.selection.shipment_reference">Mã vận đơn: <b>{{data.selection.shipment_reference}}</b></p>
    <p v-if="data.selection.staff_note" class="whitespace-pre-wrap">Thông tin từ cán bộ: {{data.selection.staff_note}}</p>
    <NuxtLink v-if="data.selection.method==='online'&&data.applicationStatus==='completed'" :to="`/ho-so/${encodeURIComponent(id)}/ket-qua`" class="btn-outline !mt-3">Xem văn bản kết quả điện tử</NuxtLink>
    <p class="text-xs text-muted">Thông tin nhận kết quả là dữ liệu cán bộ xác nhận; việc chọn hình thức không bảo đảm tự động có văn bản hoặc vận đơn.</p>
   </section>
  </template>
  <p v-if="notice" class="rounded-lg bg-green-50 p-3 text-sm text-green-800" role="status">{{notice}}</p>
  <p v-if="problem" class="rounded-lg bg-rose-50 p-3 text-sm text-rose-800" role="alert">{{problem}}</p>
 </div>
</template>
