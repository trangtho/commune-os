<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { CheckCircle2, ArrowRight, FolderOpen, Printer, AlertCircle, FileText } from 'lucide-vue-next'
import type { Application } from '~/types/models'
const id = String(useRoute().params.id)
const { data: application, error, refresh } = await useFetch<Application>(`/api/applications/${encodeURIComponent(id)}`, {
  key: `citizen-application:${id}`
})
const { dateTime, date } = useFormat()
function printReceipt() { if (import.meta.client) window.print() }
const submitted = computed(() => Boolean(application.value) && application.value?.status !== 'draft')
</script>
<template>
  <div class="mx-auto max-w-3xl space-y-4">
    <section v-if="error" class="panel space-y-4 p-6" role="alert">
      <AlertCircle :size="28" class="text-rose-600" /><h2 class="text-lg font-extrabold">Không thể tải biên nhận</h2>
      <p class="text-sm text-muted">Không tìm thấy hồ sơ hoặc phiên đăng nhập không còn hiệu lực.</p>
      <button class="btn-outline" @click="refresh()">Thử lại</button>
    </section>
    <section v-else-if="application && !submitted" class="panel space-y-4 p-6">
      <AlertCircle :size="30" class="text-amber-600" />
      <h2 class="text-xl font-black">Hồ sơ chưa được nộp</h2>
      <p class="text-sm text-muted">Bản nháp chưa có biên nhận. Vui lòng hoàn thành việc tải giấy tờ và xác nhận nộp.</p>
      <NuxtLink :to="`/nop-ho-so/${application.procedure_id}?draft=${encodeURIComponent(id)}&step=1`" class="btn-primary">Tiếp tục nộp hồ sơ</NuxtLink>
    </section>
    <template v-else-if="application">
      <div class="panel flex flex-col items-center gap-2 p-5 text-center print:hidden">
        <CheckCircle2 class="text-green-600" :size="46" />
        <h2 class="text-2xl font-black text-green-800">Hồ sơ đã được ghi nhận</h2>
        <p class="text-sm text-muted">Dưới đây là biên nhận thông tin hồ sơ trong môi trường thử nghiệm.</p>
      </div>
      <article class="panel space-y-5 p-5 sm:p-8" aria-label="Biên nhận nộp hồ sơ">
        <header class="border-b border-slate-200 pb-4 text-center">
          <p class="text-xs font-bold uppercase tracking-widest text-brand-700">CommuneOS · Kênh công dân</p>
          <h3 class="mt-2 text-2xl font-black">BIÊN NHẬN HỒ SƠ</h3>
          <p class="mt-1 text-xs font-bold text-amber-700">BẢN MÔ PHỎNG – KHÔNG CÓ GIÁ TRỊ PHÁP LÝ</p>
        </header>
        <div class="rounded-xl bg-blue-50 px-4 py-5 text-center">
          <p class="text-xs font-semibold text-muted">Mã hồ sơ</p>
          <p class="mt-2 break-all text-2xl font-black tracking-wide text-brand-800">{{ application.id }}</p>
        </div>
        <dl class="grid gap-x-5 gap-y-4 text-sm sm:grid-cols-2">
          <div><dt class="text-xs text-muted">Thủ tục</dt><dd class="font-bold">{{ application.procedure_title }}</dd></div>
          <div><dt class="text-xs text-muted">Lĩnh vực</dt><dd class="font-bold">{{ application.category }}</dd></div>
          <div><dt class="text-xs text-muted">Người nộp</dt><dd class="font-bold">{{ application.applicant_name }}</dd></div>
          <div><dt class="text-xs text-muted">Số điện thoại khai báo</dt><dd class="font-bold">{{ application.applicant_phone || 'Chưa cung cấp' }}</dd></div>
          <div><dt class="text-xs text-muted">Thời điểm nộp</dt><dd class="font-bold">{{ dateTime(application.submitted_at) }}</dd></div>
          <div><dt class="text-xs text-muted">Hạn dự kiến (mô phỏng)</dt><dd class="font-bold">{{ date(application.due_at) }}</dd></div>
          <div class="sm:col-span-2"><dt class="text-xs text-muted">Trạng thái hiện tại</dt><dd class="mt-1"><StatusPill :status="application.status" /></dd></div>
        </dl>
        <div class="rounded-lg border border-slate-200 p-4">
          <h4 class="mb-2 flex items-center gap-2 text-sm font-bold"><FileText :size="17" />Tài liệu đã ghi nhận: {{ application.documents?.length || 0 }}</h4>
          <ul v-if="application.documents?.length" class="space-y-2 text-xs text-slate-700">
            <li v-for="doc in application.documents" :key="doc.id" class="break-all">• {{ doc.original_name }}</li>
          </ul>
          <p v-else class="text-xs text-muted">Không có tài liệu trong hồ sơ.</p>
        </div>
        <p class="border-t pt-3 text-xs leading-5 text-slate-600">Biên nhận này được tạo từ dữ liệu minh họa của CommuneOS. Không có chữ ký số, mã xác minh chính thức hoặc dấu của cơ quan nhà nước; không dùng để thay thế giấy hẹn trả kết quả.</p>
      </article>
      <div class="flex flex-wrap justify-center gap-3 print:hidden">
        <button type="button" class="btn-primary" @click="printReceipt"><Printer :size="17" />In / lưu PDF</button>
        <NuxtLink :to="`/ho-so/${encodeURIComponent(id)}`" class="btn-outline"><FolderOpen :size="17" />Xem tiến độ</NuxtLink>
        <NuxtLink to="/thu-tuc" class="btn-outline">Nộp hồ sơ khác <ArrowRight :size="16" /></NuxtLink>
      </div>
    </template>
  </div>
</template>
