<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
// Nút trợ lý AI nổi ở mọi trang của màn hình cán bộ. Gọi /api/tro-ly → cổng AI của lõi bằng token cán bộ:
// chỉ thủ tục xã đang mở và hướng dẫn nghiệp vụ, trích nguồn nguyên văn; không đọc hồ sơ hay dữ liệu công dân.
import { Bot, MessageCircle, Send, X, ExternalLink } from 'lucide-vue-next'
type Source = { title: string; url: string | null }
type Message = { role: 'user' | 'assistant'; text: string; sources?: Source[]; error?: boolean }
const route = useRoute()
const open = ref(false)
const input = ref('')
const busy = ref(false)
const messages = ref<Message[]>([{ role: 'assistant', text: 'Xin chào! Tôi trả lời về thủ tục xã đang mở (giấy tờ, lệ phí, thời hạn) và nghiệp vụ xử lý hồ sơ (tiếp nhận, phân công, bổ sung, trình duyệt).' }])
// Chỉ hiện khi cán bộ đã đăng nhập (phiên dùng chung với thanh điều hướng).
const { data: staffAuth } = useNuxtData<{ authenticated: boolean }>('staff-auth')
const box = ref<HTMLElement | null>(null)
const field = ref<HTMLTextAreaElement | null>(null)
const hidden = computed(() => route.path === '/dang-nhap' || !staffAuth.value?.authenticated)

async function scrollDown() { await nextTick(); box.value?.scrollTo({ top: box.value.scrollHeight, behavior: 'smooth' }) }
async function toggle() { open.value = !open.value; if (open.value) { await nextTick(); field.value?.focus(); scrollDown() } }

async function send() {
  const text = input.value.trim()
  if (busy.value || !text) return
  if (text.length < 5) { messages.value.push({ role: 'assistant', text: 'Câu hỏi cần ít nhất 5 ký tự.', error: true }); return }
  messages.value.push({ role: 'user', text })
  input.value = ''
  busy.value = true
  scrollDown()
  try {
    const reply = await $fetch<{ answer: string; sources: Source[] }>('/api/tro-ly', { method: 'POST', body: { message: text } })
    messages.value.push({ role: 'assistant', text: reply.answer, sources: reply.sources })
  } catch (e: any) {
    messages.value.push({ role: 'assistant', text: e?.data?.statusMessage || e?.statusMessage || 'Trợ lý tạm thời chưa trả lời được, vui lòng thử lại.', error: true })
  } finally {
    busy.value = false
    scrollDown()
  }
}
function onKey(e: KeyboardEvent) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }
</script>

<template>
  <div v-if="!hidden" class="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 print:hidden" @keydown.esc="open = false">
    <section v-if="open" role="dialog" aria-label="Trợ lý AI nghiệp vụ"
      class="flex h-[min(560px,calc(100dvh-6rem))] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-[#dbe6f4] bg-white shadow-2xl">
      <header class="flex items-start gap-3 bg-gradient-to-r from-brand-600 to-brand-700 px-4 py-3 text-white">
        <Bot :size="22" class="mt-0.5 shrink-0" />
        <div class="min-w-0 flex-1">
          <h2 class="font-bold">Trợ lý AI nghiệp vụ</h2>
          <p class="text-xs text-blue-100">Chỉ dùng thủ tục xã đang mở và hướng dẫn nghiệp vụ, luôn trích nguồn. Không truy cập hồ sơ hay dữ liệu công dân.</p>
        </div>
        <button class="rounded p-1 hover:bg-white/20" aria-label="Đóng trợ lý" @click="open = false"><X :size="18" /></button>
      </header>
      <div ref="box" class="flex-1 space-y-3 overflow-y-auto bg-[#f7faff] p-3" aria-live="polite">
        <div v-for="(m, i) in messages" :key="i" :class="m.role === 'user' ? 'flex justify-end' : 'flex justify-start'">
          <div :class="['max-w-[88%] rounded-2xl px-3 py-2 text-sm', m.role === 'user' ? 'bg-brand-600 text-white' : m.error ? 'border border-rose-200 bg-rose-50 text-rose-800' : 'border border-[#dbe6f4] bg-white text-slate-900']">
            <p class="whitespace-pre-line">{{ m.text }}</p>
            <ul v-if="m.sources?.length" class="mt-2 space-y-1 border-t border-slate-100 pt-2 text-xs">
              <li v-for="s in m.sources.slice(0, 4)" :key="s.title">
                <NuxtLink v-if="s.url" :to="s.url" class="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline" @click="open = false"><ExternalLink :size="12" />{{ s.title }}</NuxtLink>
                <span v-else class="text-slate-600">Hướng dẫn nghiệp vụ: {{ s.title }}</span>
              </li>
            </ul>
          </div>
        </div>
        <p v-if="busy" class="text-xs text-slate-500">Đang tìm trong thủ tục và hướng dẫn nghiệp vụ... (có thể mất khoảng 10–15 giây)</p>
      </div>
      <form class="flex items-end gap-2 border-t border-slate-100 p-3" @submit.prevent="send">
        <label for="staff-assistant-input" class="sr-only">Câu hỏi về thủ tục hoặc nghiệp vụ</label>
        <textarea id="staff-assistant-input" ref="field" v-model="input" rows="2" maxlength="500" class="field resize-none !py-2" placeholder="Ví dụ: Trả kết quả hồ sơ cần những bước nào?" :disabled="busy" @keydown="onKey" />
        <button type="submit" class="btn-primary !px-3" :disabled="busy || !input.trim()" aria-label="Gửi câu hỏi"><Send :size="17" /></button>
      </form>
    </section>
    <button class="flex items-center gap-2 rounded-full bg-gradient-to-b from-brand-500 to-brand-700 px-4 py-3 font-bold text-white shadow-xl hover:brightness-105 focus:outline-none focus:ring-4 focus:ring-brand-200"
      :aria-expanded="open" aria-label="Hỏi trợ lý AI" @click="toggle">
      <X v-if="open" :size="20" /><MessageCircle v-else :size="20" />
      <span class="hidden sm:inline">{{ open ? 'Đóng' : 'Hỏi trợ lý AI' }}</span>
    </button>
  </div>
</template>
