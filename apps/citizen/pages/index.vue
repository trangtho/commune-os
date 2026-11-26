<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import {
  Search, ArrowRight, ChevronRight, FolderOpen, FilePlus2, Bot,
  AlertTriangle, Layers3, Baby, Store, House, Files, Heart,
  MapPinned, Sparkles
} from 'lucide-vue-next'
import type { Component } from 'vue'
import type { Procedure, Application } from '~/types/models'
import { normalizeSearch } from '~/utils/search'

definePageMeta({ title: 'Trang chủ' })
const { data: procedures, error: procError, refresh: retryProcedures } = await useFetch<Procedure[]>('/api/procedures', { key: 'citizen-procedures' })
const { data: recommendations } = await useFetch<{ personalized: boolean; items: (Procedure & { reasons: string[] })[] }>('/api/procedures/recommended', { key: 'citizen-procedure-recommendations' })
const { data: auth } = await useFetch<{ authenticated: boolean; name?: string }>('/api/auth/me', { key: 'citizen-auth-home' })
const { data: cases, error: casesError, refresh: refreshCases } = await useFetch<Application[]>('/api/applications', {
  key: 'citizen-applications-home', immediate: Boolean(auth.value?.authenticated), default: () => []
})
const { date } = useFormat()
const search = ref('')
const active = computed(() => cases.value?.filter(c => ['processing', 'submitted'].includes(c.status)).length || 0)
const supplement = computed(() => cases.value?.filter(c => c.status === 'supplement').length || 0)
const suggestions = computed(() => (
  recommendations.value?.personalized ? recommendations.value.items : (procedures.value || [])
).filter(p => normalizeSearch(`${p.title} ${p.summary} ${p.category}`).includes(normalizeSearch(search.value))).slice(0, 4))
// Hồ sơ cần bổ sung được đưa lên trước; phần trang chủ hiển thị tối đa ba hồ sơ.
const ongoing = computed(() => (cases.value || [])
  .filter(c => ['supplement', 'submitted', 'processing'].includes(c.status))
  .sort((a, b) => (a.status === 'supplement' ? 0 : 1) - (b.status === 'supplement' ? 0 : 1))
  .slice(0, 3))
const quickTerms = ['Khai sinh', 'Hộ kinh doanh', 'Cư trú', 'Chứng thực']
const procedureIcons: Record<string, Component> = {
  'Hộ tịch': Baby, 'Kinh doanh': Store, 'Cư trú': House,
  'Chứng thực': Files, 'Y tế': Heart, 'Đất đai – Xây dựng': MapPinned
}
const procedureTones: Record<string, string> = {
  'Hộ tịch': 'home-icon-blue', 'Kinh doanh': 'home-icon-rose',
  'Cư trú': 'home-icon-green', 'Chứng thực': 'home-icon-violet',
  'Đất đai – Xây dựng': 'home-icon-green'
}
function searchFor(term: string) {
  navigateTo('/thu-tuc?q=' + encodeURIComponent(term))
}
const suggestionReasons = (id: string) => recommendations.value?.personalized
  ? recommendations.value.items.find(p => p.id === id)?.reasons
  : undefined
</script>

<template>
  <div class="citizen-home-page">
    <section class="panel citizen-home-search" aria-labelledby="home-search-title">
      <h2 id="home-search-title" class="citizen-home-greeting">
        Xin chào{{ auth?.authenticated ? ', ' + auth.name : '' }}. Bạn cần làm thủ tục gì?
      </h2>
      <form class="citizen-home-search-form" role="search" @submit.prevent="searchFor(search)">
        <label for="home-search" class="sr-only">Tìm thủ tục</label>
        <div class="relative min-w-0 flex-1">
          <Search class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" :size="20" />
          <input
            id="home-search"
            v-model="search"
            class="field citizen-home-search-input"
            type="search"
            autocomplete="off"
            placeholder="Ví dụ: khai sinh, đăng ký hộ kinh doanh, chứng thực..."
          />
        </div>
        <button class="btn-primary citizen-home-search-button" type="submit">Tìm thủ tục</button>
      </form>
      <div class="citizen-home-search-footer">
        <div class="citizen-home-terms">
          <span class="text-sm text-slate-600">Hay tìm:</span>
          <button
            v-for="term in quickTerms"
            :key="term"
            type="button"
            class="citizen-home-chip"
            @click="searchFor(term)"
          >{{ term }}</button>
        </div>
        <NuxtLink to="/tim-theo-tinh-huong" class="citizen-home-text-link">
          Chưa biết tên thủ tục? Tìm theo tình huống
        </NuxtLink>
      </div>
    </section>

    <section class="citizen-home-actions" aria-label="Việc thường làm">
      <NuxtLink to="/thu-tuc" class="panel citizen-home-action">
        <span class="citizen-home-action-icon home-action-blue"><FilePlus2 :size="22" /></span>
        <span class="min-w-0 flex-1">
          <b class="citizen-home-action-title">Nộp hồ sơ mới</b>
          <span class="citizen-home-action-description">Chọn thủ tục, điền thông tin, tải giấy tờ</span>
        </span>
        <ChevronRight class="citizen-home-action-arrow" :size="20" />
      </NuxtLink>
      <NuxtLink to="/ho-so" class="panel citizen-home-action">
        <span class="citizen-home-action-icon home-action-green"><FolderOpen :size="22" /></span>
        <span class="min-w-0 flex-1">
          <b class="citizen-home-action-title">Theo dõi hồ sơ</b>
          <span class="citizen-home-action-description">{{ auth?.authenticated ? `${active} hồ sơ đang giải quyết` : 'Xem tiến độ, nhận kết quả' }}</span>
        </span>
        <ChevronRight class="citizen-home-action-arrow" :size="20" />
      </NuxtLink>
      <NuxtLink to="/tro-ly" class="panel citizen-home-action">
        <span class="citizen-home-action-icon home-action-violet"><Bot :size="22" /></span>
        <span class="min-w-0 flex-1">
          <b class="citizen-home-action-title">Hỏi trợ lý AI</b>
          <span class="citizen-home-action-description">Giấy tờ, lệ phí, thời hạn; có trích nguồn</span>
        </span>
        <ChevronRight class="citizen-home-action-arrow" :size="20" />
      </NuxtLink>
    </section>

    <NuxtLink
      v-if="supplement"
      to="/ho-so?status=supplement"
      class="citizen-home-alert"
      role="status"
    >
      <AlertTriangle :size="23" class="shrink-0" />
      <span class="min-w-0 flex-1">
        <b>{{ supplement }} hồ sơ cần bổ sung giấy tờ</b>
        <span class="block text-sm">Bổ sung sớm để hồ sơ không bị chậm.</span>
      </span>
      <ArrowRight class="shrink-0" :size="19" />
    </NuxtLink>

    <section v-if="auth?.authenticated && ongoing.length" class="citizen-home-section" aria-labelledby="home-ongoing-title">
      <div class="citizen-home-section-heading">
        <h2 id="home-ongoing-title">Hồ sơ đang giải quyết</h2>
        <NuxtLink to="/ho-so" class="citizen-home-text-link">Xem tất cả <ChevronRight :size="16" /></NuxtLink>
      </div>
      <p v-if="casesError" class="panel p-4 text-sm text-rose-700">
        Không tải được hồ sơ. <button class="font-semibold underline" @click="refreshCases()">Thử lại</button>
      </p>
      <ul v-else class="panel citizen-home-case-list">
        <li v-for="c in ongoing" :key="c.id">
          <NuxtLink :to="`/ho-so/${c.id}`" class="citizen-home-case-row">
            <span class="citizen-home-case-id">{{ c.id }}</span>
            <span class="citizen-home-case-title">{{ c.procedure_title }}</span>
            <span v-if="c.due_at" class="citizen-home-case-date">Hạn {{ date(c.due_at) }}</span>
            <span v-else class="citizen-home-case-date"></span>
            <StatusPill :status="c.status" />
          </NuxtLink>
        </li>
      </ul>
    </section>

    <section class="citizen-home-section" aria-labelledby="home-procedures-title">
      <div class="citizen-home-section-heading">
        <h2 id="home-procedures-title">
          {{ recommendations?.personalized ? 'Thủ tục gợi ý cho bạn' : 'Thủ tục thường dùng' }}
        </h2>
        <NuxtLink to="/thu-tuc" class="citizen-home-text-link">Xem tất cả thủ tục <ChevronRight :size="16" /></NuxtLink>
      </div>
      <div v-if="procError" class="panel p-4 text-sm text-rose-700">
        Không tải được thủ tục. Kiểm tra
        <a href="/api/health" target="_blank" rel="noopener noreferrer" class="font-semibold underline">/api/health</a>
        hoặc chạy <code>make repair-db</code> trên máy chủ.
        <button class="ml-1 font-semibold underline" @click="retryProcedures()">Thử lại</button>.
      </div>
      <div v-else-if="!suggestions.length" class="panel p-4 text-sm text-slate-600">
        Không tìm thấy thủ tục phù hợp với từ khóa đang nhập.
      </div>
      <div v-else class="citizen-home-procedures">
        <NuxtLink v-for="p in suggestions" :key="p.id" :to="`/thu-tuc/${p.id}`" :title="suggestionReasons(p.id)?.join(' · ')" class="panel citizen-home-procedure">
          <span :class="['citizen-home-procedure-icon', procedureTones[p.category] || 'home-icon-blue']">
            <component :is="procedureIcons[p.category] || Files" :size="22" />
          </span>
          <span class="min-w-0 flex-1">
            <b class="citizen-home-procedure-title">{{ p.title }}</b>
            <span class="citizen-home-procedure-description">{{ p.summary || p.category }}</span>
            <span v-if="suggestionReasons(p.id)?.length" class="citizen-home-personalized">
              <Sparkles :size="12" /> Gợi ý phù hợp
            </span>
          </span>
          <ChevronRight class="citizen-home-procedure-arrow" :size="18" />
        </NuxtLink>
      </div>
    </section>

    <NuxtLink to="/lien-thong" class="citizen-home-batch-link">
      <Layers3 :size="17" />
      <span>Cần làm nhiều thủ tục cùng lúc (ví dụ khi sinh con, chuyển nhà)?</span>
      <b>Chuẩn bị theo nhóm</b><ArrowRight :size="15" />
    </NuxtLink>
  </div>
</template>
