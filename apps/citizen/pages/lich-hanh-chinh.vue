<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import {CalendarDays,Check,PlusCircle,RefreshCw,Bell} from 'lucide-vue-next'
definePageMeta({title:'Lịch hành chính và nhắc việc'})
type Event={id:string;kind:'case'|'task'|'appointment';title:string;date:string;due_on?:string;completed_at?:string|null;application_id?:string|null}
type Data={settings:{enabled:boolean;days_before:number};items:Event[];notice:string}
const {data:auth}=await useFetch<{authenticated:boolean}>('/api/auth/me',{key:'citizen-calendar-auth'})
const {data,error,refresh}=await useFetch<Data>('/api/citizen/reminders',{key:'citizen-calendar-v1',immediate:Boolean(auth.value?.authenticated)})
const enabled=ref(false);const daysBefore=ref(2)
watch(data,r=>{if(r){enabled.value=r.settings.enabled;daysBefore.value=r.settings.days_before}},{immediate:true})
const title=ref('');const dueOn=ref('');const busy=ref(false);const message=ref('');const formError=ref('')
async function settings(){if(busy.value)return;busy.value=true;formError.value='';message.value=''
 try{await $fetch('/api/citizen/reminders/settings',{method:'PUT',body:{enabled:enabled.value,daysBefore:Number(daysBefore.value)}});message.value='Đã lưu lựa chọn nhắc việc trong ứng dụng.';await refresh()}
 catch(e){formError.value=readableError(e)}finally{busy.value=false}}
async function add(){if(title.value.trim().length<3||!dueOn.value||busy.value)return;busy.value=true;formError.value=''
 try{await $fetch('/api/citizen/reminders',{method:'POST',body:{title:title.value.trim(),dueOn:dueOn.value}});title.value='';dueOn.value='';message.value='Đã thêm công việc.';await refresh()}
 catch(e){formError.value=readableError(e)}finally{busy.value=false}}
async function toggle(t:Event){if(busy.value||t.kind!=='task')return;busy.value=true
 try{await $fetch(`/api/citizen/reminders/${t.id}/complete`,{method:'PATCH',body:{completed:!t.completed_at}});await refresh()}
 catch(e){formError.value=readableError(e)}finally{busy.value=false}}
</script>
<template><div class="space-y-4"><section class="panel space-y-2 p-5"><div class="flex items-center gap-2"><CalendarDays class="text-brand-700" :size="25"/><h2 class="text-xl font-black">Lịch và công việc hành chính</h2></div><p class="text-sm text-muted">Tổng hợp hạn xử lý đã lưu, lịch hẹn tại quầy và công việc do bạn tự tạo. Chỉ gửi thông báo trong ứng dụng khi bạn bật nhắc việc.</p></section>
 <p v-if="!auth?.authenticated" class="panel p-5 text-sm"><NuxtLink to="/dang-nhap" class="font-bold text-brand-700 underline">Đăng nhập</NuxtLink> để xem lịch cá nhân.</p>
 <p v-else-if="error" class="panel p-5 text-sm text-rose-700">Không thể tải lịch. <button class="underline" @click="refresh()">Thử lại</button></p>
 <template v-else-if="data"><div class="grid gap-3 lg:grid-cols-2"><form class="panel space-y-3 p-5" @submit.prevent="settings"><h3 class="flex items-center gap-2 font-extrabold"><Bell :size="18"/>Cài đặt thông báo</h3><label class="flex items-start gap-2 text-sm"><input v-model="enabled" type="checkbox" class="mt-1 accent-blue-700"/>Bật nhắc việc trong ứng dụng (không gửi SMS/email)</label><label class="block text-sm font-semibold">Nhắc trước bao nhiêu ngày?<select v-model.number="daysBefore" class="field mt-1"><option v-for="i in 15" :key="i-1" :value="i-1">{{i-1}} ngày</option></select></label><button class="btn-primary" type="submit" :disabled="busy">Lưu cài đặt</button><p class="text-xs text-muted">Tự động gửi yêu cầu dịch vụ trên máy chủ đã bật `CITIZEN_REMINDERS_ENABLED=true`.</p></form>
 <form class="panel space-y-3 p-5" @submit.prevent="add"><h3 class="flex items-center gap-2 font-extrabold"><PlusCircle :size="18"/>Thêm việc cần làm</h3><label class="block text-sm font-semibold">Nội dung<input v-model="title" class="field mt-1" maxlength="140" minlength="3" required placeholder="Ví dụ: Chuẩn bị giấy tờ cho lịch hẹn"/></label><label class="block text-sm font-semibold">Ngày cần hoàn tất<input v-model="dueOn" class="field mt-1" type="date" required/></label><button class="btn-primary" type="submit" :disabled="busy||title.trim().length<3||!dueOn">Thêm vào lịch</button></form></div>
 <p v-if="message" class="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900" role="status">{{message}}</p><p v-if="formError" class="rounded-lg bg-rose-50 p-3 text-sm text-rose-700" role="alert">{{formError}}</p>
 <section class="panel space-y-3 p-5"><div class="flex items-center justify-between"><h3 class="font-extrabold">Các mốc cần theo dõi ({{data.items.length}})</h3><button class="btn-outline !text-xs" @click="refresh()"><RefreshCw :size="14"/>Làm mới</button></div><p v-if="!data.items.length" class="text-sm text-muted">Chưa có lịch hoặc công việc.</p>
 <div v-for="item in data.items" :key="`${item.kind}:${item.id}`" class="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"><div><p class="font-semibold">{{item.title}}</p><p class="mt-1 text-xs text-muted">{{item.kind==='task'?'Việc cá nhân':item.kind==='case'?'Hạn xử lý hồ sơ':'Lịch tại quầy'}} · {{new Date(item.date).toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric',hour:item.kind==='appointment'?'2-digit':undefined,minute:item.kind==='appointment'?'2-digit':undefined})}}</p></div>
 <button v-if="item.kind==='task'" class="btn-outline !text-xs" :disabled="busy" @click="toggle(item)"><Check :size="14"/>{{item.completed_at?'Mở lại':'Đã hoàn tất'}}</button><NuxtLink v-else-if="item.kind==='case'" :to="`/ho-so/${item.id}`" class="text-xs font-bold text-brand-700 underline">Xem hồ sơ</NuxtLink><NuxtLink v-else to="/lich-hen-mot-cua" class="text-xs font-bold text-brand-700 underline">Xem lịch hẹn</NuxtLink></div>
 <p class="text-xs text-muted">{{data.notice}}</p></section></template></div></template>
