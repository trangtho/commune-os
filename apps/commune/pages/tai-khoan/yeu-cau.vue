<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { Check, X, Download } from 'lucide-vue-next'
import type { StaffRequest, StaffProfile } from '~/types/staff'
import { REQUEST_KINDS, REQUEST_STATUS, PROFILE_FIELDS, showValue } from '~/types/staff'
// Lãnh đạo duyệt yêu cầu của cán bộ: sửa hồ sơ, thêm/bỏ giấy tờ, trình duyệt kết quả hồ sơ của dân, yêu cầu khác.
const { data, refresh } = await useFetch<{ requests: StaffRequest[]; profiles: StaffProfile[] }>('/api/management/overview', { key: 'mgmt-overview' })
const { date, dateTime } = useFormat()
const fieldOf = (k: string) => PROFILE_FIELDS.find((f) => f.key === k) || { key: 'full_name' as const, label: k }
const show = ref<'pending' | 'all'>('pending')
const list = computed(() => (data.value?.requests || []).filter((r) => show.value === 'all' || r.status === 'pending'))
const notes = reactive<Record<string, string>>({})
const busy = ref(''); const message = ref(''); const isError = ref(false)

function current(r: StaffRequest, key: string) {
  const p = data.value?.profiles.find((x) => x.staff_id === r.staff_id) as Record<string, unknown> | undefined
  const v = showValue(fieldOf(key), p?.[key], date)
  return v === '—' ? '(trống)' : v
}
async function decide(r: StaffRequest, approve: boolean) {
  if (busy.value) return
  if (!approve && (notes[r.id] || '').trim().length < 5) { message.value = 'Ghi lý do không duyệt (ít nhất 5 ký tự).'; isError.value = true; return }
  busy.value = r.id; message.value = ''; isError.value = false
  try {
    await $fetch(`/api/management/requests/${r.id}`, { method: 'POST', body: { approve, note: notes[r.id] } })
    message.value = `${approve ? 'Đã duyệt' : 'Đã không duyệt'}: ${REQUEST_KINDS[r.kind].toLowerCase()} của ${r.staff_name}.`
    await refresh()
  } catch (e) { message.value = readableError(e); isError.value = true } finally { busy.value = '' }
}
</script>
<template>
  <section class="panel p-5">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h3 class="section-label !mb-0">Yêu cầu của cán bộ</h3>
      <select v-model="show" class="field !w-auto" aria-label="Lọc yêu cầu">
        <option value="pending">Đang chờ duyệt</option><option value="all">Tất cả</option>
      </select>
    </div>
    <p v-if="message" role="status" :class="['mb-3 rounded-lg p-3 text-sm', isError ? 'bg-rose-50 text-rose-800' : 'bg-brand-50 text-brand-800']">{{ message }}</p>
    <p v-if="!list.length" class="text-sm text-muted">Không có yêu cầu nào.</p>
    <ul class="space-y-3">
      <li v-for="r in list" :key="r.id" class="rounded-lg border border-[#dae7f7] p-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="font-bold">{{ r.staff_name }} · {{ REQUEST_KINDS[r.kind] }}</p>
          <span :class="['rounded-full px-2.5 py-0.5 text-xs font-bold', REQUEST_STATUS[r.status].cls]">{{ REQUEST_STATUS[r.status].label }}</span>
        </div>
        <p class="text-xs text-muted">Gửi {{ dateTime(r.created_at) }}<span v-if="r.decided_by"> · {{ r.decided_by }} xử lý {{ dateTime(r.decided_at) }}</span></p>

        <table v-if="r.kind === 'profile_update'" class="mt-2 w-full text-left text-sm">
          <thead class="text-muted"><tr><th class="py-1">Trường</th><th class="py-1">Hiện tại</th><th class="py-1">Đề nghị</th></tr></thead>
          <tbody><tr v-for="(v, k) in r.payload" :key="k" class="border-t">
            <td class="py-1">{{ fieldOf(String(k)).label }}</td>
            <td class="py-1 text-muted">{{ current(r, String(k)) }}</td><td class="py-1 font-semibold">{{ v ? showValue(fieldOf(String(k)), v, date) : '(để trống)' }}</td>
          </tr></tbody>
        </table>
        <p v-else-if="r.kind === 'document_add' || r.kind === 'document_remove'" class="mt-2 text-sm">
          Giấy tờ: <b>{{ r.document_title }}</b>
          <a v-if="r.document_id" :href="`/api/staff-documents/${r.document_id}`" class="ml-2 inline-flex items-center gap-1 font-semibold text-brand-700 underline"><Download :size="14" />Xem tệp</a>
        </p>
        <p v-else-if="r.kind === 'dossier_approval'" class="mt-2 text-sm">
          Hồ sơ <NuxtLink :to="`/ho-so/${r.dossier_id}`" class="font-semibold text-brand-700 underline">{{ r.dossier_id }}</NuxtLink>:
          đề nghị <b>{{ r.payload.proposal === 'completed' ? 'HOÀN THÀNH' : 'TỪ CHỐI' }}</b>
        </p>
        <p v-if="r.note" class="mt-1 text-sm">Ghi chú của cán bộ: {{ r.note }}</p>
        <p v-if="r.decided_note" class="mt-1 text-sm">Ý kiến lãnh đạo: {{ r.decided_note }}</p>

        <div v-if="r.status === 'pending'" class="mt-3 flex flex-wrap gap-2">
          <input v-model="notes[r.id]" class="field max-w-md flex-1" maxlength="1000" placeholder="Ý kiến (bắt buộc khi không duyệt)" :aria-label="`Ý kiến cho yêu cầu của ${r.staff_name}`" />
          <button type="button" class="btn-primary" :disabled="busy === r.id" @click="decide(r, true)"><Check :size="16" />Duyệt</button>
          <button type="button" class="btn-outline !text-rose-700" :disabled="busy === r.id" @click="decide(r, false)"><X :size="16" />Không duyệt</button>
        </div>
      </li>
    </ul>
  </section>
</template>
