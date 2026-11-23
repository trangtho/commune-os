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
 <article class="panel flex h-full flex-col p-4 transition hover:border-brand-300 hover:shadow-md">
  <div class="mb-3 flex items-start justify-between gap-2"><span :class="['grid h-11 w-11 place-items-center rounded-xl',tone[procedure.category]||'bg-blue-50 text-blue-600']"><component :is="icons[procedure.icon]||Files" :size="24"/></span><span class="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">{{procedure.category}}</span></div>
  <h3 class="text-base font-semibold leading-snug text-ink"><NuxtLink :to="`/thu-tuc/${procedure.id}`" class="hover:text-brand-700 hover:underline">{{procedure.title}}</NuxtLink></h3>
  <p class="mt-1 text-sm leading-relaxed text-slate-600">{{procedure.summary}}</p>
  <p v-if="reasons?.length&&reasons[0]!=='Thủ tục trong danh mục đang được công bố'" class="mt-3 rounded-lg bg-brand-50 px-2.5 py-2 text-sm leading-5 text-brand-800" aria-label="Lý do đề xuất"><Sparkles :size="14" class="mr-1 inline"/>{{reasons.join(' · ')}}</p>
  <dl class="mt-auto grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-sm text-slate-700"><div class="flex items-center gap-1.5"><Clock3 :size="15" class="shrink-0 text-slate-500"/><dt class="sr-only">Thời hạn</dt><dd>{{procedure.sla_days}} ngày (mẫu)</dd></div><div class="flex min-w-0 items-center gap-1.5"><Wallet :size="15" class="shrink-0 text-slate-500"/><dt class="sr-only">Lệ phí</dt><dd class="min-w-0 break-words">{{procedure.fee_note}}</dd></div></dl>
  <NuxtLink class="btn-primary mt-3 w-full" :to="`/nop-ho-so/${procedure.id}`">Nộp hồ sơ <ArrowRight :size="16"/></NuxtLink>
 </article>
</template>
