<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { ArrowLeft, FileText, Download, MessageCircle, ArrowRight, Printer, RefreshCw } from 'lucide-vue-next'
import type { Application } from '~/types/models'
import { getProcedureFormFields } from '~/shared/procedure-forms'
interface SupportItem { id: string; application_id: string; message: string; created_at: string }
const id = String(useRoute().params.id)
const { data: c, error, refresh } = await useFetch<Application>(`/api/applications/${encodeURIComponent(id)}`, { key: `citizen-application:${id}` })
const { data: support, error: supportError, refresh: refreshSupport } = await useFetch<SupportItem[]>('/api/support', {
  key: `citizen-support:${id}`, query: { applicationId: id }
})
const { date, dateTime, bytes } = useFormat()
const fields = computed(() => getProcedureFormFields(c.value?.procedure_id || ''))
const message = ref('')
const notice = ref('')
const sent = ref(false)
const sending = ref(false)
async function sendMessage() {
  if (message.value.trim().length < 5 || sending.value) return
  sending.value = true; notice.value = ''; sent.value = false
  try {
    await $fetch('/api/support', { method: 'POST', body: { applicationId: id, message: message.value } })
    message.value = ''
    sent.value = true
    notice.value = 'Đã ghi nhận câu hỏi của bạn.'
    await refreshSupport()
  } catch (e) { notice.value = readableError(e) }
  finally { sending.value = false }
}
</script>
<template>
  <div class="space-y-4">
    <NuxtLink to="/ho-so" class="inline-flex items-center gap-1 text-sm font-semibold text-brand-700"><ArrowLeft :size="16" />Danh sách hồ sơ</NuxtLink>
    <div v-if="error" class="panel space-y-3 p-6 text-rose-600" role="alert"><p>Không tìm thấy hồ sơ hoặc không có quyền truy cập.</p><button class="btn-outline" @click="refresh()">Thử lại</button></div>
    <template v-else-if="c">
      <section class="panel p-5">
        <div class="flex flex-wrap items-start justify-between gap-3"><div class="min-w-0"><p class="break-all text-xs font-semibold text-muted">Mã hồ sơ: {{ c.id }}</p><h2 class="mt-1 text-xl font-black">{{ c.procedure_title }}</h2></div><StatusPill :status="c.status" /></div>
        <div class="mt-4 grid gap-3 border-t pt-4 text-sm sm:grid-cols-3"><div><span class="text-xs text-muted">Người nộp</span><p class="font-bold">{{ c.applicant_name }}</p></div><div><span class="text-xs text-muted">Ngày tiếp nhận</span><p class="font-bold">{{ c.status === 'draft' ? 'Chưa nộp' : dateTime(c.submitted_at) }}</p></div><div><span class="text-xs text-muted">Hạn xử lý (dự kiến)</span><p class="font-bold">{{ c.status === 'draft' ? 'Chưa tính' : date(c.due_at) }}</p></div></div>
      </section>
      <section class="panel p-5"><h3 class="section-label">Tiến độ xử lý hồ sơ</h3><CaseTimeline :status="c.status" /><div class="mt-4 border-t border-slate-100 pt-3"><p v-if="!c.events?.length" class="text-sm text-muted">Chưa có hoạt động cập nhật.</p><div v-for="e in c.events || []" :key="e.id" class="flex gap-3 border-b border-slate-100 py-3 last:border-b-0"><span class="mt-1 h-3 w-3 shrink-0 rounded-full bg-blue-500" /><div><p class="text-sm font-bold">{{ e.note }}</p><p class="mt-1 text-xs text-muted">{{ dateTime(e.created_at) }} · {{ e.actor_name }}</p></div></div></div></section>
      <section class="panel p-5">
        <h3 class="section-label">Thông tin đã kê khai</h3>
        <dl class="grid gap-4 sm:grid-cols-2">
          <div v-for="field in fields" :key="field.key" class="min-w-0">
            <dt class="text-xs font-semibold text-muted">{{ field.label }}</dt>
            <dd class="mt-1 break-words text-sm font-semibold">{{ c.form_data?.[field.key] || 'Không cung cấp' }}</dd>
          </div>
        </dl>
      </section>
      <div class="grid min-w-0 gap-4 lg:grid-cols-2">
        <section class="panel p-4"><h3 class="section-label"><FileText :size="20" class="text-blue-600" />Giấy tờ đã nộp ({{ c.documents?.length || 0 }})</h3><p v-if="!c.documents?.length" class="p-3 text-sm text-muted">Chưa có tệp đính kèm.</p><div v-for="d in c.documents || []" :key="d.id" class="flex min-w-0 items-center justify-between gap-2 border-b py-3 last:border-0"><span class="min-w-0 text-sm"><b class="block break-all">{{ d.original_name }}</b><small class="text-muted">{{ bytes(d.size_bytes) }} · {{ dateTime(d.uploaded_at) }}</small></span><a :href="`/api/documents/${d.id}`" class="btn-outline !p-2" :aria-label="`Tải ${d.original_name}`"><Download :size="16" /></a></div></section>
        <section class="panel space-y-4 p-4"><h3 class="section-label"><MessageCircle :size="20" class="text-brand-600" />Hỏi về hồ sơ</h3><form class="space-y-3" @submit.prevent="sendMessage"><label for="case-message" class="field-label">Nội dung câu hỏi</label><textarea id="case-message" v-model="message" class="field" rows="4" maxlength="2000" minlength="5" required placeholder="Nhập nội dung cần trao đổi..." /><p v-if="notice" :class="['rounded-lg p-3 text-xs', sent ? 'bg-green-50 text-green-800' : 'bg-rose-50 text-rose-700']" role="status">{{ notice }}</p><button class="btn-primary w-full sm:w-auto" :disabled="sending || message.trim().length < 5" type="submit">{{ sending ? 'Đang gửi...' : 'Gửi câu hỏi' }}<ArrowRight :size="15" /></button></form>
          <div class="border-t pt-3"><div class="mb-3 flex flex-wrap items-center justify-between gap-2"><h4 class="text-sm font-bold">Câu hỏi đã gửi</h4><button type="button" class="btn-outline !px-2 !py-1.5 !text-xs" @click="refreshSupport()"><RefreshCw :size="13" />Làm mới</button></div><p v-if="supportError" class="text-xs text-rose-700">Không tải được lịch sử câu hỏi.</p><p v-else-if="!support?.length" class="text-xs text-muted">Chưa có câu hỏi nào.</p><div v-for="item in support || []" :key="item.id" class="mb-2 rounded-lg bg-slate-50 p-3"><p class="whitespace-pre-wrap break-words text-sm">{{ item.message }}</p><p class="mt-2 text-xs text-muted">{{ dateTime(item.created_at) }} · Đã ghi nhận</p></div><p class="mt-2 text-xs text-muted">Chưa tích hợp chức năng cán bộ trả lời từ hệ thống xử lý hồ sơ.</p></div>
        </section>
      </div>
      <div class="flex flex-wrap gap-3"><NuxtLink v-if="c.status === 'supplement'" :to="`/ho-so/${c.id}/bo-sung`" class="btn-primary">Bổ sung giấy tờ <ArrowRight :size="16" /></NuxtLink><NuxtLink v-if="c.status === 'completed'" :to="`/ho-so/${c.id}/ket-qua`" class="btn-primary">Xem kết quả <ArrowRight :size="16" /></NuxtLink><NuxtLink v-if="c.status === 'draft'" :to="`/nop-ho-so/${c.procedure_id}?draft=${c.id}&step=1`" class="btn-primary">Tiếp tục hồ sơ nháp <ArrowRight :size="16" /></NuxtLink><NuxtLink v-else :to="`/nop-thanh-cong/${c.id}`" class="btn-outline"><Printer :size="16" />Xem biên nhận</NuxtLink></div>
    </template>
  </div>
</template>
