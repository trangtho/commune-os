<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import {Bot, Send, UserRound, BookOpen, AlertCircle, Sparkles, ShieldCheck, Clock3, FileText, Wallet, ListChecks, Search, Copy, Check, RotateCcw, ArrowRight, Database, RefreshCw, MessageCircleQuestion, History} from 'lucide-vue-next'
import type { Procedure } from '~/types/models'
import type { SourceCitation, ProcedureSuggestion, GroundedAnswer } from '~/shared/ai-knowledge'
import type { CitizenChatThread, CitizenChatThreadPage, CitizenChatThreadDetail, CitizenChatStoredMessage } from '~/shared/chat-history'

interface ChatMessage {
  id: number; who: 'assistant' | 'citizen'; content: string;
  mode?: GroundedAnswer['mode']; sources?: SourceCitation[];
  suggestions?: ProcedureSuggestion[]; notice?: string; revision?: string; isGreeting?: boolean
}
const route = useRoute()
const {data: procedures, error: proceduresError, refresh: refreshProcedures} = await useFetch<Procedure[]>('/api/procedures', {key: 'citizen-procedures', default: () => []})
const {data: knowledgeStatus, refresh: refreshKnowledge} = await useFetch<{ready:boolean;chunks:number;procedures:number;faqs:number;aiConfigured:boolean;lastIndexedAt:string|null}>('/api/chat/knowledge', {key: 'citizen-knowledge-status'})
const {data: authState} = await useFetch<{authenticated:boolean}>('/api/auth/me', {key: 'citizen-ai-chat-auth'})
const procedureId = ref(typeof route.query.procedure === 'string' ? route.query.procedure : '')
const prompt = ref(typeof route.query.q === 'string' ? route.query.q.slice(0, 2000) : '')
const busy = ref(false)
const errorText = ref('')
const copiedId = ref<number | null>(null)
const scroller = ref<HTMLElement | null>(null)
const knowledgeRevision = useState<number>('citizen-knowledge-revision', () => 0)
const needsReview = ref(false)
let sequence = 1
const greeting = 'Xin chào! Tôi hỗ trợ tra cứu thủ tục hành chính đang công bố trong CommuneOS. Bạn có thể hỏi về giấy tờ, lệ phí, thời hạn hoặc cách thực hiện. Tôi chỉ trả lời khi tìm được thông tin trong dữ liệu hệ thống và luôn dẫn đến thủ tục liên quan.'
const history = ref<ChatMessage[]>([{id: sequence++, who: 'assistant', content: greeting, isGreeting: true}])
// Conversation history lives in PostgreSQL and is scoped by citizen + tenant RLS.
// A guest can still ask public-procedure questions but does not persist messages.
const activeConversationId = ref<string | null>(null)
const storedThreads = ref<CitizenChatThread[]>([])
const threadTotal = ref(0)
const threadPage = ref(0)
const loadingHistory = ref(false)
let pendingHistoryRefresh = false
const historyError = ref('')
const selectingThread = ref(false)
const showingMobileHistory = ref(false)
const loadingOlder = ref(false)
const nextBefore = ref<string | null>(null)
const isAuthenticated = computed(() => !!authState.value?.authenticated)

async function fetchThreads(nextPage = 1) {
  if (!isAuthenticated.value) return
  if (loadingHistory.value) { if (nextPage === 1) pendingHistoryRefresh = true; return }
  loadingHistory.value = true
  historyError.value = ''
  try {
    const response = await $fetch<CitizenChatThreadPage>('/api/chat/conversations', {query: {page: nextPage}})
    storedThreads.value = nextPage === 1 ? response.items : [...storedThreads.value, ...response.items.filter(item => !storedThreads.value.some(old => old.id === item.id))]
    threadPage.value = nextPage
    threadTotal.value = response.total
  } catch (error) {
    historyError.value = `Chưa thể tải lịch sử. ${readableError(error)}`
  } finally {
    loadingHistory.value = false
    if (pendingHistoryRefresh) { pendingHistoryRefresh = false; void fetchThreads() }
  }
}
onMounted(() => { if (isAuthenticated.value) void fetchThreads() })
function toChatMessage(row: CitizenChatStoredMessage): ChatMessage {
  return {
    id: sequence++, who: row.role, content: row.content,
    mode: row.mode || undefined, sources: row.sources || [], suggestions: row.suggestions || [],
    notice: row.notice || undefined, revision: row.revision || undefined
  }
}
async function openThread(id: string) {
  if (busy.value || selectingThread.value) return
  selectingThread.value = true
  historyError.value = ''
  try {
    const data = await $fetch<CitizenChatThreadDetail>(`/api/chat/conversations/${id}`)
    activeConversationId.value = data.conversation.id
    history.value = [{id: sequence++, who: 'assistant', content: greeting, isGreeting: true}, ...data.messages.map(toChatMessage)]
    nextBefore.value = data.nextBefore
    procedureId.value = ''
    prompt.value = ''
    errorText.value = ''
    needsReview.value = false
    showingMobileHistory.value = false
  } catch (error) { historyError.value = `Không thể mở cuộc trò chuyện. ${readableError(error)}` }
  finally { selectingThread.value = false }
}
async function fetchOlder() {
  const id = activeConversationId.value
  const before = nextBefore.value
  if (!id || !before || loadingOlder.value || busy.value) return
  loadingOlder.value = true
  try {
    const data = await $fetch<CitizenChatThreadDetail>(`/api/chat/conversations/${id}`, {query: {before}})
    history.value = [history.value[0]!, ...data.messages.map(toChatMessage), ...history.value.slice(1)]
    nextBefore.value = data.nextBefore
  } catch (error) { historyError.value = `Không thể tải các tin nhắn cũ. ${readableError(error)}` }
  finally { await nextTick(); loadingOlder.value = false }
}
async function removeThread(id: string) {
  if (busy.value || loadingHistory.value || selectingThread.value || !import.meta.client) return
  if (!window.confirm('Xóa toàn bộ câu hỏi và câu trả lời trong cuộc trò chuyện này? Không thể hoàn tác.')) return
  loadingHistory.value = true
  historyError.value = ''
  try {
    await $fetch(`/api/chat/conversations/${id}`, {method: 'DELETE'})
    storedThreads.value = storedThreads.value.filter(item => item.id !== id)
    threadTotal.value = Math.max(0, threadTotal.value - 1)
    if (activeConversationId.value === id) clearChat()
  } catch (error) { historyError.value = `Không thể xóa hội thoại. ${readableError(error)}` }
  finally { loadingHistory.value = false }
  // Refresh the page of summaries after deletion (also fills empty slots).
  void fetchThreads()
}

const selectedProcedure = computed(() => procedures.value?.find(p => p.id === procedureId.value))
const suggestedQuestions = computed(() => selectedProcedure.value ? [
  `Thủ tục ${selectedProcedure.value.title} cần giấy tờ gì?`,
  `Lệ phí ${selectedProcedure.value.title} là bao nhiêu?`,
  `Giải quyết ${selectedProcedure.value.title} mất bao lâu?`,
  `Các bước thực hiện ${selectedProcedure.value.title}?`
] : [
  'Hệ thống có những thủ tục nào?',
  'Đăng ký khai sinh cần chuẩn bị giấy tờ gì?',
  'Lệ phí đăng ký hộ kinh doanh là bao nhiêu?',
  'Đăng ký kết hôn mất bao lâu?'
])
const waiting = computed(() => history.value.filter(m => m.who === 'citizen').length)
const answerSourceLabel = (mode: ChatMessage['mode']) => mode === 'RAG' ? 'AI chọn nguồn · Trả lời đã đối chiếu dữ liệu' : mode === 'DATA' ? 'Trích xuất trực tiếp từ dữ liệu hệ thống' : mode === 'INSUFFICIENT' ? 'Chưa đủ dữ liệu' : ''
watch(knowledgeRevision, (next, old) => { if (next > old) { void refreshKnowledge(); if (waiting.value > 0) needsReview.value = true } })
watch(() => route.query.procedure, id => {
  if (typeof id === 'string' && id !== procedureId.value) procedureId.value = id
})
watch(() => history.value.length, async () => {
  await nextTick()
  if (loadingOlder.value) return
  scroller.value?.scrollTo({top: scroller.value.scrollHeight, behavior: 'smooth'})
})
function clearChat() {
  activeConversationId.value = null
  nextBefore.value = null
  showingMobileHistory.value = false
  history.value = [{id: sequence++, who: 'assistant', content: greeting, isGreeting: true}]
  procedureId.value = ''
  prompt.value = ''
  errorText.value = ''
  needsReview.value = false
}
function selectProcedure(id: string) {
  procedureId.value = id
  errorText.value = ''
}
async function send(question = prompt.value) {
  const text = question.trim()
  if (busy.value || selectingThread.value || loadingOlder.value) return
  if (text.length < 5 || text.length > 2000) {
    errorText.value = 'Câu hỏi phải có từ 5 đến 2.000 ký tự.'
    return
  }
  const contextId = selectedProcedure.value?.id || ''
  errorText.value = ''
  needsReview.value = false
  history.value.push({id: sequence++, who: 'citizen', content: text})
  prompt.value = ''
  busy.value = true
  try {
    const reply = await $fetch<GroundedAnswer & {revision: string; conversationId: string | null; saved: boolean}>('/api/chat', {
      method: 'POST', body: {message: text, ...(contextId ? {procedureId: contextId} : {}),
        ...(activeConversationId.value ? {conversationId: activeConversationId.value} : {})}
    })
    if (reply.conversationId) {
      activeConversationId.value = reply.conversationId
      void fetchThreads()
    }
    history.value.push({
      id: sequence++, who: 'assistant', content: reply.answer, mode: reply.mode,
      sources: reply.sources, suggestions: reply.suggestions, notice: reply.notice,
      revision: reply.revision
    })
    if (!contextId && reply.mode !== 'INSUFFICIENT' && reply.sources?.length === 1) {
      const id = reply.sources[0]?.id?.replace(/^procedure:/, '')
      if (id && procedures.value?.some(p => p.id === id)) procedureId.value = id
    }
  } catch (error) {
    const message = readableError(error)
    history.value.push({id: sequence++, who: 'assistant', content: `Hiện chưa thể hoàn thành câu hỏi hoặc lưu lịch sử. ${message} Tôi không đưa ra câu trả lời khi không thể kiểm chứng nguồn.`, mode: 'INSUFFICIENT'})
  } finally {
    busy.value = false
  }
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    void send()
  }
}
async function copyAnswer(message: ChatMessage) {
  if (!import.meta.client || !navigator.clipboard) return
  const links = (message.sources || []).map(s => `${s.title}: ${window.location.origin}${s.url}`).join('\n')
  try { await navigator.clipboard.writeText(`${message.content}${links ? `\n\nNguồn dữ liệu:\n${links}` : ''}`); copiedId.value = message.id }
  catch { errorText.value = 'Không thể sao chép vào clipboard. Bạn có thể chọn văn bản để sao chép thủ công.' }
}
</script>

<template>
  <div class="space-y-4 pb-1">
    <section class="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#083b86] via-[#085eb3] to-[#137bc1] px-4 py-5 text-white sm:px-6 sm:py-6">
      <div class="pointer-events-none absolute -right-6 -top-12 h-44 w-44 rounded-full border-[28px] border-white/10 sm:h-56 sm:w-56" aria-hidden="true"/>
      <div class="relative flex flex-wrap items-start justify-between gap-3">
        <div class="flex items-start gap-3"><span class="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/30 bg-white/15"><Sparkles :size="25"/></span>
          <div><div class="mb-1 flex items-center gap-2"><span class="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">CommuneOS AI Assistant</span></div>
          <h2 class="text-xl font-black sm:text-2xl">Trợ lý thủ tục hành chính</h2>
          <p class="mt-1 max-w-[660px] text-xs leading-6 text-blue-50 sm:text-sm">Tra cứu từ dữ liệu thủ tục đang công bố. Không tìm thấy nguồn thì không đưa ra câu trả lời phỏng đoán.</p></div>
        </div>
        <div class="flex flex-wrap items-center gap-2"><span class="flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-3 py-1.5 text-xs font-semibold"><Database :size="15"/> {{procedures?.length || 0}} thủ tục đang công bố</span><span v-if="knowledgeStatus?.ready" class="flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-3 py-1.5 text-xs font-semibold"><ShieldCheck :size="15"/> {{knowledgeStatus.chunks}} đoạn tri thức · {{knowledgeStatus.aiConfigured ? "Đã cấu hình AI" : "Tra cứu nguồn"}}</span></div>
      </div>
    </section>

    <div class="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_250px] 2xl:grid-cols-[minmax(0,1fr)_285px]">
      <section class="panel flex min-w-0 flex-col overflow-hidden" aria-label="Hội thoại trợ lý thủ tục hành chính">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-3 sm:px-4">
          <div class="flex items-center gap-2"><span class="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-700"><Bot :size="20"/></span>
            <div><p class="text-sm font-black">Hỏi đáp thủ tục</p><p class="flex items-center gap-1 text-[11px] text-slate-500"><ShieldCheck :size="13"/> Dữ liệu được truy xuất tại thời điểm hỏi</p></div>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" class="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-semibold text-brand-700 lg:hidden" :aria-expanded="showingMobileHistory" aria-controls="ai-mobile-history" @click="showingMobileHistory = !showingMobileHistory"><History :size="15"/> Lịch sử</button>
            <button type="button" class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50" :disabled="busy || selectingThread" @click="clearChat"><RotateCcw :size="14"/> Cuộc trò chuyện mới</button>
          </div>
        </div>

        <div v-if="showingMobileHistory" id="ai-mobile-history" class="border-b border-slate-100 p-3 lg:hidden">
          <ChatHistoryPanel :items="storedThreads" :active-id="activeConversationId" :authenticated="isAuthenticated" :loading="loadingHistory" :error="historyError" :total="threadTotal" @open="openThread" @remove="removeThread" @more="fetchThreads(threadPage + 1)" @retry="fetchThreads()"/>
        </div>
        <p v-if="!isAuthenticated" class="border-b border-blue-100 bg-blue-50 px-4 py-2 text-xs text-slate-700">Bạn đang hỏi với tư cách khách. <NuxtLink to="/dang-nhap?next=%2Ftro-ly" class="font-semibold text-brand-700 underline">Đăng nhập</NuxtLink> để lưu và xem lại lịch sử hội thoại.</p>
        <p v-else-if="activeConversationId" class="border-b border-blue-100 bg-blue-50 px-4 py-2 text-[11px] text-slate-600">Hội thoại được lưu riêng trong tài khoản của bạn. Câu trả lời cũ có thể không còn khớp nếu dữ liệu thủ tục thay đổi.</p>

        <div v-if="knowledgeStatus && !knowledgeStatus.ready" class="mx-3 mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900" role="status">Chỉ mục tri thức chưa được khởi tạo. Trợ lý vẫn tra cứu trực tiếp dữ liệu, nhưng cần chạy <code>make repair-db</code> để bật tìm kiếm RAG và đồng bộ tự động.</div>
        <div v-if="proceduresError" class="mx-3 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-800" role="alert"><span>Không thể tải danh mục thủ tục. Các câu hỏi sẽ không được trả lời khi nguồn dữ liệu không sẵn sàng.</span><button class="font-bold underline" @click="refreshProcedures()"><RefreshCw :size="14" class="inline"/> Thử lại</button></div>
        <div v-if="needsReview" class="mx-3 mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900" role="status"><RefreshCw :size="16" class="shrink-0"/> Dữ liệu thủ tục vừa được cập nhật. Những câu trả lời trước có thể đã cũ; hãy hỏi lại để nhận dữ liệu mới nhất.</div>

        <div ref="scroller" class="citizen-inner-scroll min-h-[320px] max-h-[min(58svh,650px)] space-y-5 overflow-y-auto bg-[#fbfdff] p-3 sm:min-h-[380px] sm:p-5" role="log" aria-live="polite" aria-relevant="additions text" aria-label="Nội dung hội thoại">
          <div v-if="activeConversationId && nextBefore" class="flex justify-center"><button type="button" class="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-blue-50" :disabled="loadingOlder || busy" @click="fetchOlder">{{loadingOlder ? 'Đang tải...' : 'Tải tin nhắn cũ hơn'}}</button></div>
          <article v-for="message in history" :key="message.id" :class="['flex min-w-0 items-start gap-2.5',message.who === 'citizen' ? 'flex-row-reverse' : '']">
            <div :class="['grid h-9 w-9 shrink-0 place-items-center rounded-xl',message.who === 'citizen' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700']"><UserRound v-if="message.who === 'citizen'" :size="19"/><Bot v-else :size="20"/></div>
            <div :class="['min-w-0 max-w-[calc(100%-3rem)] space-y-2 sm:max-w-[88%]',message.who === 'citizen' ? 'text-right' : '']">
              <div :class="['inline-block max-w-full rounded-2xl px-3 py-3 text-left text-sm leading-7 shadow-sm sm:px-4', message.who === 'citizen' ? 'rounded-tr-sm bg-[#e7f6ed] text-emerald-950' : 'rounded-tl-sm border border-[#e2eaf5] bg-white text-slate-800']">
                <p class="whitespace-pre-line break-words">{{message.content}}</p>
                <div v-if="message.mode" class="mt-3 border-t border-slate-100 pt-2"><span :class="['inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold', message.mode === 'RAG' ? 'bg-emerald-50 text-emerald-800' : message.mode === 'DATA' ? 'bg-blue-50 text-blue-800' : 'bg-amber-50 text-amber-800']"><ShieldCheck v-if="message.mode !== 'INSUFFICIENT'" :size="13"/><AlertCircle v-else :size="13"/> {{answerSourceLabel(message.mode)}}</span></div>
                <div v-if="message.sources?.length" class="mt-3 space-y-2 border-t border-slate-100 pt-3"><p class="flex items-center gap-1 text-xs font-bold text-slate-700"><BookOpen :size="14"/> Nguồn trích dẫn trong hệ thống ({{message.sources.length}})</p>
                  <NuxtLink v-for="source in message.sources.slice(0,6)" :key="source.id" :to="source.url" class="block rounded-lg border border-blue-100 bg-blue-50/50 p-2 text-xs text-brand-800 hover:bg-blue-100"><span class="flex items-center gap-1 font-bold"><FileText :size="13"/>{{source.title}}<ArrowRight class="ml-auto shrink-0" :size="13"/></span><small v-if="source.excerpt" class="mt-1 block break-words text-slate-600">{{source.excerpt}}</small></NuxtLink>
                  <p v-if="message.sources.length>6" class="text-[11px] text-slate-500">Hiển thị 6 nguồn đầu tiên. Bạn có thể xem toàn bộ danh mục thủ tục.</p>
                </div>
                <div v-if="message.suggestions?.length" class="mt-3 border-t border-slate-100 pt-3"><p class="mb-2 text-xs font-bold text-slate-600">Thủ tục liên quan</p><div class="flex flex-wrap gap-2"><button v-for="item in message.suggestions" :key="item.id" class="rounded-full border border-blue-200 bg-white px-2.5 py-1 text-left text-xs font-bold text-brand-700 hover:bg-blue-50" @click="selectProcedure(item.id)">{{item.title}}</button></div></div>
                <p v-if="message.notice" class="mt-3 text-[11px] leading-5 text-slate-500">{{message.notice}}</p>
              </div>
              <div v-if="message.who === 'assistant' && !message.isGreeting" class="flex items-center gap-2"><button class="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand-800" :aria-label="`Sao chép câu trả lời ${message.id}`" @click="copyAnswer(message)"><Check v-if="copiedId===message.id" :size="14"/><Copy v-else :size="14"/> {{copiedId===message.id?'Đã sao chép':'Sao chép'}}</button><span v-if="message.revision" class="text-[10px] text-slate-400">Nguồn #{{message.revision.slice(0,8)}}</span></div>
            </div>
          </article>
          <div v-if="busy" class="flex items-center gap-2 text-sm text-slate-500" role="status"><span class="grid h-9 w-9 place-items-center rounded-xl bg-blue-100 text-brand-700"><Bot :size="18"/></span><span class="animate-pulse">Đang tra cứu dữ liệu thủ tục và đối chiếu nguồn...</span></div>
        </div>
        <div class="border-t border-slate-100 bg-white p-3 sm:p-4">
          <div class="mb-3"><label for="ai-procedure" class="mb-1 block text-xs font-bold text-slate-700">Thủ tục đang hỏi <span class="font-normal text-slate-500">(không bắt buộc)</span></label>
            <select id="ai-procedure" v-model="procedureId" class="field w-full !py-2 text-xs sm:text-sm" :disabled="busy"><option value="">Tự xác định từ câu hỏi</option><option v-for="p in procedures" :key="p.id" :value="p.id">{{p.title}}</option></select></div>
          <div class="scrollbar-hide mb-3 flex gap-2 overflow-x-auto pb-1" aria-label="Câu hỏi gợi ý"><button v-for="sample in suggestedQuestions" :key="sample" type="button" :disabled="busy" class="shrink-0 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-left text-xs font-semibold text-brand-700 hover:bg-blue-100" @click="send(sample)">{{sample}}</button></div>
          <form class="flex items-end gap-2" @submit.prevent="send()"><label for="ai-question" class="sr-only">Nhập câu hỏi về thủ tục hành chính</label><textarea id="ai-question" v-model="prompt" class="field max-h-36 min-h-[48px] flex-1 resize-y !py-3" rows="1" minlength="5" maxlength="2000" placeholder="Ví dụ: Đăng ký khai sinh cần giấy tờ gì?" :disabled="busy" aria-describedby="ai-hint ai-error" @keydown="onKeydown"/><button type="submit" class="btn-primary h-[48px] shrink-0 !px-3 sm:!px-4" :disabled="busy || prompt.trim().length<5 || prompt.length>2000"><Send :size="17"/><span class="hidden sm:inline">Gửi</span></button></form>
          <div class="mt-2 flex flex-wrap items-start justify-between gap-x-3 gap-y-1 text-[11px] text-slate-500"><span id="ai-hint">Enter để gửi · Shift+Enter xuống dòng · Không nhập CCCD, mật khẩu hay hồ sơ cá nhân.</span><span>{{prompt.length}} / 2.000</span></div>
          <p v-if="errorText" id="ai-error" class="mt-2 text-xs font-semibold text-rose-700" role="alert">{{errorText}}</p><span v-else id="ai-error" class="sr-only">Không có lỗi nhập liệu</span>
        </div>
      </section>

      <aside class="space-y-3" aria-label="Lịch sử và hướng dẫn trợ lý AI">
        <ChatHistoryPanel class="hidden lg:block" :items="storedThreads" :active-id="activeConversationId" :authenticated="isAuthenticated" :loading="loadingHistory" :error="historyError" :total="threadTotal" @open="openThread" @remove="removeThread" @more="fetchThreads(threadPage + 1)" @retry="fetchThreads()"/>
        <section class="panel p-4"><h3 class="mb-3 flex items-center gap-2 text-sm font-black text-slate-900"><MessageCircleQuestion :size="18" class="text-brand-700"/> Trợ lý có thể giúp gì?</h3>
          <ul class="space-y-3 text-xs text-slate-700">
            <li class="flex items-start gap-2"><FileText :size="16" class="shrink-0 text-brand-700"/> Giấy tờ bắt buộc theo dữ liệu thủ tục</li>
            <li class="flex items-start gap-2"><Wallet :size="16" class="shrink-0 text-brand-700"/> Lệ phí, chi phí đang được công bố</li>
            <li class="flex items-start gap-2"><Clock3 :size="16" class="shrink-0 text-brand-700"/> Thời hạn giải quyết tham khảo</li>
            <li class="flex items-start gap-2"><ListChecks :size="16" class="shrink-0 text-brand-700"/> Nội dung và cách thực hiện thủ tục</li>
            <li class="flex items-start gap-2"><Search :size="16" class="shrink-0 text-brand-700"/> Tìm đúng thủ tục và truy cập trang chi tiết</li>
          </ul>
          <NuxtLink to="/thu-tuc" class="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs font-bold text-brand-700">Xem danh mục thủ tục <ArrowRight :size="15"/></NuxtLink>
        </section>
        <section class="rounded-2xl border border-blue-200 bg-blue-50 p-4"><div class="flex items-start gap-2"><ShieldCheck :size="19" class="shrink-0 text-blue-700"/><div><h3 class="text-sm font-bold text-blue-900">Chỉ trả lời trong phạm vi CommuneOS</h3><p class="mt-2 text-xs leading-6 text-blue-900">Trợ lý truy xuất thông tin <b>đang công bố</b> từ PostgreSQL. Chỉ mục tìm kiếm được đồng bộ tự động trong cùng giao dịch khi thủ tục, giấy tờ hoặc FAQ thay đổi. Hội thoại của tài khoản đăng nhập được lưu ở khu vực riêng, tách biệt với kho tri thức công khai; bạn có thể xóa cuộc trò chuyện bất cứ lúc nào.</p><p class="mt-2 text-xs leading-6 text-blue-900">Nếu câu hỏi thiếu căn cứ hoặc cơ quan tiếp nhận chưa được lưu, hệ thống sẽ thông báo giới hạn thay vì tự suy đoán.</p></div></div></section>
        <section class="rounded-2xl border border-amber-200 bg-amber-50 p-4"><h3 class="flex items-center gap-2 text-sm font-bold text-amber-900"><AlertCircle :size="18"/> Lưu ý</h3><p class="mt-2 text-xs leading-6 text-amber-900">Danh mục đang là dữ liệu minh họa phục vụ phát triển. Đây không phải ý kiến pháp lý hoặc xác nhận của cơ quan nhà nước. Khi cấu hình mô hình AI, câu trả lời chỉ sử dụng các đoạn trích được đối chiếu nguyên văn với kho tri thức. Khi chưa cấu hình, trợ lý vẫn tra cứu trực tiếp dữ liệu có dẫn nguồn.</p><NuxtLink to="/lien-he" class="mt-3 inline-flex items-center gap-1 text-xs font-bold text-amber-900 underline">Liên hệ hỗ trợ <ArrowRight :size="13"/></NuxtLink></section>
      </aside>
    </div>
  </div>
</template>
