<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
// Việc lãnh đạo xã giao cho cán bộ đang đăng nhập (đọc và cập nhật qua lõi: /api/me/overview, /api/me/tasks/:id).
// Tách khỏi Hồ sơ cá nhân để cán bộ thấy ngay trên menu, kèm số việc chưa xong.
import { ListChecks, Play, Check, ArrowRight } from 'lucide-vue-next'
import type { StaffTask, TaskStatus } from '~/types/staff'
import { TASK_STATUS } from '~/types/staff'
const { data, error, refresh } = await useFetch<{ tasks: StaffTask[] }>('/api/me/overview', { key: 'me-overview' })
const { date, dateTime } = useFormat()
const showDone = ref(false)
// Chưa xong lên trước: quá hạn, rồi theo hạn gần nhất; việc đã xong để cuối.
const open = computed(() => (data.value?.tasks || []).filter((t) => t.status !== 'done')
  .sort((a, b) => Number(b.overdue) - Number(a.overdue) || (a.due_date ? Date.parse(a.due_date) : Infinity) - (b.due_date ? Date.parse(b.due_date) : Infinity)))
const done = computed(() => (data.value?.tasks || []).filter((t) => t.status === 'done'))
const busy = ref('')
const message = ref('')
const isError = ref(false)
const resultNotes = reactive<Record<string, string>>({})
async function setTask(t: StaffTask, status: TaskStatus) {
  if (busy.value) return
  busy.value = t.id; message.value = ''; isError.value = false
  try {
    await $fetch(`/api/me/tasks/${t.id}`, { method: 'PATCH', body: { status, resultNote: resultNotes[t.id] } })
    message.value = status === 'done' ? `Đã báo hoàn thành: ${t.title}.` : `Đã bắt đầu: ${t.title}.`
    await refresh()
  } catch (e) { message.value = readableError(e); isError.value = true } finally { busy.value = '' }
}
</script>

<template>
  <div class="space-y-4">
    <p class="text-sm text-slate-600">Việc lãnh đạo xã giao cho bạn. Bấm "Bắt đầu làm" khi nhận việc, "Báo đã xong" kèm ghi chú kết quả khi hoàn thành.</p>
    <p v-if="message" role="status" :class="['rounded-lg border p-3 text-sm', isError ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-brand-200 bg-white text-brand-800']">{{ message }}</p>
    <div v-if="error" class="panel p-5 text-sm text-rose-700">Không tải được danh sách việc. <button class="font-bold underline" @click="refresh()">Thử lại</button></div>
    <template v-else>
      <section class="panel overflow-hidden">
        <h2 class="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-lg font-bold text-ink"><ListChecks :size="20" class="text-brand-700" />Đang chờ làm ({{ open.length }})</h2>
        <p v-if="!open.length" class="p-8 text-center text-slate-600">Bạn không còn việc nào chưa xong.</p>
        <ul v-else class="divide-y divide-slate-100">
          <li v-for="t in open" :key="t.id" :class="['space-y-2 px-4 py-4', t.overdue ? 'bg-rose-50/60' : '']">
            <div class="flex flex-wrap items-start justify-between gap-2">
              <p class="font-bold text-ink">{{ t.title }}</p>
              <span :class="['rounded-full px-2.5 py-0.5 text-xs font-semibold', t.overdue ? 'bg-rose-100 text-rose-700' : t.status === 'doing' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-700']">{{ t.overdue ? 'Quá hạn' : TASK_STATUS[t.status] }}</span>
            </div>
            <p v-if="t.description" class="text-sm text-slate-700">{{ t.description }}</p>
            <p class="text-sm text-slate-600">
              Giao bởi {{ t.created_by_name }} · {{ dateTime(t.created_at) }}<span v-if="t.due_date" :class="t.overdue ? 'font-semibold text-rose-700' : ''"> · hạn {{ date(t.due_date) }}</span>
            </p>
            <NuxtLink v-if="t.dossier_id" :to="`/ho-so/${t.dossier_id}`" class="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">Mở hồ sơ {{ t.dossier_id }} <ArrowRight :size="14" /></NuxtLink>
            <div class="flex flex-wrap gap-2 pt-1">
              <input v-model="resultNotes[t.id]" class="field max-w-md flex-1" maxlength="1000" placeholder="Ghi chú kết quả (khi báo xong)" :aria-label="`Ghi chú kết quả cho ${t.title}`" />
              <button v-if="t.status === 'todo'" type="button" class="btn-outline" :disabled="busy === t.id" @click="setTask(t, 'doing')"><Play :size="15" />Bắt đầu làm</button>
              <button type="button" class="btn-primary" :disabled="busy === t.id" @click="setTask(t, 'done')"><Check :size="15" />Báo đã xong</button>
            </div>
          </li>
        </ul>
      </section>
      <section v-if="done.length" class="panel overflow-hidden">
        <button type="button" class="flex w-full items-center justify-between px-4 py-3 text-left font-bold text-ink" :aria-expanded="showDone" @click="showDone = !showDone">Đã xong ({{ done.length }})<span class="text-sm font-semibold text-brand-700">{{ showDone ? 'Ẩn' : 'Xem' }}</span></button>
        <ul v-if="showDone" class="divide-y divide-slate-100 border-t border-slate-100">
          <li v-for="t in done" :key="t.id" class="px-4 py-3 text-sm">
            <p class="font-semibold text-ink">{{ t.title }}</p>
            <p class="text-slate-600">Giao bởi {{ t.created_by_name }} · {{ dateTime(t.created_at) }}<span v-if="t.dossier_id"> · hồ sơ {{ t.dossier_id }}</span></p>
            <p v-if="t.result_note" class="text-slate-700">Kết quả: {{ t.result_note }}</p>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
