<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { Bell, Check, CheckCheck, ChevronRight, RefreshCw, X } from 'lucide-vue-next'
import type { Notice } from '~/types/models'

const props = defineProps<{
  authenticated: boolean
  notices: Notice[]
  unreadCount: number
  loading: boolean
  loadError: boolean
}>()
const emit = defineEmits<{ refresh: [] }>()
const route = useRoute()
const { dateTime } = useFormat()
const opened = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const bellRef = ref<HTMLButtonElement | null>(null)
const pendingId = ref('')
const actionError = ref('')
const latestNotices = computed(() => props.notices.slice(0, 5))

async function toggle() {
  opened.value = !opened.value
  actionError.value = ''
  if (!opened.value) return
  if (props.authenticated) emit('refresh')
  await nextTick()
  panelRef.value?.focus()
}
function close(returnFocus = false) {
  opened.value = false
  if (returnFocus) nextTick(() => bellRef.value?.focus())
}
function handleOutside(event: PointerEvent) {
  if (opened.value && !rootRef.value?.contains(event.target as Node)) close()
}
onMounted(() => document.addEventListener('pointerdown', handleOutside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', handleOutside))
watch(() => route.fullPath, () => close())
watch(() => props.authenticated, (isLoggedIn) => {
  if (!isLoggedIn) close()
})

async function markRead(id?: string) {
  if (!props.authenticated || pendingId.value) return
  pendingId.value = id || 'all'
  actionError.value = ''
  try {
    await $fetch(id ? `/api/notifications/${encodeURIComponent(id)}/read` : '/api/notifications/read-all', {
      method: 'POST'
    })
    await refreshNuxtData(['citizen-notifications-badge', 'citizen-notifications-page'])
  } catch (error) {
    actionError.value = readableError(error)
  } finally {
    pendingId.value = ''
  }
}
function openCase(notice: Notice) {
  if (!notice.is_read) void markRead(notice.id)
  close()
}
</script>

<template>
  <div ref="rootRef" class="relative shrink-0">
    <button
      id="citizen-notification-trigger"
      ref="bellRef"
      type="button"
      class="relative rounded-lg p-1.5 text-brand-800 transition-colors hover:bg-brand-50 sm:p-2"
      :aria-label="unreadCount ? `Thông báo, ${unreadCount} chưa đọc` : 'Thông báo'"
      aria-haspopup="dialog"
      aria-controls="citizen-notification-popover"
      :aria-expanded="opened"
      @click="toggle"
    >
      <Bell :size="21" aria-hidden="true" />
      <span
        v-if="authenticated && unreadCount"
        class="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-black text-white"
      >{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
    </button>

    <section
      v-if="opened"
      id="citizen-notification-popover"
      ref="panelRef"
      role="dialog"
      aria-label="Thông báo của công dân"
      aria-modal="false"
      tabindex="-1"
      class="fixed right-3 top-[64px] z-[70] w-[calc(100vw-1.5rem)] max-w-[380px] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-[0_18px_48px_rgba(15,23,42,0.22)] outline-none sm:absolute sm:right-0 sm:top-[calc(100%+12px)] sm:w-[380px]"
      @keydown.esc.stop="close(true)"
    >
      <header class="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div class="min-w-0">
          <h2 class="text-base font-extrabold text-brand-900">Thông báo</h2>
          <p v-if="authenticated" class="text-xs text-slate-500">{{ unreadCount ? `${unreadCount} thông báo chưa đọc` : 'Đã đọc hết thông báo' }}</p>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          <button
            v-if="authenticated && unreadCount"
            type="button"
            class="rounded-lg px-2 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-50 disabled:opacity-50"
            :disabled="!!pendingId"
            @click="markRead()"
          ><CheckCheck :size="15" class="mr-1 inline" aria-hidden="true" />Đọc tất cả</button>
          <button type="button" class="rounded-lg p-1.5 hover:bg-slate-100" aria-label="Đóng thông báo" @click="close(true)"><X :size="18" /></button>
        </div>
      </header>

      <div v-if="!authenticated" class="px-5 py-7 text-center">
        <Bell :size="28" class="mx-auto text-slate-400" aria-hidden="true" />
        <p class="mt-2 text-sm text-slate-600">Đăng nhập để xem thông báo hồ sơ của bạn.</p>
        <NuxtLink to="/dang-nhap" class="btn-primary mt-4 inline-flex" @click="close()">Đăng nhập</NuxtLink>
      </div>
      <template v-else>
        <p v-if="actionError" role="alert" class="mx-3 mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{{ actionError }}</p>
        <div v-if="loadError" role="alert" class="px-4 py-6 text-center text-sm text-rose-700">
          Không tải được thông báo.
          <button type="button" class="ml-1 font-bold underline" @click="emit('refresh')">Thử lại</button>
        </div>
        <div v-else-if="loading && !latestNotices.length" role="status" class="px-4 py-6 text-center text-sm text-slate-500">Đang tải thông báo...</div>
        <div v-else-if="!latestNotices.length" class="px-4 py-7 text-center text-sm text-slate-500">Bạn chưa có thông báo nào.</div>
        <ul v-else class="max-h-[min(48dvh,320px)] divide-y divide-slate-100 overflow-y-auto overscroll-contain" aria-label="Thông báo gần đây">
          <li v-for="notice in latestNotices" :key="notice.id" :class="['px-4 py-3', !notice.is_read ? 'bg-blue-50/70' : '']">
            <div class="flex items-start gap-2">
              <span v-if="!notice.is_read" class="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-600" aria-label="Chưa đọc" />
              <span v-else class="mt-2 h-2 w-2 shrink-0" />
              <div class="min-w-0 flex-1">
                <div class="flex items-start justify-between gap-2">
                  <h3 class="line-clamp-2 text-sm font-bold leading-snug text-slate-800">{{ notice.title }}</h3>
                  <time class="shrink-0 text-[10px] text-slate-500" :datetime="notice.created_at">{{ dateTime(notice.created_at) }}</time>
                </div>
                <p class="mt-1 line-clamp-2 break-words text-xs leading-relaxed text-slate-600">{{ notice.body }}</p>
                <div class="mt-2 flex flex-wrap items-center gap-3">
                  <NuxtLink
                    v-if="notice.application_id"
                    :to="`/ho-so/${notice.application_id}`"
                    class="inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:underline"
                    @click="openCase(notice)"
                  >Xem hồ sơ<ChevronRight :size="13" aria-hidden="true" /></NuxtLink>
                  <button
                    v-if="!notice.is_read"
                    type="button"
                    class="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline disabled:opacity-50"
                    :disabled="!!pendingId"
                    @click="markRead(notice.id)"
                  ><Check :size="13" aria-hidden="true" />Đã đọc</button>
                </div>
              </div>
            </div>
          </li>
        </ul>
        <div class="flex items-center justify-between gap-2 border-t border-slate-100 px-4 py-2.5">
          <button type="button" class="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Làm mới thông báo" @click="emit('refresh')"><RefreshCw :size="16" /></button>
          <NuxtLink to="/thong-bao" class="inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:underline" @click="close()">Xem tất cả thông báo<ChevronRight :size="14" aria-hidden="true" /></NuxtLink>
        </div>
      </template>
    </section>
  </div>
</template>
