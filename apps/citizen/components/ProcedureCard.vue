<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { Baby,Store,House,Files,Heart,MapPinned,ArrowRight,Clock3,Wallet,Sparkles } from 'lucide-vue-next'
import type { Procedure } from '~/types/models'
const {procedure,reasons}=defineProps<{procedure:Procedure;reasons?:string[]}>()
const icons:Record<string,unknown>={baby:Baby,store:Store,house:House,files:Files,heart:Heart,'map-pinned':MapPinned}
const tone:Record<string,string>={'Hộ tịch':'bg-blue-50 text-blue-600','Kinh doanh':'bg-rose-50 text-rose-500','Cư trú':'bg-green-50 text-green-600','Chứng thực':'bg-violet-50 text-violet-600','Đất đai – Xây dựng':'bg-emerald-50 text-emerald-600'}
</script>
<template>
 <article class="panel flex h-full flex-col p-4 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg">
  <div class="mb-3 flex items-start justify-between gap-2"><span :class="['grid h-12 w-12 place-items-center rounded-xl',tone[procedure.category]||'bg-blue-50 text-blue-600']"><component :is="icons[procedure.icon]||Files" :size="28"/></span><span class="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">{{procedure.category}}</span></div>
  <h3 class="font-extrabold leading-snug">{{procedure.title}}</h3>
  <p class="mt-1 min-h-10 text-xs leading-relaxed text-muted">{{procedure.summary}}</p>
  <p v-if="reasons?.length&&reasons[0]!=='Thủ tục trong danh mục đang được công bố'" class="mb-3 rounded-lg bg-blue-50 px-2.5 py-2 text-xs leading-5 text-brand-800" aria-label="Lý do đề xuất"><Sparkles :size="14" class="mr-1 inline"/>{{reasons.join(' · ')}}</p>
  <div class="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-600"><span class="flex items-center gap-1"><Clock3 :size="14"/>{{procedure.sla_days}} ngày (mẫu)</span><span class="flex min-w-0 items-center gap-1 break-words"><Wallet :size="14"/>{{procedure.fee_note}}</span></div>
  <div class="mt-3 grid grid-cols-2 gap-2"><NuxtLink class="btn-outline !px-2 !text-xs" :to="`/thu-tuc/${procedure.id}`">Chi tiết</NuxtLink><NuxtLink class="btn-primary !px-2 !text-xs" :to="`/nop-ho-so/${procedure.id}`">Nộp hồ sơ <ArrowRight :size="14"/></NuxtLink></div>
 </article>
</template>
