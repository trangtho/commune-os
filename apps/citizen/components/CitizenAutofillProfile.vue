<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { BadgeCheck, IdCard, Save, ShieldAlert } from 'lucide-vue-next'
import {factLabels,type CitizenFact} from '~/shared/citizen-autofill'
const {data,error,refresh}=await useFetch<{facts:CitizenFact[];self:{birthDate:string;citizenIdentifier:string}}>('/api/citizen/autofill',{key:'citizen-autofill-profile'})
const form=reactive({birthDate:'',citizenIdentifier:''})
const busy=ref(false);const editing=ref(false);const notice=ref('');const failure=ref('')
watch(data,value=>{if(value&&!editing.value){form.birthDate=value.self.birthDate||'';form.citizenIdentifier=value.self.citizenIdentifier||''}},{immediate:true})
async function save(){if(busy.value)return;busy.value=true;notice.value='';failure.value=''
 try{await $fetch('/api/citizen/autofill/self',{method:'PATCH',body:form});editing.value=false;await refresh();notice.value='Đã lưu thông tin tự khai. Những giá trị này không được đánh dấu đã xác minh.'}
 catch(e){failure.value=readableError(e)}finally{busy.value=false}
}
</script>
<template><section class="panel space-y-4 p-5" aria-labelledby="citizen-autofill-profile-title"><div class="flex items-start gap-3"><span class="grid h-10 w-10 place-items-center rounded-lg bg-blue-100 text-brand-700"><IdCard :size="23"/></span><div><h3 id="citizen-autofill-profile-title" class="text-lg font-extrabold text-brand-900">Thông tin hỗ trợ tự điền biểu mẫu</h3><p class="text-xs text-muted">Cập nhật ngày sinh, số định danh tự khai để có thể sử dụng khi điền các thủ tục phù hợp.</p></div></div>
 <p v-if="error" role="alert" class="text-sm text-rose-700">Không thể tải dữ liệu hỗ trợ tự điền.</p>
 <form class="space-y-3" @submit.prevent="save" @input="editing=true"><div class="grid gap-3 sm:grid-cols-2"><div><label for="fact-birth-date" class="field-label">Ngày sinh (tự khai)</label><input id="fact-birth-date" v-model="form.birthDate" type="date" class="field"/></div><div><label for="fact-identifier" class="field-label">Số định danh cá nhân (tự khai)</label><input id="fact-identifier" v-model="form.citizenIdentifier" class="field" maxlength="12" minlength="12" inputmode="numeric" pattern="[0-9]{12}" placeholder="12 chữ số (nếu muốn cung cấp)"/></div></div><p class="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900"><ShieldAlert :size="17" class="shrink-0"/>Dữ liệu nhập tại đây là tự khai. Đăng nhập OIDC không tự biến dữ liệu tự khai thành thông tin đã xác minh. Chỉ những thuộc tính nhận từ nhà cung cấp đã phê duyệt, có sự đồng ý và được kiểm tra chữ ký mới được ghi nguồn xác minh.</p><button class="btn-primary" :disabled="busy" type="submit"><Save :size="15"/>{{busy?'Đang lưu...':'Lưu dữ liệu tự khai'}}</button></form>
 <p v-if="notice" role="status" class="rounded-lg bg-green-50 p-3 text-xs text-green-800">{{notice}}</p><p v-if="failure" role="alert" class="rounded-lg bg-rose-50 p-3 text-xs text-rose-800">{{failure}}</p>
 <div v-if="data?.facts?.length" class="border-t pt-3"><h4 class="mb-2 text-sm font-bold">Nguồn dữ liệu hiện được ưu tiên khi tự điền</h4><div class="grid gap-2 sm:grid-cols-2"><div v-for="fact in data.facts" :key="fact.key" class="rounded-lg border bg-slate-50 px-3 py-2 text-xs"><p class="font-bold text-slate-700">{{factLabels[fact.key]}}</p><p class="mt-1 break-words font-medium">{{fact.key==='citizenIdentifier'?'••••••••'+fact.value.slice(-4):fact.value}}</p><p :class="['mt-1 flex items-center gap-1',fact.source==='oidc_verified'?'text-green-700':'text-amber-800']"><BadgeCheck :size="13"/>{{fact.source==='oidc_verified'?'Đã xác minh qua nguồn định danh':'Công dân tự khai'}}</p><p class="mt-1 break-words text-slate-500">{{fact.sourceLabel}}</p></div></div></div>
 </section></template>
