<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
// Nút trợ lý AI nổi ở mọi trang của Kênh người dân. Gọi /api/chat: câu trả lời chỉ dựng từ thủ tục đã
// công bố (công dân đã đăng nhập: thủ tục xã mình đang mở), trích nguồn nguyên văn; trợ lý không đọc
// hồ sơ, giấy tờ hay thông tin của bất kỳ ai.
import { Bot, MessageCircle, Send, X, ExternalLink } from 'lucide-vue-next'
import type { SourceCitation } from '~/shared/ai-knowledge'

type Message = { role: 'user' | 'assistant'; text: string; sources?: SourceCitation[]; error?: boolean }
const route = useRoute()
const open = ref(false)
const input = ref('')
const busy = ref(false)
const conversationId = ref<string | null>(null)
const messages = ref<Message[]>([{ role: 'assistant', text: 'Xin chào! Tôi trả lời câu hỏi về thủ tục hành chính đang công bố: giấy tờ cần chuẩn bị, lệ phí, thời hạn, cách nộp.' }])
const box = ref<HTMLElement | null>(null)
const field = ref<HTMLTextAreaElement | null>(null)
const hidden = computed(() => ['/tro-ly', '/dang-nhap'].includes(route.path))
// Đang xem một thủ tục thì hỏi trong ngữ cảnh thủ tục đó.
const procedureId = computed(() => route.path.startsWith('/thu-tuc/') ? String(route.params.slug || '') : '')

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
    const reply = await $fetch<{ answer: string; sources: SourceCitation[]; conversationId: string | null }>('/api/chat', {
      method: 'POST',
      body: { message: text, ...(procedureId.value ? { procedureId: procedureId.value } : {}), ...(conversationId.value ? { conversationId: conversationId.value } : {}) },
    })
    conversationId.value = reply.conversationId
    messages.value.push({ role: 'assistant', text: reply.answer, sources: reply.sources })
  } catch (e: any) {
    messages.value.push({ role: 'assistant', text: e?.data?.statusMessage || e?.statusMessage || 'Trợ lý tạm thời chưa trả lời được, vui lòng thử lại.', error: true })
  } finally {
    busy.value = false
    scrollDown()
  }
}
// Câu hỏi gợi ý hiện khi chưa hỏi gì, bấm là gửi luôn.
const suggestions = ['Làm giấy khai sinh cần giấy tờ gì?', 'Lệ phí chứng thực bản sao bao nhiêu?', 'Đăng ký kết hôn mất bao lâu?']
function ask(q: string) { input.value = q; send() }
function onKey(e: KeyboardEvent) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }
</script>

<template>
  <div v-if="!hidden" class="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 print:hidden" @keydown.esc="open = false">
    <section v-if="open" role="dialog" aria-label="Trợ lý AI thủ tục hành chính"
      class="flex h-[min(560px,calc(100dvh-6rem))] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-[#dbe6f4] bg-white shadow-2xl max-sm:fixed max-sm:inset-0 max-sm:h-[100dvh] max-sm:w-full max-sm:rounded-none max-sm:border-0">
      <header class="flex items-center gap-2 bg-brand-700 px-4 py-3 text-white">
        <Bot :size="20" class="shrink-0" />
        <h2 class="min-w-0 flex-1 font-bold">Trợ lý AI thủ tục</h2>
        <button class="rounded p-1.5 hover:bg-white/20" aria-label="Đóng trợ lý" @click="open = false"><X :size="20" /></button>
      </header>
      <p class="border-b border-slate-100 bg-white px-4 py-2 text-xs text-slate-600">Chỉ dùng thông tin thủ tục công khai, có trích nguồn. Trợ lý không xem hồ sơ của ai.</p>
      <div ref="box" class="flex-1 space-y-3 overflow-y-auto bg-[#f7faff] p-3" aria-live="polite">
        <div v-for="(m, i) in messages" :key="i" :class="m.role === 'user' ? 'flex justify-end' : 'flex justify-start'">
          <div :class="['max-w-[88%] rounded-2xl px-3 py-2 text-sm', m.role === 'user' ? 'bg-brand-600 text-white' : m.error ? 'border border-rose-200 bg-rose-50 text-rose-800' : 'border border-[#dbe6f4] bg-white text-ink']">
            <p class="whitespace-pre-line">{{ m.text }}</p>
            <ul v-if="m.sources?.length" class="mt-2 space-y-1 border-t border-slate-100 pt-2 text-xs">
              <li v-for="s in m.sources.slice(0, 4)" :key="s.id">
                <NuxtLink :to="s.url" class="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline" @click="open = false"><ExternalLink :size="12" />{{ s.title }}</NuxtLink>
              </li>
            </ul>
          </div>
        </div>
        <div v-if="messages.length === 1 && !busy" class="flex flex-wrap gap-2 pt-1">
          <button v-for="q in suggestions" :key="q" type="button" class="rounded-full border border-brand-200 bg-white px-3 py-1.5 text-left text-xs font-semibold text-brand-700 hover:bg-brand-50" @click="ask(q)">{{ q }}</button>
        </div>
        <p v-if="busy" class="text-xs text-muted">Đang tìm trong dữ liệu thủ tục... (có thể mất khoảng 10–15 giây)</p>
      </div>
      <form class="flex items-end gap-2 border-t border-slate-100 p-3" @submit.prevent="send">
        <label for="assistant-widget-input" class="sr-only">Câu hỏi về thủ tục</label>
        <textarea id="assistant-widget-input" ref="field" v-model="input" rows="2" maxlength="500" class="field resize-none !py-2" placeholder="Ví dụ: Làm khai sinh cần giấy tờ gì?" :disabled="busy" @keydown="onKey" />
        <button type="submit" class="btn-primary !px-3" :disabled="busy || !input.trim()" aria-label="Gửi câu hỏi"><Send :size="17" /></button>
      </form>
      <NuxtLink to="/tro-ly" class="border-t border-slate-100 py-2 text-center text-xs font-semibold text-brand-700 hover:bg-brand-50" @click="open = false">Mở trang trợ lý đầy đủ, xem lịch sử hỏi đáp</NuxtLink>
    </section>
    <button :class="open ? 'max-sm:hidden' : ''" class="flex items-center gap-2 rounded-full bg-brand-700 px-4 py-3 font-bold text-white shadow-xl hover:brightness-105 focus:outline-none focus:ring-4 focus:ring-brand-200"
      :aria-expanded="open" aria-label="Hỏi trợ lý AI" @click="toggle">
      <X v-if="open" :size="20" /><MessageCircle v-else :size="20" />
      <span class="hidden sm:inline">{{ open ? 'Đóng' : 'Hỏi trợ lý AI' }}</span>
    </button>
  </div>
</template>
