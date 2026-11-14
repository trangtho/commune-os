<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import {
  ArrowLeft,
  FileText,
  CalendarDays,
  UserRound,
  Download,
  Info,
  MessageCircle,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Save,
  Edit3,
} from "lucide-vue-next";
import type { Application } from "~/types/models";
const id = String(useRoute().params.id);
const {
  data: c,
  error,
  refresh,
} = await useFetch<Application>(`/api/applications/${id}`, {
  key: `staff-application:${id}`,
});
const { date, dateTime, bytes } = useFormat();
const newStatus = ref<ApplicationStatus | null>(null);
const note = ref("");
const message = ref("");
const sending = ref(false);
const notice = ref("");
const busy = ref(false);
const result = ref("");
async function updateStatus() {
  if (!newStatus.value || busy.value) return;
  busy.value = true;
  result.value = "";
  try {
    await $fetch(`/api/applications/${id}/status`, {
      method: "PATCH",
      body: { status: newStatus.value, note: note.value.trim() },
    });
    result.value = "Đã cập nhật trạng thái hồ sơ.";
    await refresh();
    await refreshNuxtData(["staff-applications", `staff-application:${id}`]);
  } catch (e) {
    result.value = readableError(e);
  } finally {
    busy.value = false;
  }
}
async function requestSupplement() {
  if (busy.value) return;
  busy.value = true;
  result.value = "";
  try {
    await $fetch(`/api/applications/${id}/supplement`, {
      method: "POST",
      body: { note: note.value.trim() },
    });
    result.value = "Đã yêu cầu công dân bổ sung giấy tờ.";
    await refresh();
    await refreshNuxtData(["staff-applications", `staff-application:${id}`]);
  } catch (e) {
    result.value = readableError(e);
  } finally {
    busy.value = false;
  }
}
async function sendMessage() {
  sending.value = true;
  notice.value = "";
  try {
    await $fetch("/api/support", {
      method: "POST",
      body: { applicationId: id, message: message.value },
    });
    message.value = "";
    notice.value = "Đã gửi thông báo (bản mô phỏng).";
  } catch (e) {
    notice.value = readableError(e);
  } finally {
    sending.value = false;
  }
}
</script>
<template>
  <div class="space-y-4">
    <NuxtLink
      to="/ho-so"
      class="inline-flex items-center gap-1 text-sm font-semibold text-brand-700"
      ><ArrowLeft :size="16" />Danh sách hồ sơ</NuxtLink
    >
    <div v-if="error" class="panel p-6 text-rose-600">
      Không tìm thấy hồ sơ hoặc không có quyền truy cập.
    </div>
    <template v-else-if="c"
      ><div class="panel p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="text-xs font-semibold text-muted">Mã hồ sơ: {{ c.id }}</p>
            <h2 class="mt-1 text-xl font-black">{{ c.procedure_title }}</h2>
            <p class="mt-1 text-sm text-muted">
              {{ c.category }} · Người nộp: {{ c.applicant_name }}
            </p>
          </div>
          <StatusPill :status="c.status" />
        </div>
        <div class="mt-4 grid gap-3 border-t pt-4 text-sm sm:grid-cols-4">
          <div>
            <span class="text-xs text-muted">Ngày tiếp nhận</span>
            <p class="font-bold">
              {{ c.status === "draft" ? "Chưa nộp" : dateTime(c.submitted_at) }}
            </p>
          </div>
          <div>
            <span class="text-xs text-muted">Hạn xử lý (dự kiến)</span>
            <p class="font-bold">
              {{ c.status === "draft" ? "Chưa tính" : date(c.due_at) }}
            </p>
          </div>
          <div>
            <span class="text-xs text-muted">Số điện thoại</span>
            <p class="font-bold">{{ c.applicant_phone || "—" }}</p>
          </div>
          <div>
            <span class="text-xs text-muted">Cập nhật lần cuối</span>
            <p class="font-bold text-xs">{{ dateTime(c.updated_at) }}</p>
          </div>
        </div>
      </div>
      <section class="panel p-5">
        <h3 class="section-label">Tiến độ xử lý hồ sơ</h3>
        <CaseTimeline :status="c.status" />
        <div class="mt-4 border-t border-slate-100 pt-3">
          <div
            v-for="e in c.events"
            :key="e.id"
            class="flex gap-3 border-b border-slate-100 py-3 last:border-b-0"
          >
            <span class="mt-1 h-3 w-3 shrink-0 rounded-full bg-blue-500" />
            <div>
              <p class="text-sm font-bold">{{ e.note }}</p>
              <p class="mt-1 text-xs text-muted">
                {{ dateTime(e.created_at) }} · {{ e.actor_name }}
              </p>
            </div>
          </div>
        </div>
      </section>
      <div class="grid min-w-0 gap-4 lg:grid-cols-2">
        <section class="panel p-4">
          <h3 class="section-label">
            <FileText :size="20" class="text-blue-600" />Giấy tờ đã nộp ({{
              c.documents?.length || 0
            }})
          </h3>
          <div v-if="!c.documents?.length" class="p-3 text-sm text-muted">
            Chưa có tệp đính kèm.
          </div>
          <div
            v-for="d in c.documents"
            :key="d.id"
            class="flex min-w-0 items-center justify-between gap-2 border-b py-3 last:border-0"
          >
            <span class="min-w-0 text-sm"
              ><b class="block truncate">{{ d.original_name }}</b
              ><small class="text-muted"
                >{{ bytes(d.size_bytes) }} ·
                {{ dateTime(d.uploaded_at) }}</small
              ></span
            ><a
              :href="`/api/documents/${d.id}`"
              class="btn-outline !p-2"
              aria-label="Tải tài liệu"
              ><Download :size="16"
            /></a>
          </div>
        </section>
        <section class="panel p-4">
          <h3 class="section-label">
            <Edit3 :size="20" class="text-brand-600" />Cập nhật trạng thái & xử
            lý
          </h3>
          <div class="space-y-3">
            <div>
              <label class="field-label">Trạng thái mới</label
              ><select v-model="newStatus" class="field">
                <option value="">Giữ nguyên</option>
                <option value="processing">Đang xử lý</option>
                <option value="completed">Hoàn thành</option>
                <option value="rejected">Từ chối</option>
                <option value="supplement">Yêu cầu bổ sung</option>
              </select>
            </div>
            <div>
              <label class="field-label">Ghi chú xử lý (tùy chọn)</label
              ><textarea
                v-model="note"
                class="field"
                rows="3"
                placeholder="Lý do duyệt/từ chối / yêu cầu bổ sung..."
              />
            </div>
            <p
              v-if="result"
              class="rounded-lg bg-brand-50 p-3 text-sm text-brand-800"
            >
              {{ result }}
            </p>
            <div class="flex flex-wrap gap-3">
              <button
                class="btn-primary"
                :disabled="busy || !newStatus"
                @click="updateStatus"
              >
                <Save :size="16" />{{
                  busy ? "Đang cập nhật..." : "Cập nhật trạng thái"
                }}</button
              ><button
                v-if="c.status !== 'supplement'"
                class="btn-outline"
                :disabled="busy"
                @click="requestSupplement"
              >
                <AlertCircle :size="16" />Yêu cầu bổ sung
              </button>
            </div>
          </div>
        </section>
      </div>
      <div class="grid min-w-0 gap-4 lg:grid-cols-2">
        <section class="panel p-4">
          <h3 class="section-label">
            <MessageCircle :size="20" class="text-brand-600" />Gửi thông báo cho
            công dân
          </h3>
          <form class="space-y-3" @submit.prevent="sendMessage">
            <textarea
              v-model="message"
              class="field"
              rows="4"
              maxlength="2000"
              minlength="5"
              required
              placeholder="Nhập nội dung thông báo..."
            />
            <p v-if="notice" class="text-xs text-brand-700">{{ notice }}</p>
            <button
              class="btn-primary"
              :disabled="sending || message.trim().length < 5"
              type="submit"
            >
              Gửi thông báo <ArrowRight :size="15" />
            </button>
          </form>
        </section>
      </div>
      <div class="flex flex-wrap gap-3">
        <NuxtLink
          v-if="c.status === 'completed'"
          :to="`/ho-so/${c.id}/ket-qua`"
          class="btn-primary"
          >Xem kết quả <ArrowRight :size="16" /></NuxtLink
        ><NuxtLink
          v-if="c.status === 'supplement'"
          :to="`/ho-so/${c.id}/bo-sung`"
          class="btn-outline"
          >Xem yêu cầu bổ sung <ArrowRight :size="16"
        /></NuxtLink></div
    ></template>
  </div>
</template>
