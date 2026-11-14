<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { Search, ArrowRight, RefreshCw } from 'lucide-vue-next'
import type { Application } from '~/types/models'
const route = useRoute()
const input = ref(String(route.query.q || ''))
const query = ref(String(route.query.q || ''))
const status = ref('')
const page = ref(1)
const submitted = ref(Boolean(query.value))
const params = computed(() => ({ paged: '1', q: query.value, status: status.value, page: String(page.value) }))
const { data, pending, error, refresh } = await useFetch<{items:Application[];total:number;page:number;pageSize:number}>('/api/applications', {
  key: 'citizen-applications-lookup', query: params, immediate: submitted.value,
  watch: [params], default: () => ({ items: [], total: 0, page: 1, pageSize: 10 })
})
const { date } = useFormat()
async function search() {
  if (!input.value.trim()) return
  query.value = input.value.trim()
  page.value = 1
  submitted.value = true
  await navigateTo({ path: '/tra-cuu', query: { q: query.value } }, { replace: true })
  await refresh()
}
watch(status, async() => { if (submitted.value) { page.value = 1; await refresh() } })
</script>
<template>
  <div class="space-y-4">
    <header><h2 class="text-xl font-black">Tra cứu tiến độ hồ sơ</h2><p class="text-sm text-muted">Tìm trực tiếp trong cơ sở dữ liệu các hồ sơ của tài khoản đang đăng nhập, không giới hạn 100 hồ sơ đầu tiên.</p></header>
    <form class="panel flex flex-wrap items-end gap-3 p-4" role="search" @submit.prevent="search">
      <div class="min-w-0 flex-[1_1_260px]"><label for="case-search" class="field-label">Mã hồ sơ, tên thủ tục hoặc người nộp</label><div class="flex items-center gap-2"><Search :size="20" class="text-brand-600"/><input id="case-search" v-model="input" class="field" maxlength="100" required placeholder="Ví dụ: HS-2026, khai sinh..." /></div></div>
      <div class="min-w-[150px] flex-[0_1_190px]"><label for="case-status" class="field-label">Trạng thái</label><select id="case-status" v-model="status" class="field"><option value="">Tất cả</option><option value="draft">Bản nháp</option><option value="submitted">Đã nộp</option><option value="processing">Đang xử lý</option><option value="supplement">Cần bổ sung</option><option value="completed">Hoàn thành</option><option value="rejected">Từ chối</option></select></div>
      <button class="btn-primary" type="submit" :disabled="pending">Tra cứu <ArrowRight :size="16"/></button>
    </form>
    <section v-if="submitted" aria-live="polite" class="space-y-3">
      <p v-if="error" role="alert" class="panel flex flex-wrap items-center gap-2 p-4 text-sm text-rose-700">Không thể tra cứu. <button class="btn-outline" @click="refresh()"><RefreshCw :size="14"/>Thử lại</button></p>
      <p v-else-if="pending" class="panel p-5 text-sm text-muted" role="status">Đang tìm hồ sơ trong hệ thống...</p>
      <template v-else><p class="text-sm text-muted">Tìm thấy <strong>{{data?.total||0}}</strong> hồ sơ.</p>
        <p v-if="!data?.items?.length" class="panel p-5 text-center text-sm text-muted">Không tìm thấy hồ sơ phù hợp. Bạn có thể thử tên thủ tục hoặc mã hồ sơ khác.</p>
        <NuxtLink v-for="item in data?.items || []" :key="item.id" :to="`/ho-so/${item.id}`" class="panel flex flex-wrap items-center justify-between gap-3 p-4 hover:border-blue-300"><span class="min-w-0 break-words"><b class="block text-brand-700">{{item.id}}</b><small class="text-sm">{{item.procedure_title}} · Hạn {{date(item.due_at)}}</small></span><span class="flex items-center gap-2"><StatusPill :status="item.status"/><ArrowRight :size="16"/></span></NuxtLink>
        <div v-if="(data?.total||0)>(data?.pageSize||10)" class="flex items-center justify-center gap-3"><button class="btn-outline" :disabled="page<=1" @click="page--;refresh()">Trang trước</button><span class="text-sm">Trang {{data?.page}}/{{Math.ceil((data?.total||0)/(data?.pageSize||10))}}</span><button class="btn-outline" :disabled="(data?.page||1)*(data?.pageSize||10)>=(data?.total||0)" @click="page++;refresh()">Trang sau</button></div>
      </template>
    </section>
  </div>
</template>
