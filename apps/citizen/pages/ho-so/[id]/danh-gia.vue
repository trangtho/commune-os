<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { Star, ArrowLeft, RefreshCw } from 'lucide-vue-next'
import { reviewStages,stageEligible,type ReviewStage } from '~/shared/stage-feedback'
interface AppRecord { id:string;procedure_title:string;status:string;events?:{event_type:string}[] }
interface Review {id:string;stage:ReviewStage;rating:number;comment:string;created_at:string}
const id=String(useRoute().params.id)
const {data:app,error:caseError}=await useFetch<AppRecord>(`/api/applications/${encodeURIComponent(id)}`)
const {data:reviews,error,refresh}=await useFetch<{items:Review[]}>(`/api/applications/${encodeURIComponent(id)}/reviews`)
const selected=ref<ReviewStage>('guidance'),rating=ref(0),comment=ref(''),submitting=ref(false),notice=ref(''),failure=ref('')
const eventTypes=computed(()=>app.value?.events?.map(e=>e.event_type)||[])
const eligible=computed(()=>app.value?reviewStages.filter(s=>stageEligible(s.value,app.value!.status,eventTypes.value)):[])
const completed=computed(()=>new Set((reviews.value?.items||[]).map(r=>r.stage)))
const available=computed(()=>eligible.value.filter(s=>!completed.value.has(s.value)))
watch(available, v=>{if(v.length&&!v.some(s=>s.value===selected.value))selected.value=v[0].value},{immediate:true})
const {dateTime}=useFormat()
async function send(){if(!rating.value||submitting.value)return;submitting.value=true;failure.value='';notice.value='';try{
 await $fetch(`/api/applications/${encodeURIComponent(id)}/reviews`,{method:'POST',body:{stage:selected.value,rating:rating.value,comment:comment.value}})
 notice.value='Đã ghi nhận đánh giá của bạn cho giai đoạn này.';rating.value=0;comment.value='';await refresh()
}catch(e){failure.value=readableError(e)}finally{submitting.value=false}}
</script>
<template>
 <div class="space-y-4"><NuxtLink :to="`/ho-so/${id}`" class="inline-flex items-center gap-2 text-sm font-bold text-brand-700"><ArrowLeft :size="16"/>Quay lại hồ sơ</NuxtLink>
  <header><h2 class="text-xl font-black text-brand-900">Đánh giá chất lượng phục vụ</h2><p class="mt-1 text-sm text-muted">Đánh giá riêng từng giai đoạn đã trải nghiệm. Mỗi giai đoạn có một đánh giá nhằm giữ nguyên lịch sử phản hồi.</p></header>
  <p v-if="caseError||error" role="alert" class="panel p-4 text-rose-700">Không tìm thấy hồ sơ hoặc bạn không có quyền truy cập.</p>
  <template v-else-if="app"><section class="panel p-4"><p class="text-xs font-semibold text-brand-700">Mã hồ sơ: {{app.id}}</p><h3 class="mt-1 font-bold">{{app.procedure_title}}</h3></section>
   <section class="panel space-y-4 p-4 sm:p-5"><h3 class="section-label">Chia sẻ trải nghiệm theo giai đoạn</h3>
    <p v-if="!available.length" class="rounded-lg bg-slate-50 p-3 text-sm text-muted">Bạn đã đánh giá tất cả giai đoạn hiện đủ điều kiện. Các giai đoạn khác sẽ xuất hiện khi hồ sơ đạt trạng thái tương ứng.</p>
    <form v-else class="space-y-4" @submit.prevent="send"><div><label for="review-stage" class="field-label">Giai đoạn cần đánh giá</label><select id="review-stage" v-model="selected" class="field" required><option v-for="s in available" :key="s.value" :value="s.value">{{s.label}}</option></select><p class="mt-1 text-xs text-muted">{{reviewStages.find(s=>s.value===selected)?.description}}</p></div>
     <fieldset><legend class="field-label">Mức độ hài lòng (1 đến 5 sao)</legend><div class="flex flex-wrap gap-2"><button v-for="n in 5" :key="n" type="button" :aria-label="`${n} sao`" :aria-pressed="rating===n" :class="['flex items-center gap-1 rounded-lg border px-3 py-2 font-bold focus-visible:outline',rating===n?'border-amber-600 bg-amber-100 text-amber-900':'border-slate-300 bg-white']" @click="rating=n"><Star :size="18" :fill="rating>=n?'currentColor':'none'"/>{{n}}</button></div></fieldset>
     <div><label for="review-comment" class="field-label">Ý kiến góp ý (không bắt buộc)</label><textarea id="review-comment" v-model="comment" class="field" rows="4" maxlength="1000" placeholder="Điều gì bạn muốn cải thiện? Không nhập thông tin nhạy cảm."/></div><p v-if="failure" role="alert" class="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{{failure}}</p><p v-if="notice" role="status" class="rounded-lg bg-green-50 p-3 text-sm text-green-800">{{notice}}</p><button type="submit" class="btn-primary" :disabled="submitting||rating===0">{{submitting?'Đang gửi...':'Gửi đánh giá'}}</button>
    </form>
   </section>
   <section class="panel p-4 sm:p-5"><div class="mb-3 flex items-center justify-between gap-2"><h3 class="section-label !mb-0">Đánh giá đã gửi</h3><button class="btn-outline !py-1.5" type="button" @click="refresh()"><RefreshCw :size="15"/>Tải lại</button></div><p v-if="!reviews?.items?.length" class="text-sm text-muted">Chưa có đánh giá nào.</p><article v-for="r in reviews?.items||[]" :key="r.id" class="border-b border-slate-100 py-3 last:border-b-0"><p class="font-bold">{{reviewStages.find(s=>s.value===r.stage)?.label||r.stage}} · {{r.rating}}/5 sao</p><p class="mt-1 whitespace-pre-wrap text-sm">{{r.comment||'Không có góp ý chi tiết'}}</p><p class="mt-1 text-xs text-muted">{{dateTime(r.created_at)}}</p></article></section>
  </template>
 </div>
</template>
