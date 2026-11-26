<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { ClipboardPlus, XCircle } from 'lucide-vue-next'
import type { Staff } from '~/types/models'
import type { StaffTask } from '~/types/staff'
import { TASK_STATUS } from '~/types/staff'
// Lãnh đạo giao việc cho cán bộ (ngoài hồ sơ của dân: rà soát, báo cáo, trực tiếp dân...) và theo dõi tiến độ.
const { data: staff } = await useFetch<Staff[]>('/api/staff', { key: 'staff-list' })
const { data, refresh } = await useFetch<{ tasks: StaffTask[] }>('/api/management/overview', { key: 'mgmt-overview' })
const { date, dateTime } = useFormat()
const people = computed(() => (staff.value || []).filter((s) => s.enabled && !s.isMe))
const form = reactive({ assigneeId: '', title: '', description: '', dueDate: '', dossierId: '' })
const filter = ref<'open' | 'all'>('open')
const tasks = computed(() => (data.value?.tasks || []).filter((t) => filter.value === 'all' || ['todo', 'doing'].includes(t.status)))
const busy = ref(''); const message = ref(''); const isError = ref(false)

async function createTask() {
  const who = people.value.find((s) => s.id === form.assigneeId)
  if (!who) { message.value = 'Chọn cán bộ nhận việc.'; isError.value = true; return }
  busy.value = 'create'; message.value = ''; isError.value = false
  try {
    await $fetch('/api/management/tasks', { method: 'POST', body: { ...form, assigneeName: `${who.lastName} ${who.firstName}`.trim() || who.username } })
    message.value = `Đã giao việc cho ${who.lastName} ${who.firstName}.`
    Object.assign(form, { title: '', description: '', dueDate: '', dossierId: '' })
    await refresh()
  } catch (e) { message.value = readableError(e); isError.value = true } finally { busy.value = '' }
}
async function cancelTask(t: StaffTask) {
  if (!confirm(`Hủy việc "${t.title}"?`)) return
  busy.value = t.id
  try { await $fetch(`/api/management/tasks/${t.id}`, { method: 'DELETE' }); message.value = 'Đã hủy việc.'; isError.value = false; await refresh() }
  catch (e) { message.value = readableError(e); isError.value = true } finally { busy.value = '' }
}
</script>
<template>
  <div class="space-y-4">
    <p v-if="message" role="status" :class="['rounded-lg p-3 text-sm', isError ? 'bg-rose-50 text-rose-800' : 'bg-brand-50 text-brand-800']">{{ message }}</p>
    <div class="staff-split-grid grid gap-4">
      <section class="panel p-5 lg:col-span-2">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 class="section-label !mb-0">Việc đã giao</h3>
          <select v-model="filter" class="field !w-auto" aria-label="Lọc việc"><option value="open">Đang mở</option><option value="all">Tất cả</option></select>
        </div>
        <p v-if="!tasks.length" class="text-sm text-muted">Chưa có việc nào.</p>
        <div v-else class="overflow-x-auto">
          <table class="w-full min-w-[620px] text-left text-sm">
            <thead class="text-muted"><tr><th class="py-2">Việc</th><th class="py-2">Người nhận</th><th class="py-2">Hạn</th><th class="py-2">Tiến độ</th><th /></tr></thead>
            <tbody>
              <tr v-for="t in tasks" :key="t.id" class="border-t align-top">
                <td class="py-2">
                  <p class="font-semibold">{{ t.title }}</p>
                  <p v-if="t.dossier_id" class="text-xs">Hồ sơ <NuxtLink :to="`/ho-so/${t.dossier_id}`" class="text-brand-700 underline">{{ t.dossier_id }}</NuxtLink></p>
                  <p v-if="t.result_note" class="text-xs text-muted">Kết quả: {{ t.result_note }}</p>
                </td>
                <td class="py-2">{{ t.assignee_name }}</td>
                <td :class="['py-2', t.overdue ? 'font-bold text-rose-700' : '']">{{ t.due_date ? date(t.due_date) : '—' }}<span v-if="t.overdue"> (quá hạn)</span></td>
                <td class="py-2">{{ TASK_STATUS[t.status] }}<br><small class="text-muted">{{ dateTime(t.updated_at) }}</small></td>
                <td class="py-2 text-right">
                  <button v-if="['todo', 'doing'].includes(t.status)" type="button" class="btn-outline !p-2" :disabled="busy === t.id" title="Hủy việc" :aria-label="`Hủy việc ${t.title}`" @click="cancelTask(t)"><XCircle :size="16" /></button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <section class="panel p-5">
        <h3 class="section-label"><ClipboardPlus :size="20" class="text-brand-600" />Giao việc mới</h3>
        <form class="space-y-3" @submit.prevent="createTask">
          <div>
            <label class="field-label" for="tk-who">Cán bộ nhận việc</label>
            <select id="tk-who" v-model="form.assigneeId" class="field" required>
              <option value="" disabled>— Chọn cán bộ —</option>
              <option v-for="s in people" :key="s.id" :value="s.id">{{ s.lastName }} {{ s.firstName }} ({{ s.username }})</option>
            </select>
          </div>
          <div><label class="field-label" for="tk-title">Tên việc</label><input id="tk-title" v-model="form.title" class="field" required minlength="3" maxlength="160" placeholder="vd: Rà soát hồ sơ tồn đọng tháng 11" /></div>
          <div><label class="field-label" for="tk-desc">Mô tả</label><textarea id="tk-desc" v-model="form.description" class="field min-h-20" maxlength="2000" /></div>
          <div class="grid grid-cols-2 gap-2">
            <div><label class="field-label" for="tk-due">Hạn</label><input id="tk-due" v-model="form.dueDate" type="date" class="field" /></div>
            <div><label class="field-label" for="tk-dossier">Mã hồ sơ (nếu có)</label><input id="tk-dossier" v-model="form.dossierId" class="field" maxlength="40" placeholder="HS-2026-..." /></div>
          </div>
          <button type="submit" class="btn-primary w-full" :disabled="busy === 'create'">Giao việc</button>
        </form>
      </section>
    </div>
  </div>
</template>
