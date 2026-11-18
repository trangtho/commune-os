<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import {Search,MessageCircleQuestion} from 'lucide-vue-next'
const situation=ref('');const pending=ref(false);const errorText=ref('')
type Result={items:{id:string;title:string;summary:string;source:string;score:number}[];questions:string[];notice:string;method:string}
const result=ref<Result|null>(null)
async function find(){if(situation.value.trim().length<5||pending.value)return
 pending.value=true;errorText.value='';try{result.value=await $fetch<Result>('/api/procedures/situation',{method:'POST',body:{situation:situation.value.trim()}})}catch(e){errorText.value=readableError(e)}finally{pending.value=false}}
</script>
<template><div class="space-y-4">
<section class="panel space-y-3 p-5"><h2 class="flex items-center gap-2 text-xl font-black"><MessageCircleQuestion :size="24"/>Tìm thủ tục bằng tình huống thực tế</h2><p class="text-sm text-muted">Ví dụ: “Tôi vừa sinh con thì cần làm giấy tờ gì?” Công cụ tìm trong danh mục công bố bằng ngữ nghĩa theo quy tắc; không tự khẳng định thủ tục phù hợp pháp lý.</p>
<form class="space-y-3" @submit.prevent="find"><label for="situation" class="field-label">Mô tả tình huống của bạn</label><textarea id="situation" v-model="situation" class="field" rows="3" maxlength="400" minlength="5" required placeholder="Tôi muốn mở một cửa hàng nhỏ, cần làm gì?"/><button type="submit" class="btn-primary" :disabled="pending||situation.trim().length<5"><Search :size="16"/>{{pending?'Đang tìm...':'Tìm thủ tục phù hợp'}}</button></form><p v-if="errorText" class="text-sm text-rose-700" role="alert">{{errorText}}</p></section>
<section v-if="result" class="panel space-y-4 p-5"><h3 class="font-extrabold">Gợi ý từ dữ liệu đang có</h3><p v-if="!result.items.length" class="text-sm text-muted">Chưa xác định được thủ tục tương ứng; hãy bổ sung thông tin hoặc hỏi cán bộ.</p>
<div v-for="item in result.items" :key="item.id" class="rounded-lg border p-3"><NuxtLink :to="item.source" class="font-bold text-brand-700 underline">{{item.title}}</NuxtLink><p class="mt-1 text-sm">{{item.summary}}</p></div>
<div class="rounded-lg bg-blue-50 p-3"><p class="text-sm font-bold">Thông tin cần làm rõ</p><ul class="list-disc pl-5 text-sm"><li v-for="q in result.questions" :key="q">{{q}}</li></ul></div><p class="text-xs text-muted">{{result.notice}}</p></section>
</div></template>
