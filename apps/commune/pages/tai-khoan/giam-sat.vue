<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { Activity, AlertTriangle } from 'lucide-vue-next'
import type { StaffWorkload, StaffTask } from '~/types/staff'
import { TASK_STATUS } from '~/types/staff'
// Giám sát công việc: mỗi cán bộ đang giữ bao nhiêu hồ sơ của dân và việc được giao, bao nhiêu quá hạn.
// Số liệu do view api.staff_workload của lõi tính, chỉ trong xã của lãnh đạo.
const { data } = await useFetch<{ workload: StaffWorkload[]; tasks: StaffTask[] }>('/api/management/overview', { key: 'mgmt-overview' })
const { date } = useFormat()
const selected = ref('')
const rows = computed(() => [...(data.value?.workload || [])].sort((a, b) => (b.overdue_dossiers + b.overdue_tasks) - (a.overdue_dossiers + a.overdue_tasks)))
const max = computed(() => Math.max(1, ...rows.value.map((r) => Number(r.open_dossiers) + Number(r.open_tasks))))
const detail = computed(() => (data.value?.tasks || []).filter((t) => t.assignee_id === selected.value && ['todo', 'doing'].includes(t.status)))
const overdue = computed(() => (data.value?.tasks || []).filter((t) => t.overdue))
</script>
<template>
  <div class="space-y-4">
    <section class="panel p-5">
      <h3 class="section-label"><Activity :size="20" class="text-brand-600" />Khối lượng công việc theo cán bộ</h3>
      <p v-if="!rows.length" class="text-sm text-muted">Chưa có dữ liệu. Phân công hồ sơ hoặc giao việc để bắt đầu theo dõi.</p>
      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[640px] text-left text-sm">
          <thead class="text-muted"><tr><th class="py-2">Cán bộ</th><th class="py-2">Hồ sơ đang giữ</th><th class="py-2">Việc đang mở</th><th class="py-2">Quá hạn</th><th class="py-2">Yêu cầu chờ duyệt</th><th class="py-2 w-1/4">Tải</th></tr></thead>
          <tbody>
            <tr v-for="r in rows" :key="r.staff_id" :class="['cursor-pointer border-t hover:bg-brand-50', selected === r.staff_id ? 'bg-brand-50' : '']" tabindex="0" @click="selected = r.staff_id" @keydown.enter="selected = r.staff_id">
              <td class="py-2 font-semibold">{{ r.staff_name }}</td>
              <td class="py-2">{{ r.open_dossiers }}</td>
              <td class="py-2">{{ r.open_tasks }}</td>
              <td :class="['py-2', Number(r.overdue_dossiers) + Number(r.overdue_tasks) ? 'font-bold text-rose-700' : '']">{{ Number(r.overdue_dossiers) + Number(r.overdue_tasks) }}</td>
              <td class="py-2">{{ r.pending_requests }}</td>
              <td class="py-2"><div class="h-2 rounded bg-slate-100" role="img" :aria-label="`${Number(r.open_dossiers) + Number(r.open_tasks)} đầu việc`"><div class="h-2 rounded bg-brand-500" :style="{ width: `${(Number(r.open_dossiers) + Number(r.open_tasks)) / max * 100}%` }" /></div></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="selected" class="mt-4 rounded-lg border border-[#dae7f7] p-3">
        <p class="font-bold">Việc đang mở của {{ rows.find((r) => r.staff_id === selected)?.staff_name }}</p>
        <p v-if="!detail.length" class="text-sm text-muted">Không có việc đang mở.</p>
        <ul class="mt-1 space-y-1 text-sm">
          <li v-for="t in detail" :key="t.id">{{ t.title }} · {{ TASK_STATUS[t.status] }}<span v-if="t.due_date" :class="t.overdue ? 'text-rose-700 font-bold' : ''"> · hạn {{ date(t.due_date) }}</span></li>
        </ul>
        <NuxtLink to="/ho-so" class="mt-2 inline-block text-sm font-semibold text-brand-700 underline">Xem danh sách hồ sơ của xã</NuxtLink>
      </div>
    </section>
    <section v-if="overdue.length" class="panel p-5">
      <h3 class="section-label text-rose-700"><AlertTriangle :size="20" />Việc quá hạn cần đôn đốc</h3>
      <ul class="space-y-1 text-sm">
        <li v-for="t in overdue" :key="t.id"><b>{{ t.assignee_name }}</b>: {{ t.title }} (hạn {{ date(t.due_date) }}, {{ TASK_STATUS[t.status].toLowerCase() }})</li>
      </ul>
    </section>
  </div>
</template>
