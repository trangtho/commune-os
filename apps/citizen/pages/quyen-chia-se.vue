<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import {ShieldCheck,ShieldAlert,RefreshCw,LockKeyhole,CheckCircle2} from 'lucide-vue-next'
type Purpose={id:string;title:string;description:string;legal_basis:'consent'|'other_legal_basis';basis_explanation:string;
 categories:string[];recipients:string;validity_days:number|null;decision:string|null;valid_until:string|null;active:boolean}
type ConsentEvent={id:number;purpose_id:string;title:string;decision:string;decided_at:string;valid_until:string|null}
const {data,pending,error,refresh}=await useFetch<{items:Purpose[];history:ConsentEvent[]}>(
 '/api/citizen/consents',{key:'citizen-consent-center'})
const {dateTime}=useFormat()
const acting=ref('');const notice=ref('');const failure=ref('')
const confirmation=ref('')
async function decide(p:Purpose){
 if(acting.value)return
 if(confirmation.value!==p.id){confirmation.value=p.id;return}
 acting.value=p.id;failure.value='';notice.value=''
 try{
  const response=await $fetch<{notice:string}>(`/api/citizen/consents/${encodeURIComponent(p.id)}`,{
   method:'POST',body:{decision:p.active?'withdrawn':'granted',confirmed:true}})
  notice.value=p.active?'Đã ghi nhận rút sự đồng ý.':'Đã ghi nhận cấp sự đồng ý.'
  if(p.active)notice.value+=' '+response.notice
  confirmation.value='';await refresh()
 }catch(e){failure.value=readableError(e)}finally{acting.value=''}
}
</script>
<template>
 <div class="space-y-4">
  <div class="flex flex-wrap items-center justify-between gap-3"><div><h2 class="text-xl font-black">Trung tâm quyền chia sẻ dữ liệu</h2><p class="mt-1 text-sm text-muted">Biết dữ liệu được sử dụng với mục đích gì, bởi ai và trong thời gian bao lâu.</p></div><button class="btn-outline" :disabled="pending" @click="refresh()"><RefreshCw :size="16"/> Làm mới</button></div>
  <div class="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-brand-900">Sự đồng ý và căn cứ pháp lý khác là hai cơ chế riêng biệt. Rút đồng ý chỉ ảnh hưởng hoạt động sử dụng trong tương lai thuộc phạm vi quyền đó, không tự thu hồi dữ liệu đã nằm trong hồ sơ nộp trước.</div>
  <p v-if="notice" role="status" class="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{{notice}}</p><p v-if="failure" role="alert" class="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{{failure}}</p>
  <p v-if="error" role="alert" class="panel p-4 text-rose-700">Không tải được thông tin quyền chia sẻ.</p><p v-else-if="pending" class="panel p-4 text-sm text-muted">Đang tải quyền chia sẻ...</p>
  <article v-for="p in data?.items||[]" :key="p.id" class="panel space-y-3 p-5">
   <div class="flex flex-wrap items-start justify-between gap-2"><div class="flex items-center gap-2"><ShieldCheck v-if="p.legal_basis==='consent'" :size="21" class="text-brand-700"/><LockKeyhole v-else :size="21" class="text-slate-500"/><h3 class="font-extrabold text-brand-900">{{p.title}}</h3></div><span :class="['rounded-lg px-2 py-1 text-xs font-bold',p.legal_basis!=='consent'?'bg-slate-100 text-slate-700':p.active?'bg-emerald-50 text-emerald-800':'bg-amber-50 text-amber-800']">{{p.legal_basis!=='consent'?'Căn cứ pháp lý khác':p.active?'Đã đồng ý':'Chưa đồng ý / Đã rút'}}</span></div>
   <p class="text-sm leading-relaxed text-slate-700">{{p.description}}</p><dl class="grid gap-2 text-sm sm:grid-cols-2"><div><dt class="text-xs text-muted">Nhóm dữ liệu</dt><dd class="font-semibold">{{p.categories.join(', ')}}</dd></div><div><dt class="text-xs text-muted">Đơn vị nhận / xử lý</dt><dd class="font-semibold">{{p.recipients}}</dd></div><div><dt class="text-xs text-muted">Thời hạn</dt><dd>{{p.legal_basis==='consent'?(p.valid_until?'Đến '+dateTime(p.valid_until):`Tối đa ${p.validity_days} ngày kể từ khi đồng ý`):'Theo căn cứ riêng sau khi được phê duyệt'}}</dd></div><div><dt class="text-xs text-muted">Căn cứ / mục đích</dt><dd>{{p.basis_explanation}}</dd></div></dl>
   <div v-if="p.legal_basis==='consent'" class="border-t pt-3"><div v-if="confirmation===p.id" class="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"><div class="flex items-start gap-2"><ShieldAlert :size="17" class="mt-0.5 shrink-0"/><p>Hãy xác nhận {{p.active?'rút':'cấp'}} quyền cho đúng mục đích đã mô tả. {{p.active?'Quyết định chỉ áp dụng cho việc chia sẻ sau thời điểm rút.':'Bạn vẫn phải xác nhận riêng mỗi lần dùng giấy tờ cho hồ sơ.'}}</p></div><div class="mt-3 flex gap-2"><button class="btn-primary" :disabled="acting===p.id" @click="decide(p)">Xác nhận {{p.active?'rút':'cấp'}} quyền</button><button class="btn-outline" @click="confirmation=''">Hủy</button></div></div><button v-else type="button" :disabled="!!acting" :class="p.active?'btn-outline':'btn-primary'" @click="decide(p)">{{p.active?'Rút sự đồng ý':'Cấp sự đồng ý'}}</button></div>
   <p v-else class="flex items-start gap-2 text-xs text-slate-600"><CheckCircle2 :size="15" class="shrink-0"/> Hoạt động này không có thao tác rút đồng ý. Bạn có thể gửi yêu cầu về dữ liệu cá nhân nếu cần làm rõ căn cứ.</p>
  </article>
  <section v-if="data?.history.length" class="panel space-y-3 p-4"><h3 class="font-extrabold">Lịch sử quyết định</h3><div v-for="h in data.history" :key="h.id" class="flex flex-wrap justify-between gap-2 border-b border-slate-100 py-2 text-sm"><span>{{h.title}} · <b>{{h.decision==='granted'?'Đã cấp':'Đã rút'}}</b></span><time class="text-xs text-muted">{{dateTime(h.decided_at)}}</time></div></section>
  <NuxtLink to="/vong-doi-du-lieu" class="inline-flex text-sm font-bold text-brand-700 underline">Gửi yêu cầu xem xét dữ liệu cá nhân</NuxtLink>
 </div>
</template>
