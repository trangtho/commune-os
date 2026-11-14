<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { ArrowLeft, ArrowRight, CheckCircle2, AlertCircle, FileText, ShieldCheck, Save } from 'lucide-vue-next'
import type { Procedure, Application, CaseDocument } from '~/types/models'

const route = useRoute()
const slug = String(route.params.slug)
const initialDraftId = typeof route.query.draft === 'string' ? route.query.draft : ''
const { data: procedure, error: procedureError, refresh: retryProcedure } = await useFetch<Procedure>(
  `/api/procedures/${encodeURIComponent(slug)}`, { key: `citizen-procedure:${slug}` }
)
const { data: profile } = await useFetch<{display_name:string; phone:string; email:string; address:string}>(
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
const step = ref(initialDraftId ? parseStep(route.query.step) : 1)
const draftId = ref(initialDraftId)
const busy = ref(false)
const errorText = ref('')
const confirmed = ref(false)
const form = reactive({
  applicantName: '', phone: '', description: '', childName: '', birthDate: '',
  gender: 'Nam', birthPlace: '', subject: ''
})
const uploaded = ref<CaseDocument[]>([])

if (existingDraft.value?.status === 'draft' && existingDraft.value.procedure_id === slug) {
  const data = existingDraft.value
  form.applicantName = data.applicant_name
  form.phone = data.applicant_phone || ''
  form.description = data.description || ''
  Object.assign(form, data.form_data || {})
  uploaded.value = data.documents || []
}
watch(profile, (value) => {
  if (value && !form.applicantName && !initialDraftId) {
    form.applicantName = value.display_name
    form.phone = value.phone || ''
  }
}, { immediate: true })
watch(() => route.query.step, (value) => {
  step.value = draftId.value ? parseStep(value) : 1
})
watch(form, () => { confirmed.value = false }, { deep: true })
watch(uploaded, () => { confirmed.value = false }, { deep: true })

const missing = computed(() => procedure.value?.documents?.filter(
  doc => doc.is_required && !uploaded.value.some(upload => upload.document_code === doc.document_code)
) || [])
const canNext = computed(() => form.applicantName.trim().length >= 2 && (
  procedure.value?.id !== 'khai-sinh' || (form.childName.trim().length >= 2 && Boolean(form.birthDate))
))

async function goStep(next: number) {
  if (next < 1 || next > 3 || busy.value || isInvalidDraft.value) return
  if (next > 1 && !draftId.value) return
  if (next === 3 && missing.value.length) return
  confirmed.value = false
  errorText.value = ''
  step.value = next
  await navigateTo({
    path: route.path,
    query: { step: String(next), ...(draftId.value ? { draft: draftId.value } : {}) }
  }, { replace: true })
}
async function saveDraft() {
  if (busy.value || !procedure.value || !canNext.value || isInvalidDraft.value) return
  busy.value = true
  errorText.value = ''
  try {
    const payload = {
      procedureId: procedure.value.id, applicantName: form.applicantName.trim(),
      phone: form.phone.trim(), description: form.description.trim(),
      formData: {
        childName: form.childName, birthDate: form.birthDate, gender: form.gender,
        birthPlace: form.birthPlace, subject: form.subject
      }
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
        <div class="grid gap-4 sm:grid-cols-2">
          <div><label for="applicant-name" class="field-label">Họ và tên <span class="text-rose-500">*</span></label>
            <input id="applicant-name" v-model="form.applicantName" class="field" required minlength="2" maxlength="100" autocomplete="name" />
          </div>
          <div><label for="applicant-phone" class="field-label">Số điện thoại</label>
            <input id="applicant-phone" v-model="form.phone" class="field" maxlength="20" inputmode="tel" autocomplete="tel" />
          </div>
          <div class="sm:col-span-2"><label for="applicant-note" class="field-label">Ghi chú</label>
            <textarea id="applicant-note" v-model="form.description" class="field" rows="2" maxlength="500" placeholder="Ghi chú thêm (nếu có)" />
          </div>
        </div>
        <template v-if="procedure.id === 'khai-sinh'">
          <h3 class="section-label !mb-0 border-t border-slate-100 pt-4">Thông tin trẻ đăng ký khai sinh</h3>
          <div class="grid gap-4 sm:grid-cols-2">
            <div><label for="child-name" class="field-label">Họ và tên trẻ <span class="text-rose-500">*</span></label>
              <input id="child-name" v-model="form.childName" class="field" required minlength="2" maxlength="100" />
            </div>
            <div><label for="child-birth-date" class="field-label">Ngày sinh <span class="text-rose-500">*</span></label>
              <input id="child-birth-date" v-model="form.birthDate" class="field" type="date" required />
            </div>
            <div><label for="child-gender" class="field-label">Giới tính</label>
              <select id="child-gender" v-model="form.gender" class="field"><option>Nam</option><option>Nữ</option><option>Khác</option></select>
            </div>
            <div><label for="child-birthplace" class="field-label">Nơi sinh</label>
              <input id="child-birthplace" v-model="form.birthPlace" class="field" placeholder="Nơi sinh (mô phỏng)" maxlength="200" />
            </div>
          </div>
        </template>
        <template v-else>
          <h3 class="section-label !mb-0 border-t pt-4">Thông tin đề nghị</h3>
          <div><label for="procedure-subject" class="field-label">Nội dung / đối tượng thủ tục</label>
            <input id="procedure-subject" v-model="form.subject" class="field" maxlength="200" placeholder="Nhập nội dung đề nghị (mô phỏng)" />
          </div>
        </template>
        <div class="flex flex-col items-stretch gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <span class="text-xs text-muted">Các ô * là bắt buộc · Lưu nháp trước khi tải giấy tờ</span>
          <button type="submit" class="btn-primary w-full sm:w-auto" :disabled="!canNext || busy">
            <Save :size="16" /> {{ busy ? 'Đang lưu...' : 'Lưu nháp và tiếp tục' }} <ArrowRight :size="16" />
          </button>
        </div>
      </form>

      <section v-else-if="step === 2" class="panel space-y-4 p-4 sm:p-5">
        <div><h3 class="section-label"><FileText class="text-brand-600" :size="21" />Thành phần giấy tờ</h3>
          <p class="text-sm text-muted">Tải đủ giấy tờ có dấu * để tiếp tục. Bạn có thể thay bằng bản mới trước khi nộp.</p>
        </div>
        <DocUploader :application-id="draftId" :requirements="procedure.documents || []" :uploaded="uploaded" @uploaded="recordUpload" />
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
