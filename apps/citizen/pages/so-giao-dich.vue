<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import {Download,Search,RefreshCw,History} from 'lucide-vue-next'
type Row={caseId:string;title:string;status:string;eventType:string;note:string;at:string}
const search=ref('');const queryText=ref('');const status=ref('all')
const params=computed(()=>({q:queryText.value,status:status.value}))
const {data,pending,error,refresh}=await useFetch<{items:Row[];total:number;notice:string}>('/api/citizen/transactions',{query:params,key:'citizen-transaction-ledger'})
const exportUrl=computed(()=>`/api/citizen/transactions?format=csv&status=${encodeURIComponent(status.value)}&q=${encodeURIComponent(queryText.value)}`)
</script>
<template><div class="space-y-4">
 <section class="panel space-y-2 p-5"><h2 class="flex items-center gap-2 text-xl font-black"><History :size="24"/>Sổ giao dịch hành chính cá nhân</h2><p class="text-sm text-muted">Lịch sử từ các hồ sơ và sự kiện mà tài khoản này có quyền truy cập. Dữ liệu CSV chỉ dành cho chủ tài khoản.</p></section>
 <form class="panel flex flex-wrap gap-2 p-4" @submit.prevent="queryText=search.trim()"><label class="sr-only" for="ledger-q">Tìm mã hồ sơ hoặc thủ tục</label><input id="ledger-q" v-model="search" class="field flex-1" maxlength="90" placeholder="Mã hồ sơ hoặc tên thủ tục"/>
 <select v-model="status" class="field !w-auto" aria-label="Lọc trạng thái"><option value="all">Tất cả</option><option value="draft">Bản nháp</option><option value="submitted">Đã nộp</option><option value="processing">Đang xử lý</option><option value="supplement">Cần bổ sung</option><option value="completed">Hoàn thành</option><option value="rejected">Từ chối</option></select>
 <button type="submit" class="btn-primary"><Search :size="16"/>Tìm</button><button type="button" class="btn-outline" @click="refresh()"><RefreshCw :size="16"/>Làm mới</button><a :href="exportUrl" class="btn-outline"><Download :size="16"/>Xuất CSV</a></form>
 <section class="panel p-4"><div v-if="pending" class="text-sm">Đang tải lịch sử...</div><p v-else-if="error" class="text-sm text-rose-700">Không tải được giao dịch; vui lòng đăng nhập lại hoặc kiểm tra kết nối.</p>
 <p v-else-if="!data?.items.length" class="text-sm text-muted">Chưa có giao dịch tương ứng.</p><div v-else class="space-y-0">
  <article v-for="(item,index) in data.items" :key="`${item.caseId}:${item.eventType}:${item.at}:${index}`" class="border-b py-3 last:border-0"><div class="flex flex-wrap items-start justify-between gap-2"><NuxtLink :to="`/ho-so/${encodeURIComponent(item.caseId)}`" class="text-sm font-extrabold text-brand-700">{{item.title}} · {{item.caseId}}</NuxtLink><time class="text-xs text-muted">{{new Date(item.at).toLocaleString('vi-VN')}}</time></div><p class="mt-1 text-sm">{{item.note}}</p><p class="mt-1 text-xs text-muted">{{item.eventType}} · {{item.status}} <NuxtLink v-if="item.status!=='draft'" :to="`/nop-thanh-cong/${encodeURIComponent(item.caseId)}`" class="ml-2 font-bold text-brand-700 underline">Xem biên nhận</NuxtLink></p></article>
 </div><p class="mt-3 text-xs text-muted">{{data?.notice}}</p></section>
 </div></template>
