<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { ArrowLeft, ArrowRight, CheckCircle2, AlertCircle, FileText, ShieldCheck, Save } from 'lucide-vue-next'
import type { Procedure, Application, CaseDocument } from '~/types/models'
import { getProcedureFormFields, validateProcedureForm, sanitizeProcedureForm } from '~/shared/procedure-forms'
import { phoneIssue } from '~/shared/identity-validation'

const route = useRoute()
const slug = String(route.params.slug)
const initialDraftId = typeof route.query.draft === 'string' ? route.query.draft : ''
const { data: procedure, error: procedureError, refresh: retryProcedure } = await useFetch<Procedure>(
  `/api/procedures/${encodeURIComponent(slug)}`, { key: `citizen-procedure:${slug}` }
)
const { data: localities } = await useFetch<{id:string;code:string;name:string;canReceive:boolean}[]>('/api/localities', {key:'citizen-localities'})
const selectedLocality = ref('')
const { data: profile } = await useFetch<{tenant_id:string;display_name:string; phone:string; email:string; address:string}>(
  '/api/profile', { key: 'citizen-profile' }
)
// Restore the draft during SSR, rather than rendering steps 2/3 before the data arrives.
const { data: existingDraft, error: draftLoadError } = await useAsyncData<Application | null>(
  `citizen-draft:${initialDraftId || 'new'}`,
  () => initialDraftId
    ? useRequestFetch()<Application>(`/api/applications/${encodeURIComponent(initialDraftId)}`)
    : Promise.resolve(null),
  { default: () => null }
)
const isInvalidDraft = computed(() => Boolean(initialDraftId) && (
  Boolean(draftLoadError.value) || existingDraft.value?.status !== 'draft' ||
  existingDraft.value?.procedure_id !== slug
))
const parseStep = (value: unknown) => [1, 2, 3].includes(Number(value)) ? Number(value) : 1
// A copied URL must not bypass the document review step.
const allowReview = ref(false)
const step = ref(initialDraftId ? Math.min(parseStep(route.query.step), 2) : 1)
const draftId = ref(initialDraftId)
const busy = ref(false)
const errorText = ref('')
const confirmed = ref(false)
const form = reactive({ applicantName: '', phone: '', description: '' })
const formData = reactive<Record<string, string>>({})
const attempted = ref(false)
const today = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)
const fields = computed(() => getProcedureFormFields(procedure.value?.id || slug))
const formIssues = computed(() => validateProcedureForm(procedure.value?.id || slug, formData))
const formError = (key: string) => formIssues.value.find(issue => issue.key === key)?.message
const uploaded = ref<CaseDocument[]>([])

if (existingDraft.value?.status === 'draft' && existingDraft.value.procedure_id === slug) {
  const data = existingDraft.value
  form.applicantName = data.applicant_name
  form.phone = data.applicant_phone || ''
  form.description = data.description || ''
  Object.assign(formData, sanitizeProcedureForm(slug, data.form_data || {}))
  uploaded.value = data.documents || []
}
watch(profile, (value) => {
  if(value && !selectedLocality.value)selectedLocality.value=value.tenant_id||''
  if (value && !form.applicantName && !initialDraftId) {
    form.applicantName = value.display_name
    form.phone = value.phone || ''
  }
}, { immediate: true })
watch(() => route.query.step, (value) => {
  const requested = parseStep(value)
  step.value = draftId.value ? (requested === 3 && !allowReview.value ? 2 : requested) : 1
})
watch(form, () => { confirmed.value = false }, { deep: true })
watch(formData, () => { confirmed.value = false }, { deep: true })
watch(uploaded, () => { confirmed.value = false }, { deep: true })

const missing = computed(() => procedure.value?.documents?.filter(
  doc => doc.is_required && !uploaded.value.some(upload => upload.document_code === doc.document_code)
) || [])
const canNext = computed(() => form.applicantName.trim().length >= 2 && !phoneIssue(form.phone) && formIssues.value.length === 0)

async function goStep(next: number) {
  if (next < 1 || next > 3 || busy.value || isInvalidDraft.value) return
  if (next > 1 && !draftId.value) return
  if (next === 3 && missing.value.length) return
  if (next === 3 && !canNext.value) return
  allowReview.value = next === 3
  confirmed.value = false
  errorText.value = ''
  step.value = next
  await navigateTo({
    path: route.path,
    query: { step: String(next), ...(draftId.value ? { draft: draftId.value } : {}) }
  }, { replace: true })
}
async function saveDraft() {
  attempted.value = true
  if (busy.value || !procedure.value || isInvalidDraft.value) return
  if (!selectedLocality.value || localities.value?.every(l => l.id !== selectedLocality.value || !l.canReceive)) {errorText.value='Vui lòng chọn địa phương tiếp nhận được hỗ trợ';return}
  if (!canNext.value) { errorText.value = phoneIssue(form.phone) || formIssues.value[0]?.message || 'Kiểm tra họ tên người nộp hồ sơ'; return }
  busy.value = true
  errorText.value = ''
  try {
    const payload = {
      procedureId: procedure.value.id, applicantName: form.applicantName.trim(),
      phone: form.phone.trim(), description: form.description.trim(), receivingTenantId: selectedLocality.value || undefined,
      formData: sanitizeProcedureForm(procedure.value.id, formData)
    }
    if (!draftId.value) {
      const response = await $fetch<{ id: string }>('/api/applications', { method: 'POST', body: payload })
      draftId.value = response.id
    } else {
      await $fetch(`/api/applications/${encodeURIComponent(draftId.value)}`, { method: 'PATCH', body: payload })
    }
    busy.value = false
    await refreshNuxtData('citizen-applications')
    await goStep(2)
  } catch (error) {
    errorText.value = readableError(error)
  } finally { busy.value = false }
}
function recordUpload(document: CaseDocument) {
  uploaded.value.unshift(document)
}
function removeUpload(id: string) { uploaded.value = uploaded.value.filter(document => document.id !== id) }
async function submit() {
  if (busy.value || !draftId.value || isInvalidDraft.value || missing.value.length || !confirmed.value) return
  busy.value = true
  errorText.value = ''
  try {
    await $fetch(`/api/applications/${encodeURIComponent(draftId.value)}/submit`, {
      method: 'POST', body: { confirmed: true }
    })
    await refreshNuxtData(['citizen-applications', 'citizen-notifications'])
    await navigateTo(`/nop-thanh-cong/${encodeURIComponent(draftId.value)}`)
  } catch (error) {
    errorText.value = readableError(error)
  } finally { busy.value = false }
}
</script>

<template>
  <div class="space-y-4">
    <NuxtLink :to="`/thu-tuc/${slug}`" class="inline-flex items-center gap-1 text-xs font-semibold text-brand-700">
      <ArrowLeft :size="14" /> Chi tiết thủ tục
    </NuxtLink>

    <section v-if="procedureError" class="panel space-y-3 border-rose-200 p-6 text-rose-700" role="alert">
      <h2 class="font-bold">Không tải được thông tin thủ tục</h2>
      <p class="text-sm">Kiểm tra kết nối cơ sở dữ liệu rồi thử lại.</p>
      <button class="btn-outline" @click="retryProcedure()">Thử lại</button>
    </section>
    <section v-else-if="isInvalidDraft" class="panel space-y-3 border-amber-200 p-6" role="alert">
      <h2 class="font-bold text-amber-800">Không thể tiếp tục bản nháp này</h2>
      <p class="text-sm text-slate-600">Bản nháp không tồn tại, đã nộp, không thuộc tài khoản hoặc không đúng thủ tục.</p>
      <NuxtLink to="/ho-so" class="btn-outline">Quay về hồ sơ của tôi</NuxtLink>
    </section>
    <template v-else-if="procedure">
      <div class="panel p-4">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-xs font-bold text-brand-600">THỦ TỤC TRỰC TUYẾN</p>
            <h2 class="text-xl font-black">{{ procedure.title }}</h2>
          </div>
          <span v-if="draftId" class="max-w-full break-all rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">
            Bản nháp: {{ draftId }}
          </span>
        </div>
        <div class="grid grid-cols-3 gap-2" aria-label="Các bước nộp hồ sơ">
          <div v-for="(title, index) in ['Điền biểu mẫu', 'Tải giấy tờ', 'Xác nhận & nộp']" :key="title"
            :class="['rounded-lg px-2 py-3 text-center text-xs font-bold sm:text-sm', step === index+1 ? 'bg-brand-600 text-white' : step > index+1 ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-500']"
            :aria-current="step === index+1 ? 'step' : undefined">
            {{ index + 1 }}. {{ title }}
          </div>
        </div>
      </div>

      <form v-if="step === 1" class="panel space-y-5 p-4 sm:p-5" @submit.prevent="saveDraft">
        <h3 class="section-label">Thông tin người nộp hồ sơ</h3>
        <div class="rounded-xl border border-blue-200 bg-blue-50 p-3">
          <label for="receiving-locality" class="field-label">Địa phương tiếp nhận hồ sơ</label>
          <select id="receiving-locality" v-model="selectedLocality" class="field" required aria-describedby="locality-hint">
            <option value="">Chọn địa phương</option>
            <option v-for="loc in localities || []" :key="loc.id" :value="loc.id" :disabled="!loc.canReceive">{{loc.name}}{{loc.canReceive?'':' (chưa hỗ trợ chuyển tuyến)'}}</option>
          </select>
          <p id="locality-hint" class="mt-2 text-xs text-blue-800">Hiện hệ thống chỉ tiếp nhận tại địa phương gắn với tài khoản. Chuyển hồ sơ sang xã khác cần hệ thống định tuyến và phân quyền của nhóm.</p>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div><label for="applicant-name" class="field-label">Họ và tên <span class="text-rose-500">*</span></label>
            <input id="applicant-name" v-model="form.applicantName" class="field" required minlength="2" maxlength="100" autocomplete="name" />
          </div>
          <div><label for="applicant-phone" class="field-label">Số điện thoại</label>
            <input id="applicant-phone" v-model="form.phone" class="field" type="tel" maxlength="20" inputmode="tel" autocomplete="tel" :aria-invalid="attempted && Boolean(phoneIssue(form.phone))" aria-describedby="phone-issue" />
          <p id="phone-issue" v-if="attempted && phoneIssue(form.phone)" role="alert" class="mt-1 text-xs text-rose-700">{{ phoneIssue(form.phone) }}</p></div>
          <div class="sm:col-span-2"><label for="applicant-note" class="field-label">Ghi chú</label>
            <textarea id="applicant-note" v-model="form.description" class="field" rows="2" maxlength="500" placeholder="Ghi chú thêm (nếu có)" />
          </div>
        </div>
        <div class="space-y-3 border-t border-slate-100 pt-4">
          <div>
            <h3 class="section-label !mb-1">Thông tin riêng của thủ tục</h3>
            <p class="text-xs text-muted">Biểu mẫu hướng dẫn thử nghiệm theo từng thủ tục; vui lòng đối chiếu biểu mẫu chính thức khi thực hiện thực tế.</p>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <div v-for="field in fields" :key="field.key" :class="field.type === 'textarea' ? 'sm:col-span-2' : ''">
              <label :for="`citizen-field-${field.key}`" class="field-label">{{ field.label }} <span v-if="field.required" class="text-rose-500" aria-hidden="true">*</span></label>
              <select v-if="field.type === 'select'" :id="`citizen-field-${field.key}`" v-model="formData[field.key]" class="field" :required="field.required" :aria-invalid="attempted && Boolean(formError(field.key))">
                <option value="">-- Chọn thông tin --</option>
                <option v-for="option in field.options" :key="option" :value="option">{{ option }}</option>
              </select>
              <textarea v-else-if="field.type === 'textarea'" :id="`citizen-field-${field.key}`" v-model="formData[field.key]" class="field" rows="3" :maxlength="field.maxLength || 500" :required="field.required" :placeholder="field.placeholder || ''" :aria-invalid="attempted && Boolean(formError(field.key))" />
              <input v-else :id="`citizen-field-${field.key}`" v-model="formData[field.key]" class="field" :type="field.type === 'number' || field.type === 'citizenId' ? 'text' : field.type" :inputmode="field.type === 'number' || field.type === 'citizenId' ? 'numeric' : undefined" :required="field.required" :maxlength="field.maxLength || undefined" :minlength="field.minLength || undefined" :pattern="field.type === 'number' ? '[0-9]*' : undefined" :max="field.type === 'date' ? today : undefined" :aria-describedby="field.help || (attempted && formError(field.key)) ? `hint-${field.key}` : undefined" :placeholder="field.placeholder || ''" :aria-invalid="attempted && Boolean(formError(field.key))" />
              <p v-if="field.help" :id="`hint-${field.key}`" class="mt-1 text-xs text-muted">{{ field.help }}</p>
              <p v-if="attempted && formError(field.key)" :id="`hint-${field.key}`" class="mt-1 text-xs font-medium text-rose-700" role="alert">{{ formError(field.key) }}</p>
            </div>
          </div>
        </div>
        <div class="flex flex-col items-stretch gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <span class="text-xs text-muted">Các ô * là bắt buộc · Lưu nháp trước khi tải giấy tờ</span>
          <button type="submit" class="btn-primary w-full sm:w-auto" :disabled="busy">
            <Save :size="16" /> {{ busy ? 'Đang lưu...' : 'Lưu nháp và tiếp tục' }} <ArrowRight :size="16" />
          </button>
        </div>
      </form>

      <section v-else-if="step === 2" class="panel space-y-4 p-4 sm:p-5">
        <div><h3 class="section-label"><FileText class="text-brand-600" :size="21" />Thành phần giấy tờ</h3>
          <p class="text-sm text-muted">Tải đủ giấy tờ có dấu * để tiếp tục. Bạn có thể thay bằng bản mới trước khi nộp.</p>
        </div>
        <DocUploader :application-id="draftId" :requirements="procedure.documents || []" :uploaded="uploaded" @uploaded="recordUpload" @deleted="removeUpload" />
        <div :class="['rounded-lg p-3 text-sm font-semibold', missing.length ? 'bg-amber-50 text-amber-800' : 'bg-green-50 text-green-800']" role="status">
          <AlertCircle v-if="missing.length" :size="16" class="mr-1 inline" />
          <CheckCircle2 v-else :size="16" class="mr-1 inline" />
          {{ missing.length ? `Còn thiếu ${missing.length} giấy tờ bắt buộc: ${missing.map(d => d.document_name).join(', ')}` : 'Đã đủ các loại giấy tờ bắt buộc.' }}
        </div>
        <div class="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:justify-between">
          <button type="button" class="btn-outline w-full sm:w-auto" @click="goStep(1)"><ArrowLeft :size="15" /> Quay lại</button>
          <button type="button" class="btn-primary w-full sm:w-auto" :disabled="Boolean(missing.length)" @click="goStep(3)">
            Tiếp tục rà soát <ArrowRight :size="15" />
          </button>
        </div>
      </section>

      <section v-else class="panel space-y-4 p-4 sm:p-5">
        <h3 class="section-label"><ShieldCheck class="text-brand-600" :size="21" />Rà soát và xác nhận</h3>
        <div class="grid gap-3 sm:grid-cols-2">
          <p class="rounded-lg bg-brand-50 p-3 text-sm"><b class="block">Thủ tục</b>{{ procedure.title }}</p>
          <p class="rounded-lg bg-brand-50 p-3 text-sm"><b class="block">Người nộp</b>{{ form.applicantName }}</p>
          <p class="break-all rounded-lg bg-brand-50 p-3 text-sm"><b class="block">Mã bản nháp</b>{{ draftId }}</p>
          <p class="rounded-lg bg-brand-50 p-3 text-sm"><b class="block">Giấy tờ</b>{{ uploaded.length }} tệp đã tải lên</p>
        </div>
        <div class="rounded-xl border border-slate-200 p-4">
          <h4 class="mb-3 text-sm font-extrabold">Thông tin đã kê khai</h4>
          <dl class="grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
            <div v-for="field in fields" :key="field.key" class="min-w-0">
              <dt class="text-xs font-semibold text-slate-500">{{ field.label }}</dt>
              <dd class="break-words font-semibold">{{ formData[field.key] || 'Không cung cấp' }}</dd>
            </div>
          </dl>
        </div>
        <p :class="['rounded-lg border p-3 text-sm', missing.length ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-green-200 bg-green-50 text-green-900']">
          {{ missing.length ? 'Hồ sơ chưa đủ giấy tờ bắt buộc. Hãy quay lại bước tải giấy tờ.' : `Đã đủ ${procedure.documents?.filter(d => d.is_required).length || 0} loại giấy tờ bắt buộc (mô phỏng).` }}
        </p>
        <label class="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm">
          <input v-model="confirmed" type="checkbox" class="mt-1 h-4 w-4 accent-brand-600" />
          <span>Tôi xác nhận thông tin đã kê khai và giấy tờ đã đính kèm là chính xác; hiểu đây là hệ thống thử nghiệm với dữ liệu giả.</span>
        </label>
        <div class="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:justify-between">
          <button type="button" class="btn-outline w-full sm:w-auto" @click="goStep(2)"><ArrowLeft :size="15" /> Quay lại</button>
          <button type="button" class="btn-primary w-full sm:w-auto" :disabled="!confirmed || Boolean(missing.length) || busy" @click="submit">
            {{ busy ? 'Đang gửi...' : 'Xác nhận & nộp hồ sơ' }} <CheckCircle2 :size="16" />
          </button>
        </div>
      </section>
      <p v-if="errorText" role="alert" class="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{{ errorText }}</p>
      <p class="text-xs text-muted">Thời hạn, thành phần và nghiệp vụ là minh họa; chưa kết nối Flowable, OCR hoặc chữ ký số thật.</p>
    </template>
  </div>
</template>
