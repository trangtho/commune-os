<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import {ArrowLeft,CheckCircle2,Info,Printer,Download,RefreshCw} from 'lucide-vue-next'
import type {Application} from '~/types/models'
const id=String(useRoute().params.id)
const {data:c,error}=await useFetch<Application>(`/api/applications/${encodeURIComponent(id)}`,{key:`citizen-application:${id}`})
interface SignedResult {available:boolean;configured:boolean;verification:string;title?:string;signer?:string;signedAt?:string;reference?:string;message?:string}
const {data:document,refresh:refreshResult,error:resultError}=await useFetch<SignedResult>(`/api/applications/${encodeURIComponent(id)}/result`,{key:`citizen-result:${id}`,immediate:c.value?.status==='completed'})
const {date,dateTime}=useFormat()
const proof=ref<{url:string;qrUrl:string;expiresAt:string;notice:string}|null>(null)
const proofBusy=ref(false),proofMessage=ref('')
async function issueProof(){
 if(proofBusy.value || !confirm('Cấp mã kiểm chứng mới? Mã cũ của hồ sơ này sẽ bị thu hồi.'))return
 proofBusy.value=true;proofMessage.value=''
 try{proof.value=await $fetch(`/api/applications/${encodeURIComponent(id)}/verification`,{method:'POST',body:{confirmed:true}})}
 catch(e){proofMessage.value=readableError(e)}finally{proofBusy.value=false}
}
function printInfo(){if(import.meta.client)window.print()}
</script>
<template><div class="space-y-4"><NuxtLink :to="`/ho-so/${id}`" class="inline-flex items-center gap-1 text-sm font-bold text-brand-700 print:hidden"><ArrowLeft :size="16"/> Chi tiết hồ sơ</NuxtLink>
<div v-if="error" class="panel p-6 text-rose-600" role="alert">Không tải được hồ sơ.</div><div v-else-if="c" class="panel space-y-5 p-6"><div class="flex flex-wrap items-center justify-between gap-3"><div><h2 class="text-2xl font-black">Kết quả giải quyết</h2><p class="text-sm text-muted">{{c.procedure_title}}</p></div><CheckCircle2 v-if="c.status==='completed'" :size="40" class="text-green-600"/></div>
<div v-if="c.status!=='completed'" class="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">Hồ sơ chưa có kết quả. Vui lòng theo dõi tiến độ.</div><template v-else><div class="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800"><b>Trạng thái hồ sơ: Đã hoàn thành</b><p class="mt-1 text-sm">{{c.result_note||'Đã cập nhật trạng thái hoàn thành.'}}</p></div><dl class="grid gap-3 text-sm sm:grid-cols-2"><div><dt class="text-muted">Mã hồ sơ</dt><dd class="break-all font-bold">{{id}}</dd></div><div><dt class="text-muted">Ngày dự kiến</dt><dd class="font-bold">{{date(c.due_at)}}</dd></div><div><dt class="text-muted">Người nộp</dt><dd class="font-bold">{{c.applicant_name}}</dd></div><div><dt class="text-muted">Thủ tục</dt><dd class="font-bold">{{c.procedure_title}}</dd></div></dl>
<section class="rounded-xl border border-blue-200 p-4 space-y-3"><div class="flex flex-wrap items-center justify-between gap-2"><h3 class="font-extrabold">Văn bản kết quả điện tử</h3><button class="btn-outline print:hidden" @click="refreshResult()"><RefreshCw :size="15"/> Kiểm tra lại</button></div><p v-if="resultError" class="text-sm text-rose-700" role="alert">Không thể kết nối kho kết quả điện tử.</p><div v-else-if="document?.available" class="space-y-2"><b>{{document.title}}</b><p class="text-xs text-muted">Cơ quan/người ký theo dịch vụ: {{document.signer||'Chưa cung cấp'}} · Thời gian: {{dateTime(document.signedAt)}}</p><p :class="['text-sm font-bold',document.verification==='verified'?'text-green-700':'text-amber-700']">{{document.verification==='verified'?'Dịch vụ cấp kết quả báo chữ ký hợp lệ':document.verification==='unverified'?'Dịch vụ báo chữ ký chưa hợp lệ':'Chưa có thông tin kiểm chứng chữ ký'}}</p><p class="text-xs text-muted">Trạng thái chữ ký do dịch vụ cấp kết quả cung cấp; cổng công dân không tự xác minh mật mã.</p><a :href="`/api/applications/${encodeURIComponent(id)}/result-file`" class="btn-primary print:hidden"><Download :size="16"/>Tải văn bản PDF</a></div><div v-else class="flex items-start gap-2 text-sm text-amber-800"><Info :size="17" class="shrink-0"/>{{document?.message||'Chưa có tài liệu ký số. Chỉ hiển thị thông tin trạng thái hồ sơ.'}}</div></section>
<section class="space-y-3 rounded-xl border border-blue-200 p-4"><h3 class="font-extrabold">Mã QR kiểm chứng kết quả</h3>
<p class="text-xs text-muted">Chỉ cấp mã khi dịch vụ kết quả báo chữ ký hợp lệ và có PDF để đối chiếu. Mã cũ sẽ bị thu hồi nếu cấp lại.</p>
<button type="button" class="btn-outline" :disabled="proofBusy||!document?.available||document?.verification!=='verified'" @click="issueProof">{{proofBusy?'Đang kiểm chứng tệp...':'Cấp mã kiểm chứng'}}</button>
<p v-if="proofMessage" class="text-sm text-rose-700" role="alert">{{proofMessage}}</p>
<div v-if="proof" class="space-y-3"><img :src="proof.qrUrl" alt="Mã QR tra cứu kết quả" class="h-48 w-48 max-w-full rounded border bg-white"/><a :href="proof.url" class="block break-all text-sm font-bold text-brand-700 underline" target="_blank" rel="noopener noreferrer">{{proof.url}}</a><p class="text-xs text-muted">{{proof.notice}}</p><button type="button" class="btn-outline print:hidden" @click="printInfo"><Printer :size="16"/>In phiếu mã kiểm chứng (không thay văn bản ký số)</button></div></section>
<div class="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-4 text-center"><Info class="mx-auto mb-2" :size="24"/><b>THÔNG TIN KẾT QUẢ HIỂN THỊ</b><p class="mt-2 text-sm text-muted">Bản in thông tin của trang không thay thế văn bản kết quả có chữ ký số.</p></div><button class="btn-outline print:hidden" @click="printInfo"><Printer :size="16"/> In thông tin hồ sơ</button></template></div></div></template>
