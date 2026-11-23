<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
// Thông báo riêng cho cán bộ (lõi tự sinh) và, với lãnh đạo xã, khung gửi thông báo cho công dân của xã.
import { Bell,CheckCheck,RefreshCw,Send,ChevronDown,ArrowRight } from 'lucide-vue-next'
import type {Notice} from '~/types/models'
const {data:notices,error,refresh,pending}=await useFetch<Notice[]>('/api/notifications', {key:'staff-notifications'})
const {dateTime}=useFormat();const onlyUnread=ref(false)
const filtered=computed(()=>notices.value?.filter(n=>!onlyUnread.value||!n.is_read)||[])
const unread=computed(()=>notices.value?.filter(n=>!n.is_read).length||0)
const subject=ref('');const body=ref('');const busy=ref(false);const result=ref('');const showCompose=ref(false)
// Chỉ lãnh đạo xã gửi được thông báo cho công dân (lõi cũng kiểm tra lại vai trò).
const {data:staffAuth}=useNuxtData<{role?:string}>('staff-auth');const isLeader=computed(()=>staffAuth.value?.role==='admin')
async function sendAll(){result.value='';if(!subject.value.trim()||!body.value.trim()){result.value='Vui lòng nhập tiêu đề và nội dung.';return}busy.value=true;try{const sent=await $fetch<{sent:number}>('/api/notifications/broadcast',{method:'POST',body:{title:subject.value.trim(),body:body.value.trim()}});result.value=`Đã gửi thông báo tới ${sent.sent} công dân của xã.`;subject.value='';body.value='';await refresh();await refreshNuxtData('staff-notifications-badge')}catch(e){result.value=readableError(e)}finally{busy.value=false}}
async function readAll(){if(busy.value||!unread.value)return;busy.value=true;try{await $fetch('/api/notifications/read-all',{method:'POST'});await refresh();await refreshNuxtData('staff-notifications-badge')}catch(e){result.value=readableError(e)}finally{busy.value=false}}
// Bấm vào một thông báo chưa đọc thì đánh dấu đã đọc; có hồ sơ kèm theo thì mở hồ sơ.
async function openNotice(n:Notice){if(!n.is_read){try{await $fetch(`/api/notifications/${n.id}/read`,{method:'POST'});n.is_read=true;refreshNuxtData('staff-notifications-badge')}catch{}}if(n.application_id)await navigateTo(`/ho-so/${n.application_id}`)}
</script>
<template><div class="space-y-4">
 <section v-if="isLeader" class="panel overflow-hidden">
  <button type="button" class="flex w-full items-center gap-3 px-4 py-3 text-left" :aria-expanded="showCompose" aria-controls="compose-notice" @click="showCompose=!showCompose"><Send :size="18" class="text-brand-700"/><span class="flex-1"><span class="block font-bold text-ink">Gửi thông báo cho công dân</span><span class="block text-sm text-slate-600">Gửi tới từng công dân của xã; chỉ lãnh đạo xã gửi được.</span></span><ChevronDown :size="18" :class="['transition',showCompose?'rotate-180':'']"/></button>
  <form v-if="showCompose" id="compose-notice" class="space-y-3 border-t border-slate-100 p-4" @submit.prevent="sendAll"><div><label for="notice-title" class="field-label">Tiêu đề</label><input id="notice-title" v-model="subject" class="field" required minlength="3" maxlength="150" placeholder="Ví dụ: Lịch tiếp công dân tháng 12"/></div><div><label for="notice-body" class="field-label">Nội dung</label><textarea id="notice-body" v-model="body" class="field" rows="4" required minlength="10" maxlength="2000" placeholder="Nội dung thông báo..."/></div><button class="btn-primary" :disabled="busy||!subject.trim()||!body.trim()" type="submit"><Send :size="16"/> Gửi đến tất cả công dân</button></form>
 </section>
 <p v-if="result" class="rounded-lg border border-brand-200 bg-white p-3 text-sm text-brand-800" role="status">{{result}}</p>
 <section class="panel overflow-hidden">
  <div class="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
   <div class="flex gap-1 rounded-lg bg-slate-100 p-1" role="group" aria-label="Lọc thông báo"><button type="button" :aria-pressed="!onlyUnread" :class="['rounded-md px-3 py-1.5 text-sm font-semibold',!onlyUnread?'bg-white text-ink shadow-sm':'text-slate-600']" @click="onlyUnread=false">Tất cả ({{notices?.length||0}})</button><button type="button" :aria-pressed="onlyUnread" :class="['rounded-md px-3 py-1.5 text-sm font-semibold',onlyUnread?'bg-white text-ink shadow-sm':'text-slate-600']" @click="onlyUnread=true">Chưa đọc ({{unread}})</button></div>
   <div class="ml-auto flex items-center gap-3"><button type="button" class="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-brand-700" :disabled="pending" @click="refresh()"><RefreshCw :size="15" :class="pending?'animate-spin':''"/>Làm mới</button><button type="button" class="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline disabled:text-slate-400 disabled:no-underline" :disabled="busy||!unread" @click="readAll"><CheckCheck :size="16"/>Đánh dấu tất cả đã đọc</button></div>
  </div>
  <div v-if="error" class="p-5 text-sm text-rose-700">Không tải được thông báo. <button class="font-bold underline" @click="refresh()">Thử lại</button></div>
  <p v-else-if="!filtered.length" class="p-8 text-center text-slate-600">{{onlyUnread?'Không còn thông báo chưa đọc.':'Chưa có thông báo nào.'}}</p>
  <ul v-else class="divide-y divide-slate-100">
   <li v-for="n in filtered" :key="n.id"><button type="button" :class="['flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-brand-50/60',n.is_read?'':'bg-brand-50/40']" @click="openNotice(n)">
    <span :class="['mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full',n.is_read?'bg-slate-100 text-slate-500':'bg-brand-100 text-brand-700']"><Bell :size="18"/></span>
    <span class="min-w-0 flex-1"><span class="flex flex-wrap items-baseline justify-between gap-x-3"><span :class="['text-ink',n.is_read?'font-medium':'font-bold']">{{n.title}}<span v-if="!n.is_read" class="ml-2 inline-block h-2 w-2 rounded-full bg-rose-600 align-middle" aria-label="chưa đọc"/></span><small class="text-xs text-slate-600">{{dateTime(n.created_at)}}</small></span><span class="mt-0.5 block text-sm leading-relaxed text-slate-600">{{n.body}}</span><span v-if="n.application_id" class="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-brand-700">Mở hồ sơ {{n.application_id}} <ArrowRight :size="14"/></span></span>
   </button></li>
  </ul>
 </section>
</div></template>
