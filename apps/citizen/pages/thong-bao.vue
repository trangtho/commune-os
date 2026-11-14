<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { Bell, CheckCheck, RefreshCw, Search, Wifi, WifiOff } from 'lucide-vue-next'
import type { Notice } from '~/types/models'
const q = ref(''), search = ref(''), unreadOnly = ref(false), category = ref(''), page = ref(1)
const liveStatus = useState<'connecting'|'online'|'offline'>('citizen-live-status', () => 'connecting')
const params = computed(() => ({paged:'1',page:String(page.value),q:search.value,category:category.value,unread:unreadOnly.value?'1':'0'}))
const {data, error, pending, refresh} = await useFetch<{items:Notice[];total:number;page:number;pageSize:number;unreadCount:number;categories:{category:string;count:number}[]}>('/api/notifications', {key:'citizen-notifications-page',query:params,default:()=>({items:[],total:0,page:1,pageSize:15,unreadCount:0,categories:[]})})
const {dateTime} = useFormat()
const busy = ref(false), pendingId = ref(''), errorText = ref('')
watch([category, unreadOnly], () => {page.value=1})
function applySearch(){ search.value=q.value.trim();page.value=1 }
async function mark(id?:string) {
  if(busy.value||pendingId.value)return
  errorText.value='';if(id)pendingId.value=id;else busy.value=true
  try {
    await $fetch(id?`/api/notifications/${encodeURIComponent(id)}/read`:'/api/notifications/read-all',{method:'POST'})
    await Promise.all([refresh(),refreshNuxtData(['citizen-notifications','citizen-notifications-badge'])])
  }catch(e){errorText.value=readableError(e)}finally{busy.value=false;pendingId.value=''}
}
</script>
<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2"><div><h2 class="text-xl font-black">Trung tâm thông báo</h2><p class="text-sm text-muted">Tìm kiếm, lọc và theo dõi thay đổi hồ sơ.</p></div><div class="flex flex-wrap items-center gap-2"><span :class="['inline-flex items-center gap-1 text-xs',liveStatus==='online'?'text-green-700':'text-amber-700']"><Wifi v-if="liveStatus==='online'" :size="14"/><WifiOff v-else :size="14"/>{{liveStatus==='online'?'Đang nhận cập nhật trực tiếp':'Đang đồng bộ lại kết nối'}}</span><button class="btn-outline" :disabled="busy||!data?.unreadCount" @click="mark()"><CheckCheck :size="16"/>Đánh dấu đã đọc</button></div></div>
    <form class="panel flex flex-wrap items-end gap-3 p-4" role="search" @submit.prevent="applySearch"><div class="min-w-0 flex-[1_1_220px]"><label for="notice-search" class="field-label">Tìm thông báo</label><div class="flex items-center gap-2"><Search :size="16"/><input id="notice-search" v-model="q" class="field" maxlength="100" placeholder="Nội dung hoặc tiêu đề"/></div></div><div class="min-w-[140px]"><label for="notice-category" class="field-label">Phân loại</label><select id="notice-category" v-model="category" class="field"><option value="">Tất cả loại</option><option v-for="group in data?.categories||[]" :key="group.category" :value="group.category">{{group.category}} ({{group.count}})</option></select></div><label class="inline-flex items-center gap-2 text-sm"><input v-model="unreadOnly" type="checkbox" class="h-4 w-4"/>Chỉ chưa đọc ({{data?.unreadCount||0}})</label><button type="submit" class="btn-primary">Tìm kiếm</button></form>
    <p v-if="errorText" role="alert" class="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{{errorText}}</p>
    <p v-if="error" role="alert" class="panel p-4 text-sm text-rose-700">Lỗi tải thông báo. <button class="btn-outline" @click="refresh()"><RefreshCw :size="14"/>Thử lại</button></p>
    <p v-else-if="pending" role="status" class="panel p-4 text-sm text-muted">Đang tải thông báo...</p>
    <p v-else-if="!data?.items.length" class="panel p-5 text-sm text-muted">Chưa có thông báo phù hợp.</p>
    <div v-for="n in data?.items||[]" :key="n.id" :class="['panel flex items-start gap-3 p-4',!n.is_read?'!bg-blue-50':'']"><span class="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white text-brand-600"><Bell :size="21"/></span><div class="min-w-0 flex-1"><div class="flex flex-wrap items-start justify-between gap-2"><h3 class="text-sm font-extrabold">{{n.title}} <span v-if="!n.is_read" class="rounded bg-blue-600 px-1.5 py-0.5 text-[10px] text-white">Mới</span></h3><time class="text-xs text-muted">{{dateTime(n.created_at)}}</time></div><p class="mt-1 whitespace-pre-wrap break-words text-sm text-slate-600">{{n.body}}</p><div class="mt-2 flex flex-wrap gap-3"><NuxtLink v-if="n.application_id" :to="`/ho-so/${n.application_id}`" class="text-xs font-bold text-brand-700">Xem hồ sơ</NuxtLink><button v-if="!n.is_read" :disabled="!!pendingId||busy" class="text-xs font-bold text-brand-700 underline" @click="mark(n.id)">Đánh dấu đã đọc</button></div></div></div>
    <div v-if="(data?.total||0)>(data?.pageSize||15)" class="flex items-center justify-center gap-3"><button class="btn-outline" :disabled="page<=1" @click="page--">Trang trước</button><span class="text-sm">{{data?.page}} / {{Math.ceil((data?.total||0)/(data?.pageSize||15))}}</span><button class="btn-outline" :disabled="(data?.page||1)*(data?.pageSize||15)>=(data?.total||0)" @click="page++">Trang sau</button></div>
  </div>
</template>
