<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import {ArrowRightLeft,ShieldCheck} from 'lucide-vue-next'
type SyncData={localities:{id:string;name:string}[];requests:{id:string;state:string;target_name:string;created_at:string;review_note?:string}[];notice:string}
const {data,error,refresh}=await useFetch<SyncData>('/api/citizen/sync',{key:'citizen-sync-center'})
const target=ref('');const fields=ref(['display_name']);const confirmed=ref(false);const busy=ref(false);const message=ref('')
const choices=[{key:'display_name',label:'Họ tên'},{key:'phone',label:'Số điện thoại'},{key:'address',label:'Địa chỉ'}]
async function send(){if(!confirmed.value||!target.value||!fields.value.length||busy.value)return
 busy.value=true;message.value='';try{const result=await $fetch<{notice:string}>('/api/citizen/sync',{method:'POST',body:{targetTenantId:target.value,categories:fields.value,confirmed:true}});message.value=result.notice;confirmed.value=false;await refresh()}catch(e){message.value=readableError(e)}finally{busy.value=false}}
async function cancel(id:string){if(busy.value||!confirm('Hủy yêu cầu chia sẻ đang chờ?'))return
 busy.value=true;try{await $fetch(`/api/citizen/sync/${id}/cancel`,{method:'POST',body:{confirmed:true}});await refresh()}catch(e){message.value=readableError(e)}finally{busy.value=false}}
</script>
<template><div class="space-y-4">
<section class="panel space-y-2 p-5"><h2 class="flex items-center gap-2 text-xl font-black"><ArrowRightLeft :size="22"/>Chuẩn hóa và đồng bộ thông tin liên địa phương</h2><p class="text-sm text-muted">Dữ liệu sử dụng mô hình trường thống nhất. Chỉ chia sẻ những mục bạn chọn tới địa phương nhận được xác định; không tự thay thế thông tin hoặc di chuyển tài khoản.</p></section>
<form class="panel space-y-4 p-5" @submit.prevent="send"><h3 class="font-extrabold">Tạo yêu cầu trao đổi dữ liệu tự khai</h3>
<p v-if="error" class="text-sm text-rose-700">Không tải được danh mục địa phương.</p><label class="block text-sm font-bold">Địa phương tiếp nhận<select v-model="target" class="field mt-2" required><option value="">Chọn địa phương</option><option v-for="l in data?.localities||[]" :key="l.id" :value="l.id">{{l.name}}</option></select></label>
<fieldset><legend class="mb-2 text-sm font-bold">Phạm vi thông tin cho phép chia sẻ</legend><label v-for="c in choices" :key="c.key" class="mr-4 inline-flex items-center gap-2 text-sm"><input v-model="fields" type="checkbox" :value="c.key"/>{{c.label}}</label></fieldset>
<p class="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Nguồn hiện tại: dữ liệu công dân tự khai (chưa đồng nghĩa đã xác thực). Cơ quan nhận phải đối chiếu dữ liệu gốc và xử lý xung đột thủ công. Chưa tích hợp nền tảng đồng bộ liên tỉnh chính thức.</p>
<label class="flex items-start gap-2 text-sm"><input v-model="confirmed" type="checkbox" class="mt-1"/><span>Tôi đồng ý chia sẻ đúng các trường đã chọn cho địa phương nhận để phục vụ kiểm tra đồng bộ.</span></label>
<button class="btn-primary" type="submit" :disabled="busy||!target||!fields.length||!confirmed"><ShieldCheck :size="16"/>{{busy?'Đang gửi...':'Xác nhận gửi yêu cầu'}}</button><p v-if="message" class="text-sm" role="status">{{message}}</p></form>
<section class="panel p-5"><h3 class="mb-3 font-extrabold">Lịch sử yêu cầu</h3><p v-if="!data?.requests.length" class="text-sm text-muted">Chưa có yêu cầu.</p><div v-for="r in data?.requests||[]" :key="r.id" class="flex flex-wrap items-center justify-between gap-3 border-b py-3"><div><p class="font-bold">{{r.target_name}}</p><p class="text-xs text-muted">{{new Date(r.created_at).toLocaleString('vi-VN')}} · {{r.state}}</p><p v-if="r.review_note" class="text-xs">{{r.review_note}}</p></div><button v-if="r.state==='pending'" class="btn-outline !text-xs" :disabled="busy" @click="cancel(r.id)">Hủy yêu cầu</button></div></section>
</div></template>
