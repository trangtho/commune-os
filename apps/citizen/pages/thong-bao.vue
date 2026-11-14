<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import {Bell,CheckCheck,RefreshCw} from 'lucide-vue-next'
import type {Notice} from '~/types/models'
const {data:notices,error,refresh}=await useFetch<Notice[]>('/api/notifications', {key:'citizen-notifications'})
const {dateTime}=useFormat();const onlyUnread=ref(false)
const filtered=computed(()=>notices.value?.filter(n=>!onlyUnread.value||!n.is_read)||[])
const unread=computed(()=>notices.value?.filter(n=>!n.is_read).length||0)
const busy=ref(false);const pendingId=ref('');const errorText=ref('')
async function readOne(id:string){
 if(busy.value||pendingId.value)return
 pendingId.value=id;errorText.value=''
 try{await $fetch(`/api/notifications/${id}/read`,{method:'POST'});await refresh();await refreshNuxtData('citizen-notifications-badge')}
 catch(e){errorText.value=readableError(e)}finally{pendingId.value=''}
}
async function readAll(){
 if(busy.value||!unread.value)return
 busy.value=true;errorText.value=''
 try{await $fetch('/api/notifications/read-all',{method:'POST'});await refresh();await refreshNuxtData('citizen-notifications-badge')}
 catch(e){errorText.value=readableError(e)}finally{busy.value=false}
}
</script>
<template><div class="space-y-4"><div class="flex flex-wrap items-center justify-between gap-2"><div><h2 class="text-xl font-black">Thông báo</h2><p class="text-sm text-muted">Cập nhật tình hình hồ sơ và các yêu cầu bổ sung.</p></div><button class="btn-outline" :disabled="busy||!unread" @click="readAll"><CheckCheck :size="16"/> Đánh dấu tất cả đã đọc</button></div><div class="flex gap-2"><button :class="['rounded-lg px-3 py-2 text-sm font-bold',!onlyUnread?'bg-blue-600 text-white':'bg-white text-slate-600']" @click="onlyUnread=false">Tất cả ({{notices?.length||0}})</button><button :class="['rounded-lg px-3 py-2 text-sm font-bold',onlyUnread?'bg-blue-600 text-white':'bg-white text-slate-600']" @click="onlyUnread=true">Chưa đọc ({{unread}})</button></div><div v-if="error" class="panel space-y-3 border-rose-200 p-5 text-rose-700">Không thể tải thông báo. <button class="btn-outline" @click="refresh()"><RefreshCw :size="16"/>Thử lại</button></div><p v-if="errorText" role="alert" class="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{{errorText}}</p><div v-if="!error&&!filtered.length" class="panel p-7 text-center text-muted">Chưa có thông báo phù hợp.</div><div v-for="n in (error?[]:filtered)" :key="n.id" :class="['panel flex items-start gap-3 p-4',!n.is_read?'!bg-blue-50':'']"><span class="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-brand-600"><Bell :size="22"/></span><div class="min-w-0 flex-1"><div class="flex flex-wrap items-start justify-between gap-2"><h3 class="text-sm font-extrabold">{{n.title}} <span v-if="!n.is_read" class="ml-1 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] text-white">Mới</span></h3><small class="text-muted">{{dateTime(n.created_at)}}</small></div><p class="mt-1 text-sm leading-relaxed text-slate-600">{{n.body}}</p><div class="mt-3 flex flex-wrap gap-3"><NuxtLink v-if="n.application_id" :to="`/ho-so/${n.application_id}`" class="text-xs font-bold text-brand-700">Xem hồ sơ →</NuxtLink><button v-if="!n.is_read" class="text-xs font-bold text-slate-500 hover:text-brand-700 disabled:opacity-50" :disabled="pendingId===n.id||busy" @click="readOne(n.id)">Đánh dấu đã đọc</button></div></div></div></div></template>
