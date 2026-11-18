<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
definePageMeta({layout:'default'})
useHead({meta:[{name:'robots',content:'noindex,nofollow,noarchive'},{name:'referrer',content:'no-referrer'}]})
const code=typeof useRoute().query.code==='string'?String(useRoute().query.code):''
const valid=/^[A-Za-z0-9_-]{43}$/.test(code)
const {data,error,pending,refresh}=await useFetch<{found:boolean;status:string;notice:string;reference?:string;issuedAt?:string;expiresAt?:string}>(
 `/api/result-verifications/${valid?encodeURIComponent(code):'invalid'}`,{key:`result-check:${code}`,immediate:valid})
const labels:Record<string,string>={matched:'Tệp kết quả trùng khớp với mã băm đã cấp',changed:'Kết quả đã thay đổi — cần kiểm tra',inactive:'Mã không còn hiệu lực',unavailable:'Chưa thể kiểm chứng',not_found:'Không tìm thấy mã'}
</script>
<template><section class="mx-auto max-w-2xl space-y-4">
 <div class="panel space-y-3 p-6"><h2 class="text-2xl font-black">Kiểm chứng kết quả điện tử</h2>
  <p class="text-sm text-muted">Trang tra cứu công khai chỉ hiển thị trạng thái kiểm chứng tối thiểu; không hiển thị họ tên, số định danh hoặc nội dung tài liệu.</p>
  <p v-if="!valid" class="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Thiếu hoặc sai định dạng mã tra cứu. Hãy quét QR được phát hành cùng văn bản.</p>
  <p v-else-if="pending" class="text-sm">Đang đối chiếu với kho kết quả...</p>
  <p v-else-if="error" class="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">Không thể xác minh. Vui lòng thử lại sau.</p>
  <template v-else-if="data"><p :class="['rounded-lg p-4 text-lg font-bold',data.status==='matched'?'bg-green-50 text-green-800':'bg-amber-50 text-amber-800']">{{labels[data.status]||'Trạng thái chưa rõ'}}</p>
   <p class="text-sm">{{data.notice}}</p><dl class="grid gap-3 text-sm sm:grid-cols-2"><div><dt class="text-muted">Tham chiếu kết quả</dt><dd>{{data.reference||'Không công bố'}}</dd></div><div><dt class="text-muted">Ngày cấp mã</dt><dd>{{data.issuedAt?new Date(data.issuedAt).toLocaleDateString('vi-VN'):'—'}}</dd></div><div><dt class="text-muted">Hạn mã tra cứu</dt><dd>{{data.expiresAt?new Date(data.expiresAt).toLocaleDateString('vi-VN'):'—'}}</dd></div></dl>
   <button class="btn-outline" @click="refresh()">Kiểm tra lại</button></template>
  <p class="text-xs text-muted">Dữ liệu thử nghiệm: trạng thái chữ ký số do dịch vụ cấp kết quả cung cấp; nếu không có xác thực mật mã độc lập, không nên xem trang này là chứng nhận chữ ký số.</p>
 </div>
</section></template>
