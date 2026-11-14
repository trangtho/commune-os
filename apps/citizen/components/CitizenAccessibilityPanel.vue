<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { Accessibility, Volume2, VolumeX, X, Contrast, Type } from 'lucide-vue-next'
const open=ref(false)
const large=ref(false)
const contrast=ref(false)
const speaking=ref(false)
const speechSupported=ref(true)
const status=ref('')
function applySettings(){
  if(!import.meta.client)return
  document.documentElement.classList.toggle('citizen-access-large',large.value)
  document.documentElement.classList.toggle('citizen-access-contrast',contrast.value)
  localStorage.setItem('communeos-citizen-accessibility-v1',JSON.stringify({large:large.value,contrast:contrast.value}))
}
onMounted(()=>{
  speechSupported.value='speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
  try{
    const saved=JSON.parse(localStorage.getItem('communeos-citizen-accessibility-v1')||'{}')
    large.value=saved.large===true
    contrast.value=saved.contrast===true
  }catch { /* malformed local preference is ignored */ }
  applySettings()
})
watch([large,contrast],applySettings)
function stop(){
  if(import.meta.client && speechSupported.value)window.speechSynthesis.cancel()
  speaking.value=false
}
function readContent(){
  if(!import.meta.client||!speechSupported.value){status.value='Trình duyệt chưa hỗ trợ chức năng đọc văn bản.';return}
  stop()
  const selected=window.getSelection()?.toString().trim()
  const element=document.getElementById('citizen-main')
  const content=(selected||element?.innerText||'').replace(/\s+/g,' ').trim().slice(0,4500)
  if(!content){status.value='Chưa có nội dung để đọc.';return}
  const utterance=new SpeechSynthesisUtterance(content)
  utterance.lang='vi-VN'; utterance.rate=.9
  utterance.onend=()=>{speaking.value=false}
  utterance.onerror=()=>{speaking.value=false;status.value='Không thể phát giọng đọc trên trình duyệt này.'}
  window.speechSynthesis.speak(utterance)
  speaking.value=true;status.value='Đang đọc nội dung trang. Có thể dừng bất cứ lúc nào.'
}
function handleKey(event:KeyboardEvent){if(event.key==='Escape'){open.value=false;stop()}}
onBeforeUnmount(stop)
</script>
<template>
  <div class="relative" @keydown="handleKey">
    <button type="button" class="rounded-lg border border-brand-200 bg-white p-2 text-brand-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 sm:px-3" :aria-expanded="open" aria-controls="citizen-accessibility-options" aria-label="Tùy chọn hỗ trợ tiếp cận" @click="open=!open">
      <Accessibility :size="19" aria-hidden="true"/><span class="sr-only">Bật chế độ dễ sử dụng</span>
    </button>
    <section v-if="open" id="citizen-accessibility-options" class="absolute right-0 top-full z-[70] mt-2 w-[min(92vw,355px)] rounded-xl border-2 border-brand-300 bg-white p-4 text-ink shadow-2xl" aria-label="Hỗ trợ sử dụng">
      <div class="mb-3 flex items-center justify-between gap-2"><h2 class="text-base font-extrabold">Hỗ trợ sử dụng</h2><button type="button" class="rounded-md p-2 hover:bg-slate-100" aria-label="Đóng tùy chọn hỗ trợ" @click="open=false"><X :size="18"/></button></div>
      <p class="mb-3 text-sm leading-relaxed">Tùy chỉnh hiển thị mà không mất dữ liệu đang nhập. Dùng phím Tab để chuyển giữa các nút, Enter để chọn.</p>
      <label class="mb-2 flex cursor-pointer items-center justify-between gap-2 rounded-lg border p-3 text-sm font-semibold"><span class="flex items-center gap-2"><Type :size="17"/>Chữ lớn, dễ đọc</span><input v-model="large" type="checkbox" class="h-5 w-5 accent-blue-700"/></label>
      <label class="mb-3 flex cursor-pointer items-center justify-between gap-2 rounded-lg border p-3 text-sm font-semibold"><span class="flex items-center gap-2"><Contrast :size="17"/>Tương phản cao</span><input v-model="contrast" type="checkbox" class="h-5 w-5 accent-blue-700"/></label>
      <div class="grid grid-cols-2 gap-2"><button type="button" class="btn-outline !px-2" :disabled="!speechSupported" @click="readContent"><Volume2 :size="16"/>Đọc nội dung</button><button type="button" class="btn-outline !px-2" :disabled="!speaking" @click="stop"><VolumeX :size="16"/>Dừng đọc</button></div>
      <p class="mt-2 text-xs text-slate-600">Chọn một đoạn văn trước khi nhấn “Đọc nội dung” để chỉ đọc đoạn đó. Giọng nói phụ thuộc trình duyệt.</p>
      <p v-if="status" class="mt-2 text-xs font-semibold" role="status">{{status}}</p>
      <NuxtLink to="/huong-dan" class="mt-3 block text-sm font-bold text-brand-700 underline" @click="open=false">Xem hướng dẫn theo từng bước</NuxtLink>
    </section>
  </div>
</template>
