<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { CheckCircle2, UploadCloud, FileText, LoaderCircle, Eye, X, Download, Trash2, RefreshCw } from 'lucide-vue-next'
import type { CaseDocument, ProcedureDocument } from '~/types/models'
const props = defineProps<{ applicationId: string; requirements: ProcedureDocument[]; uploaded: CaseDocument[] }>()
const emit = defineEmits<{ (e: 'uploaded', value: CaseDocument): void; (e: 'deleted', id: string): void }>()
const busy = ref('')
const errorText = ref('')
const successText = ref('')
const pending = ref<{ code: string; file: File; url: string } | null>(null)
const latest = (code: string) => props.uploaded.find(d => d.document_code === code)
const versions = (code: string) => props.uploaded.filter(d => d.document_code === code).length
const done = (code: string) => Boolean(latest(code))
function cancelSelection() {
  if (pending.value) URL.revokeObjectURL(pending.value.url)
  pending.value = null
}
onBeforeUnmount(cancelSelection)
function onFile(event: Event, code: string) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || busy.value) return
  errorText.value = ''
  if (!['application/pdf', 'image/png', 'image/jpeg'].includes(file.type) || file.size < 1 || file.size > 5 * 1024 * 1024) {
    errorText.value = 'Chỉ nhận PDF/JPG/PNG, dung lượng từ 1 byte đến 5 MB.'
    return
  }
  cancelSelection()
  pending.value = { code, file, url: URL.createObjectURL(file) }
}
async function uploadSelected() {
  if (!pending.value || busy.value) return
  const { code, file } = pending.value
  busy.value = code
  errorText.value = ''
  successText.value = ''
  try {
    const data = new FormData()
    data.set('file', file)
    data.set('documentCode', code)
    const result = await $fetch<CaseDocument>(`/api/applications/${encodeURIComponent(props.applicationId)}/documents`, { method: 'POST', body: data })
    emit('uploaded', result)
    successText.value = 'Tài liệu đã tải lên. Nếu đã có phiên bản cũ, phiên bản mới sẽ được ưu tiên.'
    cancelSelection()
  } catch (error) { errorText.value = readableError(error) }
  finally { busy.value = '' }
}
async function deleteDoc(doc: CaseDocument) {
  if (busy.value || !confirm(`Xóa tài liệu "${doc.original_name}" khỏi hồ sơ này?`)) return
  busy.value = doc.document_code
  errorText.value = ''; successText.value = ''
  try {
    await $fetch(`/api/applications/${encodeURIComponent(props.applicationId)}/documents/${encodeURIComponent(doc.id)}`, { method: 'DELETE' })
    emit('deleted', doc.id)
    successText.value = 'Đã xóa tệp khỏi hồ sơ.'
  } catch (error) { errorText.value = readableError(error) }
  finally { busy.value = '' }
}
</script>
<template>
  <div class="space-y-3">
    <div v-for="req in requirements" :key="req.document_code" class="rounded-xl border border-slate-200 bg-white p-3">
      <div class="flex flex-wrap items-center gap-3">
        <span :class="['grid h-9 w-9 shrink-0 place-items-center rounded-lg', done(req.document_code) ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600']">
          <CheckCircle2 v-if="done(req.document_code)" :size="20" /><FileText v-else :size="20" />
        </span>
        <div class="min-w-0 flex-[1_1_170px]">
          <p class="text-sm font-bold">{{ req.document_name }} <span v-if="req.is_required" class="text-rose-500">*</span></p>
          <p class="break-all text-xs text-muted">{{ latest(req.document_code)?.original_name || 'Chưa tải tài liệu' }}</p>
          <p v-if="versions(req.document_code) > 1" class="text-xs text-brand-700">{{ versions(req.document_code) }} phiên bản đã lưu (bản mới nhất ở trên)</p>
        </div>
        <a v-if="latest(req.document_code)" :href="`/api/documents/${latest(req.document_code)?.id}?view=1`" target="_blank" rel="noopener noreferrer" class="btn-outline !px-3 !py-2 !text-xs" :aria-label="`Tải ${req.document_name}`"><Eye :size="14" /> Xem tệp</a>
        <button v-if="latest(req.document_code)" type="button" class="btn-outline !px-3 !py-2 !text-xs" :disabled="!!busy" :aria-label="`Xóa ${req.document_name}`" @click="deleteDoc(latest(req.document_code)!)"><Trash2 :size="14" /> Xóa</button>
        <label class="btn-outline w-full cursor-pointer !px-3 !py-2 !text-xs sm:w-auto">
          <UploadCloud :size="15" /> {{ done(req.document_code) ? 'Tải phiên bản mới' : 'Chọn tệp' }}
          <input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" class="sr-only" :aria-label="`Chọn tệp ${req.document_name}`" :disabled="!!busy" @change="onFile($event, req.document_code)" />
        </label>
      </div>
      <div v-if="pending?.code === req.document_code" class="mt-3 space-y-3 rounded-lg border border-dashed border-blue-300 bg-blue-50 p-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="min-w-0 break-all text-xs font-semibold text-slate-700">Đã chọn: {{ pending.file.name }} ({{ (pending.file.size / 1024 / 1024).toFixed(2) }} MB)</p>
          <button type="button" class="text-xs font-bold text-slate-600 underline" :disabled="!!busy" @click="cancelSelection"><X :size="14" class="inline" /> Bỏ chọn</button>
        </div>
        <img v-if="pending.file.type.startsWith('image/')" :src="pending.url" alt="Xem trước giấy tờ đã chọn" class="max-h-52 rounded-md border bg-white object-contain" />
        <a v-else :href="pending.url" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 text-xs font-bold text-brand-700"><Eye :size="15" />Xem trước PDF trong thẻ mới</a>
        <button class="btn-primary w-full sm:w-auto" type="button" :disabled="!!busy" @click="uploadSelected">
          <LoaderCircle v-if="busy" :size="15" class="animate-spin" /><UploadCloud v-else :size="15" />
          {{ busy ? 'Đang tải lên...' : 'Xác nhận tải tài liệu' }}
        </button>
      </div>
    </div>
    <p v-if="successText" role="status" class="rounded-lg bg-green-50 p-3 text-sm text-green-700">{{ successText }}</p>
    <p v-if="errorText" role="alert" class="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{{ errorText }}</p>
    <p class="text-xs text-slate-500">Thử nghiệm với giấy tờ giả lập. PDF, PNG hoặc JPG, tối đa 5 MB/tệp. Có thể xem, xóa hoặc tải phiên bản thay thế khi hồ sơ còn cho phép chỉnh sửa. Xóa cần quyền DELETE của PostgreSQL.</p>
  </div>
</template>
