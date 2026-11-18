<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { UserRound, FileText, Send, ListChecks, Upload, Download, Trash2, Undo2, Pencil } from 'lucide-vue-next'
import type { StaffProfile, StaffDocument, StaffRequest, StaffTask, DocType, TaskStatus } from '~/types/staff'
import { DOC_TYPES, REQUEST_KINDS, REQUEST_STATUS, TASK_STATUS, PROFILE_FIELDS, showValue } from '~/types/staff'

// Hồ sơ cá nhân của cán bộ đang đăng nhập. Mọi thay đổi thành yêu cầu chờ lãnh đạo duyệt;
// lõi (PostgreSQL) mới là nơi áp dụng thay đổi, sau khi lãnh đạo bấm duyệt.
type Overview = { profile: StaffProfile | null; documents: StaffDocument[]; requests: StaffRequest[]; tasks: StaffTask[] }
const { data, error, refresh } = await useFetch<Overview>('/api/me/overview', { key: 'me-overview' })
const { date, dateTime, bytes } = useFormat()
// Lãnh đạo tự lưu hồ sơ của mình; cán bộ xử lý gửi đề nghị (mã cán bộ, ngày vào làm do lãnh đạo nhập).
const { data: auth } = await useAsyncData('staff-auth', () => useRequestFetch()<{ authenticated: boolean; role?: string }>('/api/auth/me'))
const isLeader = computed(() => auth.value?.role === 'admin')
const editable = computed(() => PROFILE_FIELDS.filter((f) => isLeader.value || !f.leaderOnly))

const tab = ref<'info' | 'docs' | 'requests' | 'tasks'>('info')
const tabs = computed(() => [
  { id: 'info', name: 'Thông tin', icon: UserRound },
  { id: 'docs', name: `Giấy tờ (${data.value?.documents.length || 0})`, icon: FileText },
  { id: 'requests', name: `Yêu cầu của tôi (${data.value?.requests.filter((r) => r.status === 'pending').length || 0} chờ)`, icon: Send },
  { id: 'tasks', name: `Việc được giao (${data.value?.tasks.filter((t) => t.status !== 'done').length || 0})`, icon: ListChecks },
] as const)

const busy = ref('')
const message = ref('')
const isError = ref(false)
async function run(key: string, fn: () => Promise<unknown>, ok: string) {
  if (busy.value) return
  busy.value = key; message.value = ''; isError.value = false
  try { await fn(); message.value = ok; await refresh() } catch (e) { message.value = readableError(e); isError.value = true } finally { busy.value = '' }
}

// --- Thông tin: đề nghị sửa ---
const pendingProfile = computed(() => data.value?.requests.find((r) => r.kind === 'profile_update' && r.status === 'pending'))
const editing = ref(false)
const draft = reactive<Record<string, string>>({})
const draftNote = ref('')
function startEdit() {
  for (const f of editable.value) draft[f.key] = String(data.value?.profile?.[f.key] ?? '')
  draftNote.value = ''; editing.value = true
}
function submitProfile() {
  const before = data.value?.profile
  if (isLeader.value) {
    return run('profile', async () => {
      await $fetch('/api/me/profile', { method: 'PUT', body: { ...draft } })
      editing.value = false
    }, 'Đã lưu hồ sơ của bạn.')
  }
  const changes: Record<string, string> = {}
  for (const f of editable.value) if ((draft[f.key] || '') !== String(before?.[f.key] ?? '')) changes[f.key] = draft[f.key] || ''
  if (!Object.keys(changes).length) { message.value = 'Bạn chưa thay đổi thông tin nào.'; isError.value = true; return }
  return run('profile', async () => {
    await $fetch('/api/me/requests', { method: 'POST', body: { kind: 'profile_update', changes, note: draftNote.value || undefined } })
    editing.value = false
  }, 'Đã gửi đề nghị sửa hồ sơ. Thông tin mới được áp dụng khi lãnh đạo duyệt.')
}

// --- Giấy tờ ---
const upload = reactive({ docType: 'bang-cap' as DocType, title: '', note: '' })
const fileInput = ref<HTMLInputElement | null>(null)
function submitDocument() {
  const file = fileInput.value?.files?.[0]
  if (!file) { message.value = 'Chưa chọn tệp.'; isError.value = true; return }
  if (file.size > 5 * 1024 * 1024) { message.value = 'Tệp không được vượt quá 5 MB.'; isError.value = true; return }
  const fd = new FormData()
  fd.append('file', file); fd.append('docType', upload.docType); fd.append('title', upload.title); fd.append('note', upload.note)
  return run('upload', async () => {
    await $fetch('/api/me/documents', { method: 'POST', body: fd })
    upload.title = ''; upload.note = ''
    if (fileInput.value) fileInput.value.value = ''
  }, 'Đã nộp giấy tờ, đang chờ lãnh đạo duyệt.')
}
function removeDocument(d: StaffDocument) {
  const note = prompt(`Lý do bỏ "${d.title}" (không bắt buộc):`)
  if (note === null) return
  return run(d.id, () => $fetch('/api/me/requests', { method: 'POST', body: { kind: 'document_remove', documentId: d.id, note: note || undefined } }),
    'Đã gửi đề nghị bỏ giấy tờ.')
}
const DOC_STATUS = { pending: 'Chờ duyệt', active: 'Đã duyệt', rejected: 'Không duyệt' } as const

// --- Yêu cầu ---
const otherNote = ref('')
function submitOther() {
  return run('other', async () => {
    await $fetch('/api/me/requests', { method: 'POST', body: { kind: 'other', note: otherNote.value } })
    otherNote.value = ''
  }, 'Đã gửi yêu cầu cho lãnh đạo.')
}
function cancelRequest(r: StaffRequest) {
  if (!confirm('Rút lại yêu cầu này?')) return
  return run(r.id, () => $fetch(`/api/me/requests/${r.id}`, { method: 'DELETE' }), 'Đã rút yêu cầu.')
}
function describe(r: StaffRequest) {
  if (r.kind === 'profile_update') return Object.entries(r.payload).map(([k, v]) => `${PROFILE_FIELDS.find((f) => f.key === k)?.label || k}: ${v ? showValue(PROFILE_FIELDS.find((f) => f.key === k) || { key: 'full_name', label: '' }, v, date) : '(để trống)'}`).join(' · ')
  if (r.kind === 'dossier_approval') return `Hồ sơ ${r.dossier_id}: đề nghị ${r.payload.proposal === 'completed' ? 'hoàn thành' : 'từ chối'}`
  if (r.kind === 'document_add' || r.kind === 'document_remove') return data.value?.documents.find((d) => d.id === r.document_id)?.title || 'Giấy tờ'
  return ''
}

// --- Việc được giao ---
const resultNotes = reactive<Record<string, string>>({})
function setTask(t: StaffTask, status: TaskStatus) {
  return run(t.id, () => $fetch(`/api/me/tasks/${t.id}`, { method: 'PATCH', body: { status, resultNote: resultNotes[t.id] } }),
    status === 'done' ? 'Đã báo hoàn thành việc.' : 'Đã cập nhật tiến độ.')
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <h2 class="text-xl font-black">Hồ sơ cá nhân</h2>
      <p class="text-sm text-muted">Thông tin công vụ và giấy tờ của bạn. Thay đổi của cán bộ xử lý được gửi lãnh đạo xã duyệt trước khi áp dụng.</p>
    </div>

    <div v-if="error" class="panel p-5 text-rose-700">{{ readableError(error) }}</div>
    <template v-else-if="data">
      <nav class="flex flex-wrap gap-2" aria-label="Các mục hồ sơ cá nhân">
        <button v-for="t in tabs" :key="t.id" type="button" :class="tab === t.id ? 'btn-primary' : 'btn-outline'" :aria-pressed="tab === t.id" @click="tab = t.id; message = ''">
          <component :is="t.icon" :size="16" />{{ t.name }}
        </button>
      </nav>
      <p v-if="message" role="status" :class="['rounded-lg p-3 text-sm', isError ? 'bg-rose-50 text-rose-800' : 'bg-brand-50 text-brand-800']">{{ message }}</p>

      <!-- Thông tin -->
      <section v-if="tab === 'info'" class="panel p-5">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 class="section-label !mb-0"><UserRound :size="20" class="text-brand-600" />Thông tin cán bộ</h3>
          <button v-if="!editing && !pendingProfile" type="button" class="btn-outline" @click="startEdit"><Pencil :size="16" />{{ isLeader ? 'Sửa hồ sơ' : 'Đề nghị sửa' }}</button>
        </div>
        <p v-if="pendingProfile" class="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Bạn có một đề nghị sửa hồ sơ đang chờ duyệt ({{ describe(pendingProfile) }}). Có thể rút lại ở mục "Yêu cầu của tôi".
        </p>
        <p v-if="!data.profile && !editing" class="mb-3 text-sm text-muted">Chưa có hồ sơ. Bấm "Đề nghị sửa" để khai báo lần đầu.</p>

        <dl v-if="!editing" class="grid gap-3 sm:grid-cols-2">
          <div v-for="f in PROFILE_FIELDS" :key="f.key" :class="f.wide ? 'sm:col-span-2' : ''">
            <dt class="text-xs font-semibold uppercase text-muted">{{ f.label }}</dt>
            <dd class="whitespace-pre-line font-semibold">{{ showValue(f, data.profile?.[f.key], date) }}</dd>
          </div>
        </dl>
        <form v-else class="grid gap-3 sm:grid-cols-2" @submit.prevent="submitProfile">
          <ProfileFieldInput v-for="f in editable" :key="f.key" v-model="draft[f.key]" :field="f" id-prefix="pf" />
          <div v-if="!isLeader" class="sm:col-span-2">
            <label class="field-label" for="pf-note">Ghi chú cho lãnh đạo (không bắt buộc)</label>
            <input id="pf-note" v-model="draftNote" class="field" maxlength="1000" />
          </div>
          <div class="flex gap-2 sm:col-span-2">
            <button type="submit" class="btn-primary" :disabled="busy === 'profile'"><Send :size="16" />{{ isLeader ? 'Lưu hồ sơ' : 'Gửi lãnh đạo duyệt' }}</button>
            <button type="button" class="btn-outline" @click="editing = false">Hủy</button>
          </div>
          <p class="text-xs text-muted sm:col-span-2">Chạy thử: chỉ dùng thông tin giả, không nhập thông tin cá nhân thật.</p>
        </form>
      </section>

      <!-- Giấy tờ -->
      <div v-if="tab === 'docs'" class="grid gap-4 lg:grid-cols-3">
        <section class="panel p-5 lg:col-span-2">
          <h3 class="section-label"><FileText :size="20" class="text-brand-600" />Giấy tờ của tôi</h3>
          <p v-if="!data.documents.length" class="text-sm text-muted">Chưa có giấy tờ nào.</p>
          <ul class="space-y-2">
            <li v-for="d in data.documents" :key="d.id" class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#dae7f7] p-3">
              <div class="min-w-0">
                <p class="font-bold">{{ d.title }}</p>
                <p class="text-xs text-muted">{{ DOC_TYPES[d.doc_type] }} · {{ bytes(d.size_bytes) }} · {{ dateTime(d.created_at) }} · SHA-256 <code>{{ d.sha256.slice(0, 12) }}…</code></p>
              </div>
              <div class="flex items-center gap-1">
                <span :class="['rounded-full px-2.5 py-0.5 text-xs font-bold', d.status === 'active' ? 'bg-green-100 text-green-700' : d.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-700']">{{ DOC_STATUS[d.status] }}</span>
                <a class="btn-outline !p-2" :href="`/api/staff-documents/${d.id}`" :aria-label="`Tải ${d.title}`" title="Tải về"><Download :size="16" /></a>
                <button v-if="d.status === 'active'" type="button" class="btn-outline !p-2" :disabled="busy === d.id" :aria-label="`Đề nghị bỏ ${d.title}`" title="Đề nghị bỏ" @click="removeDocument(d)"><Trash2 :size="16" /></button>
              </div>
            </li>
          </ul>
        </section>
        <section class="panel p-5">
          <h3 class="section-label"><Upload :size="20" class="text-brand-600" />Nộp giấy tờ mới</h3>
          <form class="space-y-3" @submit.prevent="submitDocument">
            <div>
              <label class="field-label" for="dc-type">Loại giấy tờ</label>
              <select id="dc-type" v-model="upload.docType" class="field">
                <option v-for="(name, key) in DOC_TYPES" :key="key" :value="key">{{ name }}</option>
              </select>
            </div>
            <div>
              <label class="field-label" for="dc-title">Tên giấy tờ</label>
              <input id="dc-title" v-model="upload.title" class="field" required minlength="2" maxlength="160" placeholder="vd: Bằng cử nhân luật" />
            </div>
            <div>
              <label class="field-label" for="dc-file">Tệp (PDF, PNG, JPG, tối đa 5 MB)</label>
              <input id="dc-file" ref="fileInput" type="file" accept="application/pdf,image/png,image/jpeg" class="field" required />
            </div>
            <div>
              <label class="field-label" for="dc-note">Ghi chú (không bắt buộc)</label>
              <input id="dc-note" v-model="upload.note" class="field" maxlength="1000" />
            </div>
            <button type="submit" class="btn-primary w-full" :disabled="busy === 'upload'">{{ busy === 'upload' ? 'Đang tải lên...' : 'Nộp, chờ duyệt' }}</button>
            <p class="text-xs text-muted">Chạy thử: chỉ dùng tệp tự tạo, không dùng giấy tờ thật.</p>
          </form>
        </section>
      </div>

      <!-- Yêu cầu của tôi -->
      <div v-if="tab === 'requests'" class="grid gap-4 lg:grid-cols-3">
        <section class="panel p-5 lg:col-span-2">
          <h3 class="section-label"><Send :size="20" class="text-brand-600" />Yêu cầu đã gửi</h3>
          <p v-if="!data.requests.length" class="text-sm text-muted">Chưa gửi yêu cầu nào.</p>
          <ul class="space-y-2">
            <li v-for="r in data.requests" :key="r.id" class="rounded-lg border border-[#dae7f7] p-3">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <p class="font-bold">{{ REQUEST_KINDS[r.kind] }}</p>
                <div class="flex items-center gap-1">
                  <span :class="['rounded-full px-2.5 py-0.5 text-xs font-bold', REQUEST_STATUS[r.status].cls]">{{ REQUEST_STATUS[r.status].label }}</span>
                  <button v-if="r.status === 'pending'" type="button" class="btn-outline !p-2" :disabled="busy === r.id" title="Rút lại" aria-label="Rút lại yêu cầu" @click="cancelRequest(r)"><Undo2 :size="16" /></button>
                </div>
              </div>
              <p class="text-sm">{{ describe(r) }}<span v-if="r.note"> — {{ r.note }}</span></p>
              <p class="text-xs text-muted">Gửi {{ dateTime(r.created_at) }}<span v-if="r.decided_by"> · {{ r.decided_by }} xử lý {{ dateTime(r.decided_at) }}</span><span v-if="r.decided_note">: “{{ r.decided_note }}”</span></p>
            </li>
          </ul>
        </section>
        <section class="panel p-5">
          <h3 class="section-label">Yêu cầu khác</h3>
          <form class="space-y-3" @submit.prevent="submitOther">
            <label class="field-label" for="rq-other">Nội dung (nghỉ phép, đề xuất, xin hỗ trợ...)</label>
            <textarea id="rq-other" v-model="otherNote" class="field min-h-28" required minlength="5" maxlength="1000" />
            <button type="submit" class="btn-primary w-full" :disabled="busy === 'other'">Gửi lãnh đạo</button>
          </form>
        </section>
      </div>

      <!-- Việc được giao -->
      <section v-if="tab === 'tasks'" class="panel p-5">
        <h3 class="section-label"><ListChecks :size="20" class="text-brand-600" />Việc lãnh đạo giao</h3>
        <p v-if="!data.tasks.length" class="text-sm text-muted">Chưa có việc nào.</p>
        <ul class="space-y-3">
          <li v-for="t in data.tasks" :key="t.id" :class="['rounded-lg border p-3', t.overdue ? 'border-rose-300 bg-rose-50/50' : 'border-[#dae7f7]']">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p class="font-bold">{{ t.title }}</p>
              <span class="text-xs font-bold">{{ TASK_STATUS[t.status] }}<span v-if="t.overdue" class="text-rose-700"> · quá hạn</span></span>
            </div>
            <p v-if="t.description" class="text-sm">{{ t.description }}</p>
            <p class="text-xs text-muted">
              Giao bởi {{ t.created_by_name }} · {{ dateTime(t.created_at) }}<span v-if="t.due_date"> · hạn {{ date(t.due_date) }}</span>
              <span v-if="t.dossier_id"> · hồ sơ <NuxtLink :to="`/ho-so/${t.dossier_id}`" class="font-semibold text-brand-700 underline">{{ t.dossier_id }}</NuxtLink></span>
            </p>
            <p v-if="t.result_note" class="text-sm">Kết quả: {{ t.result_note }}</p>
            <div v-if="t.status !== 'done'" class="mt-2 flex flex-wrap gap-2">
              <input v-model="resultNotes[t.id]" class="field max-w-md flex-1" maxlength="1000" placeholder="Ghi chú kết quả (khi báo xong)" :aria-label="`Ghi chú kết quả cho ${t.title}`" />
              <button v-if="t.status === 'todo'" type="button" class="btn-outline" :disabled="busy === t.id" @click="setTask(t, 'doing')">Bắt đầu làm</button>
              <button type="button" class="btn-primary" :disabled="busy === t.id" @click="setTask(t, 'done')">Báo đã xong</button>
            </div>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
