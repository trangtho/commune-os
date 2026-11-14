<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { Files,Clock3,CheckCircle2,AlertCircle,Bell,FilePlus2 } from 'lucide-vue-next'
const props=defineProps<{label:string;value:number|string;tone?:string;icon?:string}>()
const icons:Record<string,unknown>={files:Files,clock:Clock3,check:CheckCircle2,alert:AlertCircle,bell:Bell,plus:FilePlus2}
const tone=computed(()=>({blue:'bg-blue-50 text-blue-600',green:'bg-green-50 text-green-600',orange:'bg-amber-50 text-amber-600',red:'bg-rose-50 text-rose-600',purple:'bg-violet-50 text-violet-600'})[props.tone||'blue'])
</script>
<template><div class="stat-tile flex min-h-[88px] flex-col items-start gap-2 !px-3 !py-3 sm:flex-row sm:items-center sm:gap-3 sm:!px-4"><span :class="['flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',tone]"><component :is="icons[icon||'files']" :size="23"/></span><div><p class="break-words text-[11px] font-bold leading-tight text-slate-600 sm:text-xs">{{label}}</p><p class="mt-0.5 text-xl font-extrabold text-ink sm:text-2xl">{{value}}</p></div></div></template>
