<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { UserCheck, Send } from 'lucide-vue-next'
import type { Staff } from '~/types/models'
import type { StaffRequest } from '~/types/staff'
import { REQUEST_STATUS } from '~/types/staff'
// Trên trang chi tiết hồ sơ: ai đang được phân công, và hai cấp duyệt.
// - Lãnh đạo: phân công hồ sơ cho một cán bộ.
// - Cán bộ xử lý: trình lãnh đạo duyệt kết quả (hoàn thành/từ chối) trước khi trả kết quả cho dân.
//   Lõi chặn cán bộ xử lý tự trả kết quả nếu chưa có đề nghị được duyệt (trigger check_dossier_approval).
const props = defineProps<{ dossierId: string; status: string }>()
const emit = defineEmits<{ changed: [] }>()
const { data: auth } = await useAsyncData('staff-auth', () => useRequestFetch()<{ authenticated: boolean; role?: string }>('/api/auth/me'))
const isLeader = computed(() => auth.value?.role === 'admin')
const open = computed(() => ['submitted', 'processing', 'supplement'].includes(props.status))
const { data, refresh } = await useFetch<{ assignment: { assigned_staff_name: string | null } | null; approval: StaffRequest | null }>(
  () => `/api/applications/${props.dossierId}/staffing`, { key: `staffing:${props.dossierId}` })
const { data: staff } = await useFetch<Staff[]>('/api/staff', { key: 'staff-list', immediate: isLeader.value, default: () => [] })
const people = computed(() => (staff.value || []).filter((s) => s.enabled))

const pick = ref(''); const proposal = ref<'completed' | 'rejected'>('completed'); const note = ref('')
const busy = ref(false); const message = ref(''); const isError = ref(false)
async function act(fn: () => Promise<unknown>, ok: string) {
  busy.value = true; message.value = ''; isError.value = false
  try { await fn(); message.value = ok; await refresh(); emit('changed') } catch (e) { message.value = readableError(e); isError.value = true } finally { busy.value = false }
}
function assign() {
  const s = people.value.find((x) => x.id === pick.value)
  if (!s) return
  return act(() => $fetch(`/api/applications/${props.dossierId}/assign`, { method: 'POST', body: { staffId: s.id, staffName: `${s.lastName} ${s.firstName}`.trim() || s.username } }),
    'Đã phân công hồ sơ.')
}
function requestApproval() {
  return act(() => $fetch(`/api/applications/${props.dossierId}/approval`, { method: 'POST', body: { proposal: proposal.value, note: note.value } }),
    'Đã trình lãnh đạo duyệt. Khi được duyệt, bạn cập nhật trạng thái như bình thường.')
}
</script>
<template>
  <section class="panel p-4">
    <h3 class="section-label"><UserCheck :size="20" class="text-brand-600" />Phân công & duyệt</h3>
    <p class="text-sm">Cán bộ được phân công: <b>{{ data?.assignment?.assigned_staff_name || 'chưa phân công' }}</b></p>
    <p v-if="message" role="status" :class="['mt-2 rounded-lg p-3 text-sm', isError ? 'bg-rose-50 text-rose-800' : 'bg-brand-50 text-brand-800']">{{ message }}</p>

    <form v-if="isLeader && open" class="mt-3 flex flex-wrap gap-2" @submit.prevent="assign">
      <select v-model="pick" class="field max-w-xs flex-1" aria-label="Chọn cán bộ phân công" required>
        <option value="" disabled>— Chọn cán bộ —</option>
        <option v-for="s in people" :key="s.id" :value="s.id">{{ s.lastName }} {{ s.firstName }} ({{ s.role === 'leader' ? 'lãnh đạo' : s.username }})</option>
      </select>
      <button type="submit" class="btn-outline" :disabled="busy || !pick">Phân công</button>
    </form>
    <p v-if="isLeader && open" class="mt-2 text-xs text-muted">Lãnh đạo tự trả kết quả được, không cần trình duyệt. Đề nghị của cán bộ xem ở Nhân viên → Chờ duyệt.</p>

    <template v-if="!isLeader && open">
      <div v-if="data?.approval" class="mt-3 rounded-lg border border-[#dae7f7] p-3 text-sm">
        Đề nghị gần nhất: <b>{{ data.approval.payload.proposal === 'completed' ? 'hoàn thành' : 'từ chối' }}</b>
        <span :class="['ml-1 rounded-full px-2 py-0.5 text-xs font-bold', REQUEST_STATUS[data.approval.status].cls]">{{ REQUEST_STATUS[data.approval.status].label }}</span>
        <p v-if="data.approval.decided_note" class="mt-1">Ý kiến lãnh đạo: {{ data.approval.decided_note }}</p>
      </div>
      <form v-if="data?.approval?.status !== 'pending' && data?.approval?.status !== 'approved' && status !== 'submitted'" class="mt-3 space-y-2" @submit.prevent="requestApproval">
        <p class="text-sm text-muted">Cán bộ xử lý cần lãnh đạo duyệt trước khi hoàn thành hoặc từ chối hồ sơ.</p>
        <div class="flex flex-wrap gap-3 text-sm">
          <label class="flex items-center gap-1"><input v-model="proposal" type="radio" value="completed" />Đề nghị hoàn thành</label>
          <label class="flex items-center gap-1"><input v-model="proposal" type="radio" value="rejected" />Đề nghị từ chối</label>
        </div>
        <textarea v-model="note" class="field min-h-20" required minlength="5" maxlength="1000" placeholder="Tóm tắt kết quả xử lý, căn cứ đề nghị" aria-label="Tóm tắt kết quả xử lý" />
        <button type="submit" class="btn-primary" :disabled="busy"><Send :size="16" />Trình lãnh đạo duyệt</button>
      </form>
      <p v-else-if="status === 'submitted'" class="mt-2 text-xs text-muted">Tiếp nhận hồ sơ (chuyển sang "đang xử lý") trước khi trình duyệt.</p>
    </template>
  </section>
</template>
