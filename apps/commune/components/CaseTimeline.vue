<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { Check,Clock3 } from 'lucide-vue-next'
import type { ApplicationStatus } from '~/types/models'
const {status}=defineProps<{status:ApplicationStatus}>()
const steps=['Nộp hồ sơ','Tiếp nhận','Đang xử lý','Phê duyệt','Trả kết quả']
const current=computed(()=>({draft:0,submitted:1,processing:2,supplement:2,completed:4,rejected:2})[status]??0)
</script>
<template><div class="grid grid-cols-5 gap-1 py-4"><div v-for="(step,i) in steps" :key="step" class="relative flex flex-col items-center gap-2 text-center"><div v-if="i>0" class="absolute right-1/2 top-4 -z-0 h-1 w-full" :class="i<=current?'bg-brand-400':'bg-slate-200'"/><div :class="['relative z-10 grid h-9 w-9 place-items-center rounded-full border-2 font-bold',i<current?'border-brand-500 bg-brand-500 text-white':i===current?'border-blue-400 bg-blue-600 text-white':'border-slate-300 bg-white text-slate-400']"><Check v-if="i<current" :size="18"/><Clock3 v-else-if="i===current" :size="17"/><span v-else>{{i+1}}</span></div><span :class="['text-[11px] font-semibold leading-tight sm:text-xs',i===current?'text-brand-700':i<current?'text-green-700':'text-slate-500']">{{step}}</span></div></div><p v-if="status==='supplement'" class="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Công dân đang được yêu cầu bổ sung giấy tờ.</p></template>
