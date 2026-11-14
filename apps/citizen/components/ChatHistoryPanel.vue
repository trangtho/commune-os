<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { MessageSquareText, Trash2, RefreshCw, History } from 'lucide-vue-next'
import type { CitizenChatThread } from '~/shared/chat-history'
defineProps<{
  items: CitizenChatThread[]
  activeId: string | null
  authenticated: boolean
  loading: boolean
  error: string
  total: number
}>()
const emit = defineEmits<{
  open: [id: string]
  remove: [id: string]
  more: []
  retry: []
}>()
const lastUsed = (value: string) => new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })
</script>
<template>
  <section class="panel min-w-0 p-3" aria-label="Lịch sử hội thoại trợ lý AI">
    <div class="mb-2 flex items-center justify-between gap-2">
      <h3 class="flex items-center gap-2 text-sm font-black text-slate-900"><History :size="18" class="text-brand-700"/> Lịch sử hội thoại</h3>
      <button v-if="authenticated" class="rounded-md p-1 text-slate-500 hover:bg-slate-100" type="button" aria-label="Tải lại lịch sử" :disabled="loading" @click="emit('retry')"><RefreshCw :size="15" :class="loading ? 'animate-spin' : ''"/></button>
    </div>
    <p v-if="!authenticated" class="text-xs leading-5 text-slate-600">Đăng nhập để lưu và xem lại câu hỏi trên tài khoản của bạn. Khi chưa đăng nhập, hội thoại chỉ tồn tại trên trang đang mở.</p>
    <template v-else>
      <p v-if="error" role="alert" class="mb-2 rounded-md bg-rose-50 px-2 py-2 text-xs text-rose-700">{{error}}</p>
      <p v-if="loading && !items.length" role="status" class="py-3 text-xs text-slate-500">Đang tải lịch sử...</p>
      <p v-else-if="!items.length && !error" class="py-3 text-xs leading-5 text-slate-500">Bạn chưa có hội thoại đã lưu. Hãy đặt câu hỏi để bắt đầu.</p>
      <ul v-if="items.length" class="citizen-inner-scroll max-h-72 space-y-1 overflow-y-auto" aria-label="Các cuộc trò chuyện đã lưu">
        <li v-for="thread in items" :key="thread.id" :class="['group flex min-w-0 items-center gap-1 rounded-lg border',activeId===thread.id ? 'border-blue-200 bg-blue-50' : 'border-transparent hover:bg-slate-50']">
          <button type="button" class="flex min-w-0 flex-1 items-start gap-2 px-2 py-2 text-left" :disabled="loading" :aria-current="activeId === thread.id ? 'true' : undefined" @click="emit('open',thread.id)">
            <MessageSquareText :size="15" class="mt-0.5 shrink-0 text-brand-700"/>
            <span class="min-w-0"><span class="block truncate text-xs font-semibold text-slate-800" :title="thread.title">{{thread.title}}</span><small class="mt-1 block text-[11px] text-slate-500">{{lastUsed(thread.updatedAt)}}</small></span>
          </button>
          <button type="button" class="mr-1 rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700 focus-visible:text-rose-700" :aria-label="`Xóa hội thoại: ${thread.title}`" :disabled="loading" @click.stop="emit('remove',thread.id)"><Trash2 :size="15"/></button>
        </li>
      </ul>
      <button v-if="items.length < total" type="button" class="mt-2 w-full rounded-md border border-slate-200 py-2 text-xs font-semibold text-brand-700 hover:bg-slate-50" :disabled="loading" @click="emit('more')">Xem thêm hội thoại ({{items.length}}/{{total}})</button>
    </template>
  </section>
</template>
