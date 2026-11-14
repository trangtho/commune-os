<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import {ArrowLeft,AlertCircle,UploadCloud} from 'lucide-vue-next'
import type {Application,CaseDocument,ProcedureDocument} from '~/types/models'
const id=String(useRoute().params.id)
const {data:c,error,refresh}=await useFetch<Application & {requirements:ProcedureDocument[]}>(`/api/applications/${id}`, {key:`citizen-application:${id}`})
const busy=ref(false);const errorText=ref('')
const lastSupplementTime=computed(()=>Math.max(0,...(c.value?.events||[]).filter(e=>e.event_type==='supplement').map(e=>Date.parse(e.created_at)||0)))
const hasNewDocuments=computed(()=>Boolean(c.value?.documents?.some(d=>(Date.parse(d.uploaded_at)||0)>lastSupplementTime.value)))
async function complete(){busy.value=true;errorText.value='';try{await $fetch(`/api/applications/${id}/complete-supplement`,{method:'POST'});await refresh();await navigateTo(`/ho-so/${id}`)}catch(e){errorText.value=readableError(e)}finally{busy.value=false}}
</script>
<template><div class="space-y-4"><NuxtLink :to="`/ho-so/${id}`" class="inline-flex items-center gap-1 text-sm text-brand-700"><ArrowLeft :size="16"/> Chi tiết hồ sơ</NuxtLink><div v-if="error" class="panel p-6 text-rose-600">Không tải được hồ sơ.</div><template v-else-if="c"><div class="panel p-5"><h2 class="text-xl font-black">Bổ sung hồ sơ {{id}}</h2><p class="mt-1 text-sm text-muted">{{c.procedure_title}}</p><div class="mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-800"><AlertCircle :size="19" class="mr-2 inline"/>Hồ sơ cần bổ sung giấy tờ. Chọn đúng loại giấy tờ và xác nhận gửi lại.</div></div><section v-if="c.status==='supplement'" class="panel space-y-4 p-5"><h3 class="section-label"><UploadCloud :size="20" class="text-blue-600"/>Tải giấy tờ bổ sung</h3><DocUploader :application-id="id" :requirements="c.requirements||[]" :uploaded="c.documents||[]" @uploaded="refresh()"/><p class="text-xs text-muted">Hãy tải ít nhất một tệp mới sau yêu cầu bổ sung gần nhất.</p><p v-if="errorText" role="alert" class="text-sm text-rose-700">{{errorText}}</p><button class="btn-primary" :disabled="busy||!hasNewDocuments" @click="complete">{{busy?'Đang gửi...':'Xác nhận gửi bổ sung hồ sơ'}}</button></section><div v-else class="panel p-5 text-green-700">Hồ sơ hiện không còn ở trạng thái yêu cầu bổ sung. <NuxtLink :to="`/ho-so/${id}`" class="font-bold underline">Xem tiến trình</NuxtLink></div></template></div></template>
