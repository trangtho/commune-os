<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { Search, FilePlus2, ChevronRight, ChevronLeft, RefreshCw } from 'lucide-vue-next'
import type { Application, ApplicationStatus } from '~/types/models'
interface CasePage {
  items: Application[]
  total: number
  page: number
  pageSize: number
  counts: Record<ApplicationStatus, number>
}
const { date, dateTime } = useFormat()
const searchInput = ref('')
const searchQuery = ref('')
const status = ref('')
const page = ref(1)
const query = computed(() => ({ paged: '1', q: searchQuery.value, status: status.value, page: String(page.value) }))
const { data: casesPage, error, pending, refresh } = await useFetch<CasePage>('/api/applications', {
  key: 'citizen-applications-page', query
})
const filtered = computed(() => casesPage.value?.items || [])
const count = (status: ApplicationStatus) => casesPage.value?.counts[status] || 0
const totalPages = computed(() => Math.max(1, Math.ceil((casesPage.value?.total || 0) / (casesPage.value?.pageSize || 10))))
const firstResult = computed(() => casesPage.value?.total ? ((casesPage.value.page - 1) * casesPage.value.pageSize) + 1 : 0)
const lastResult = computed(() => Math.min(casesPage.value?.total || 0, (casesPage.value?.page || 1) * (casesPage.value?.pageSize || 10)))
function search() { page.value = 1; searchQuery.value = searchInput.value.trim() }
watch(status, () => { page.value = 1 })
</script>
<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div><h2 class="text-xl font-black">Hồ sơ của tôi</h2><p class="text-sm text-muted">Tìm kiếm và theo dõi toàn bộ hồ sơ thuộc tài khoản của bạn.</p></div>
      <NuxtLink to="/thu-tuc" class="btn-primary"><FilePlus2 :size="16" />Nộp hồ sơ mới</NuxtLink>
    </div>
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <MetricCard label="Tổng hồ sơ" :value="Object.values(casesPage?.counts || {}).reduce((a, b) => a + b, 0)" icon="files" />
      <MetricCard label="Đang xử lý" :value="count('processing') + count('submitted')" icon="clock" />
      <MetricCard label="Cần bổ sung" :value="count('supplement')" tone="orange" icon="alert" />
      <MetricCard label="Hoàn thành" :value="count('completed')" tone="green" icon="check" />
    </div>
    <form class="panel flex flex-wrap items-center gap-2 p-3" role="search" @submit.prevent="search">
      <Search :size="19" class="ml-1 shrink-0 text-brand-600" />
      <label for="case-search" class="sr-only">Tìm theo mã hồ sơ hoặc thủ tục</label>
      <input id="case-search" v-model="searchInput" class="min-w-0 flex-[1_1_160px] bg-transparent p-2 text-sm outline-none" placeholder="Mã hồ sơ hoặc tên thủ tục..." maxlength="100" />
      <label for="case-status" class="sr-only">Lọc trạng thái</label>
      <select id="case-status" v-model="status" class="field !w-full sm:!w-auto">
        <option value="">Tất cả trạng thái</option><option value="draft">Bản nháp</option>
        <option value="submitted">Đã tiếp nhận</option><option value="processing">Đang xử lý</option>
        <option value="supplement">Cần bổ sung</option><option value="completed">Hoàn thành</option><option value="rejected">Từ chối</option>
      </select>
      <button type="submit" class="btn-primary w-full sm:w-auto" :disabled="pending"><Search :size="16" />Tìm kiếm</button>
      <button type="button" class="btn-outline w-full sm:w-auto" :disabled="pending" @click="refresh()"><RefreshCw :size="16" />Làm mới</button>
    </form>
    <section v-if="error" class="panel space-y-3 p-5 text-rose-700" role="alert"><p>Không tải được danh sách hồ sơ. Kiểm tra kết nối hoặc phiên đăng nhập.</p><button class="btn-outline" @click="refresh()">Thử lại</button></section>
    <div v-else-if="pending && !casesPage" class="panel p-8 text-center text-sm text-muted">Đang tải danh sách hồ sơ...</div>
    <div v-else-if="!filtered.length" class="panel space-y-3 p-8 text-center text-muted"><p>Không tìm thấy hồ sơ phù hợp với bộ lọc.</p><NuxtLink to="/thu-tuc" class="btn-outline">Xem danh mục thủ tục</NuxtLink></div>
    <template v-else>
      <div class="grid gap-3 lg:hidden">
        <article v-for="c in filtered" :key="c.id" class="panel space-y-3 p-4">
          <div class="flex flex-wrap items-start justify-between gap-2"><div class="min-w-0"><p class="break-all text-sm font-extrabold text-brand-700">{{ c.id }}</p><p class="mt-1 break-words text-sm font-semibold">{{ c.procedure_title }}</p></div><StatusPill :status="c.status" /></div>
          <div class="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs"><div><p class="text-muted">Ngày nộp</p><p class="font-semibold">{{ c.status === 'draft' ? 'Chưa nộp' : dateTime(c.submitted_at) }}</p></div><div><p class="text-muted">Hạn xử lý</p><p class="font-semibold">{{ c.status === 'draft' ? 'Chưa tính' : date(c.due_at) }}</p></div></div>
          <p v-if="c.due_at && new Date(c.due_at) < new Date() && ['submitted','processing','supplement'].includes(c.status)" class="text-xs font-bold text-rose-600">Hồ sơ đã quá hạn xử lý</p>
          <NuxtLink :to="c.status === 'draft' ? `/nop-ho-so/${c.procedure_id}?draft=${c.id}&step=1` : `/ho-so/${c.id}`" class="btn-outline w-full !text-xs">{{ c.status === 'draft' ? 'Tiếp tục nộp' : 'Xem chi tiết' }} <ChevronRight :size="14" /></NuxtLink>
        </article>
      </div>
      <div class="panel scrollbar-hide hidden max-w-full overflow-x-auto lg:block">
        <table class="w-full min-w-[720px] text-left text-sm"><thead class="bg-[#edf4fd] text-xs font-bold text-slate-700"><tr><th class="px-4 py-3">Mã hồ sơ</th><th class="px-4 py-3">Thủ tục</th><th class="px-4 py-3">Ngày nộp</th><th class="px-4 py-3">Trạng thái</th><th class="px-4 py-3">Hạn xử lý</th><th class="px-4 py-3">Thao tác</th></tr></thead>
          <tbody><tr v-for="c in filtered" :key="c.id" class="border-t border-slate-100 hover:bg-blue-50/60"><td class="px-4 py-3 font-bold text-brand-700">{{ c.id }}</td><td class="px-4 py-3">{{ c.procedure_title }}</td><td class="px-4 py-3 text-xs text-muted">{{ c.status === 'draft' ? 'Chưa nộp' : dateTime(c.submitted_at) }}</td><td class="px-4 py-3"><StatusPill :status="c.status" /><span v-if="c.due_at && new Date(c.due_at) < new Date() && ['submitted','processing','supplement'].includes(c.status)" class="ml-1 text-xs font-bold text-rose-600">Quá hạn</span></td><td class="px-4 py-3 text-xs">{{ c.status === 'draft' ? 'Chưa tính' : date(c.due_at) }}</td><td class="px-4 py-3"><NuxtLink :to="c.status === 'draft' ? `/nop-ho-so/${c.procedure_id}?draft=${c.id}&step=1` : `/ho-so/${c.id}`" class="btn-outline !px-3 !py-1.5 !text-xs">{{ c.status === 'draft' ? 'Tiếp tục nộp' : 'Xem chi tiết' }} <ChevronRight :size="14" /></NuxtLink></td></tr></tbody></table>
      </div>
    </template>
    <div v-if="!error && casesPage" class="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p class="text-muted" aria-live="polite">Hiển thị {{ firstResult }}–{{ lastResult }} trong {{ casesPage.total }} hồ sơ phù hợp</p>
      <div class="flex items-center gap-2"><button class="btn-outline !p-2" type="button" aria-label="Trang trước" :disabled="page <= 1 || pending" @click="page--"><ChevronLeft :size="18" /></button><span class="min-w-20 text-center font-semibold">Trang {{ casesPage.page }}/{{ totalPages }}</span><button class="btn-outline !p-2" type="button" aria-label="Trang sau" :disabled="page >= totalPages || pending" @click="page++"><ChevronRight :size="18" /></button></div>
    </div>
  </div>
</template>
