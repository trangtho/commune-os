<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { CheckCircle2, Clock3, AlertCircle, FilePenLine, CircleX, Send } from 'lucide-vue-next'
import type { ApplicationStatus } from '~/types/models'
const props=defineProps<{status:ApplicationStatus}>()
const config=computed(()=>({
  draft:{text:'Bản nháp',color:'status-blue',icon:FilePenLine},
  submitted:{text:'Đã tiếp nhận',color:'status-blue',icon:Send},
  processing:{text:'Đang xử lý',color:'status-blue',icon:Clock3},
  supplement:{text:'Cần bổ sung',color:'status-orange',icon:AlertCircle},
  completed:{text:'Hoàn thành',color:'status-green',icon:CheckCircle2},
  rejected:{text:'Không tiếp nhận',color:'status-red',icon:CircleX}
})[props.status]||{text:props.status,color:'status-blue',icon:Clock3})
</script>
<template><span :class="['inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold',config.color]"><component :is="config.icon" :size="14" />{{config.text}}</span></template>
