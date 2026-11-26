<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { Layers3,ArrowRight,ShieldAlert,PlusCircle } from 'lucide-vue-next'
import type { Procedure } from '~/types/models'
type Batch={id:string;title:string;procedure_count:number;created_count:number;submitted_count:number;completed_count:number;created_at:string}
const {data:auth}=await useFetch<{authenticated:boolean}>('/api/auth/me',{key:'citizen-auth-batch'})
const {data:procedures,error:procedureError}=await useFetch<Procedure[]>('/api/procedures')
const {data:existing,refresh}=await useFetch<{items:Batch[]}>('/api/service-batches',{key:'citizen-batches-list',immediate:Boolean(auth.value?.authenticated),default:()=>({items:[]})})
const title=ref('');const purpose=ref('');const selected=ref<string[]>([])
const shareConsent=ref(false);const phone=ref('');const busy=ref(false);const errorText=ref('')
const valid=computed(()=>title.value.trim().length>=3&&selected.value.length>=2&&selected.value.length<=4)
function toggle(id:string){if(selected.value.includes(id))selected.value=selected.value.filter(s=>s!==id);else if(selected.value.length<4)selected.value=[...selected.value,id]}
async function create(){
 if(!valid.value||busy.value)return
 busy.value=true;errorText.value=''
 try{
  const result=await $fetch<{id:string}>('/api/service-batches',{method:'POST',body:{title:title.value,purpose:purpose.value,procedureIds:selected.value,shareConsent:shareConsent.value,phone:shareConsent.value?phone.value:''}})
  await refresh();await navigateTo(`/lien-thong/${result.id}`)
 }catch(e:any){errorText.value=e?.data?.statusMessage||'Không thể tạo nhóm hồ sơ, vui lòng kiểm tra dữ liệu và thử lại.'}
 finally{busy.value=false}
}
</script>
<template>
 <div class="space-y-4">
  <div class="flex flex-wrap items-center justify-between gap-3"><div><h2 class="text-xl font-black">Chuẩn bị nhiều thủ tục cùng lúc</h2><p class="mt-1 text-sm text-muted">Gom các thủ tục trong một danh sách theo dõi, tái sử dụng thông tin liên hệ nếu bạn đồng ý.</p></div><NuxtLink to="/goi-y-thu-tuc" class="btn-outline text-sm">Chưa biết chọn thủ tục? <ArrowRight :size="16"/></NuxtLink></div>
  <p class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="note"><ShieldAlert :size="17" class="mr-1 inline"/> Đây là <b>nhóm chuẩn bị hồ sơ</b>, không phải quy trình liên thông chính thức. Mỗi thủ tục có biểu mẫu, giấy tờ, thời hạn và trạng thái riêng; chưa tự động nộp hoặc chia sẻ hồ sơ sang cơ quan khác.</p>
  <section v-if="!auth?.authenticated" class="panel p-5 text-sm"><NuxtLink to="/dang-nhap" class="font-bold text-brand-700 underline">Đăng nhập</NuxtLink> để tạo và lưu nhóm hồ sơ cho tài khoản của bạn. Vẫn có thể <NuxtLink to="/thu-tuc" class="underline">xem danh mục thủ tục</NuxtLink> khi chưa đăng nhập.</section>
  <form v-else class="panel space-y-4 p-4 sm:p-5" @submit.prevent="create">
   <h3 class="font-extrabold text-brand-900"><PlusCircle class="mr-1 inline" :size="19"/> Tạo nhóm hồ sơ chuẩn bị</h3>
   <div class="grid gap-3 md:grid-cols-2"><label class="block text-sm font-semibold">Tên nhóm <span class="text-rose-600">*</span><input v-model="title" class="field mt-1" required minlength="3" maxlength="120" placeholder="Ví dụ: Hồ sơ gia đình tháng 11"/></label><label class="block text-sm font-semibold">Mục đích (tùy chọn)<input v-model="purpose" class="field mt-1" maxlength="500" placeholder="Mô tả ngắn nhu cầu của bạn"/></label></div>
   <fieldset class="space-y-3"><legend class="text-sm font-bold">Chọn 2–4 thủ tục ({{selected.length}}/4)</legend>
    <div v-if="procedureError" role="alert" class="text-sm text-rose-700">Không tải được danh mục thủ tục.</div>
    <div v-else class="grid gap-2 md:grid-cols-2"><label v-for="p in procedures" :key="p.id" :class="['flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm',selected.includes(p.id)?'border-brand-600 bg-blue-50':'border-slate-200']"><input type="checkbox" :checked="selected.includes(p.id)" :disabled="!selected.includes(p.id)&&selected.length>=4" class="mt-1 accent-blue-700" @change="toggle(p.id)"/><span><b class="block">{{p.title}}</b><small class="text-slate-600">{{p.category}}</small></span></label></div>
   </fieldset>
   <div class="space-y-2 border-t pt-3"><label class="flex items-start gap-2 text-sm"><input v-model="shareConsent" type="checkbox" class="mt-1 accent-blue-700"/><span>Tôi đồng ý tái sử dụng <b>họ tên của tài khoản và số điện thoại liên hệ</b> khi kê khai từng hồ sơ trong nhóm. Có thể bỏ chọn nếu không muốn lưu dữ liệu dùng chung.</span></label>
    <label v-if="shareConsent" class="block text-sm font-semibold">Số điện thoại liên hệ (không bắt buộc)<input v-model="phone" class="field mt-1" type="tel" autocomplete="tel" maxlength="20" placeholder="Số liên hệ của bạn"/></label></div>
   <p v-if="errorText" class="text-sm text-rose-700" role="alert">{{errorText}}</p>
   <button type="submit" class="btn-primary" :disabled="!valid||busy">{{busy?'Đang tạo nhóm...':'Tạo nhóm và chuẩn bị hồ sơ'}}<ArrowRight :size="16"/></button>
  </form>
  <section v-if="auth?.authenticated" class="space-y-3"><h3 class="font-extrabold">Nhóm hồ sơ đã lưu</h3><div v-if="!existing?.items.length" class="panel p-4 text-sm text-muted">Bạn chưa tạo nhóm hồ sơ nào.</div>
   <NuxtLink v-for="b in existing?.items" :key="b.id" :to="`/lien-thong/${b.id}`" class="panel flex flex-wrap items-center gap-3 p-4 transition hover:border-brand-400"><Layers3 class="text-brand-700" :size="23"/><span class="min-w-0 flex-1"><b class="block">{{b.title}}</b><small class="text-slate-600">{{b.created_count}}/{{b.procedure_count}} hồ sơ đã tạo · {{b.submitted_count}} đã nộp · {{b.completed_count}} hoàn thành</small></span><ArrowRight class="text-brand-700" :size="18"/></NuxtLink>
  </section>
 </div>
</template>
