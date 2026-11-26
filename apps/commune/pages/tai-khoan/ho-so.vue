<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { IdCard, Download, Save } from 'lucide-vue-next'
import type { Staff } from '~/types/models'
import type { StaffProfile, StaffDocument } from '~/types/staff'
import { DOC_TYPES, PROFILE_FIELDS } from '~/types/staff'
// Hồ sơ nghiệp vụ của từng cán bộ (chức vụ, bộ phận, liên hệ, giấy tờ). Lãnh đạo sửa thẳng, không cần duyệt.
// Tài khoản đăng nhập (Keycloak) và hồ sơ nghiệp vụ (PostgreSQL) nối với nhau bằng mã người dùng (sub).
const { data: staff } = await useFetch<Staff[]>('/api/staff', { key: 'staff-list' })
const { data, refresh } = await useFetch<{ profiles: StaffProfile[]; documents: StaffDocument[] }>('/api/management/overview', { key: 'mgmt-overview' })
const { date, bytes } = useFormat()
const people = computed(() => {
  const list = (staff.value || []).map((s) => ({ id: s.id, label: `${s.lastName} ${s.firstName}`.trim() || s.username, username: s.username, enabled: s.enabled, account: true }))
  for (const p of data.value?.profiles || []) if (!list.some((x) => x.id === p.staff_id)) list.push({ id: p.staff_id, label: p.full_name, username: '(đã xóa tài khoản)', enabled: false, account: false })
  return list
})
const selected = ref('')
const profile = computed(() => data.value?.profiles.find((p) => p.staff_id === selected.value))
const docs = computed(() => (data.value?.documents || []).filter((d) => d.staff_id === selected.value))
const form = reactive<Record<string, string>>({})
const active = ref(true)
watch(selected, () => {
  const person = people.value.find((p) => p.id === selected.value)
  for (const f of PROFILE_FIELDS) form[f.key] = String(profile.value?.[f.key] ?? (f.key === 'full_name' ? person?.label || '' : ''))
  active.value = profile.value?.active ?? true
})
const busy = ref(false); const message = ref(''); const isError = ref(false)
async function save() {
  busy.value = true; message.value = ''; isError.value = false
  try {
    await $fetch(`/api/management/profiles/${selected.value}`, { method: 'PUT', body: { ...form, active: active.value } })
    message.value = 'Đã lưu hồ sơ cán bộ.'; await refresh()
  } catch (e) { message.value = readableError(e); isError.value = true } finally { busy.value = false }
}
const DOC_STATUS = { pending: 'Chờ duyệt', active: 'Đã duyệt', rejected: 'Không duyệt' } as const
</script>
<template>
  <div class="staff-split-grid grid gap-4">
    <section class="panel p-5">
      <h3 class="section-label"><IdCard :size="20" class="text-brand-600" />Cán bộ</h3>
      <ul class="space-y-1">
        <li v-for="p in people" :key="p.id">
          <button type="button" :class="['w-full rounded-lg px-3 py-2 text-left text-sm', selected === p.id ? 'bg-brand-50 font-bold text-brand-800' : 'hover:bg-slate-50']" @click="selected = p.id">
            {{ p.label }} <small class="text-muted">· {{ p.username }}<span v-if="!p.enabled && p.account"> · đã khóa</span></small>
          </button>
        </li>
      </ul>
    </section>
    <section class="panel p-5 lg:col-span-2">
      <p v-if="!selected" class="text-sm text-muted">Chọn một cán bộ để xem và sửa hồ sơ.</p>
      <template v-else>
        <p v-if="message" role="status" :class="['mb-3 rounded-lg p-3 text-sm', isError ? 'bg-rose-50 text-rose-800' : 'bg-brand-50 text-brand-800']">{{ message }}</p>
        <form class="grid gap-3 sm:grid-cols-2" @submit.prevent="save">
          <ProfileFieldInput v-for="f in PROFILE_FIELDS" :key="f.key" v-model="form[f.key]" :field="f" id-prefix="lp" />
          <label class="flex items-center gap-2 text-sm sm:col-span-2"><input v-model="active" type="checkbox" />Đang công tác (bỏ chọn khi cán bộ đã nghỉ việc; hồ sơ vẫn được giữ để tra cứu)</label>
          <div class="sm:col-span-2"><button type="submit" class="btn-primary" :disabled="busy"><Save :size="16" />Lưu hồ sơ</button></div>
        </form>
        <h4 class="mt-5 font-bold">Giấy tờ</h4>
        <p v-if="!docs.length" class="text-sm text-muted">Cán bộ chưa nộp giấy tờ nào.</p>
        <ul class="mt-2 space-y-2">
          <li v-for="d in docs" :key="d.id" class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#dae7f7] p-3 text-sm">
            <span><b>{{ d.title }}</b> · {{ DOC_TYPES[d.doc_type] }} · {{ bytes(d.size_bytes) }} · {{ date(d.created_at) }} · {{ DOC_STATUS[d.status] }}</span>
            <a class="btn-outline !p-2" :href="`/api/staff-documents/${d.id}`" :aria-label="`Tải ${d.title}`" title="Tải về"><Download :size="16" /></a>
          </li>
        </ul>
      </template>
    </section>
  </div>
</template>
