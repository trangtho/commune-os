<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->
<script setup lang="ts">
import {
  CircleCheck,
  CircleX,
  Cpu,
  Database,
  HardDrive,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  Users,
  Workflow,
} from "lucide-vue-next";
import type { Component } from "vue";

// Kiểm tra từng dịch vụ của lõi qua cổng API, bằng token của quản trị hệ thống.
// Mỗi dịch vụ tự kiểm tra thành phần phía sau (Flowable, kho đối tượng, Keycloak Admin API, mô hình AI).
// Chỉ đọc, không thay đổi dữ liệu.
type State = "ok" | "warn" | "error" | "checking";
interface Check {
  key: string;
  name: string;
  parts: string;
  icon: Component;
  state: State;
  ms: number | null;
  detail: string;
  facts: string[];
}
interface AiStatus {
  ollama: { reachable: boolean; installed: { name: string; sizeMB: number }[]; loaded: string[] };
  models: { chat: { name: string; installed: boolean }; embed: { name: string; installed: boolean } };
  vectors: { chunks?: number; embedded?: number; error?: string } | null;
  usage: { asks: number; modelAnswers: number; averageMs: number | null; lastError: { where: string; message: string; at: string } | null };
  externalApis: boolean;
}

const { token, logout } = useAuth();

const checks = ref<Check[]>([
  { key: "identity", name: "Định danh", parts: "Keycloak", icon: KeyRound },
  { key: "data", name: "Cổng API và dữ liệu", parts: "APISIX, PostgREST, PostgreSQL", icon: Database },
  { key: "workflow", name: "Quy trình", parts: "Dịch vụ điều phối, Flowable", icon: Workflow },
  { key: "files", name: "Lưu trữ tệp", parts: "Dịch vụ tệp, SeaweedFS, ClamAV", icon: HardDrive },
  { key: "accounts", name: "Tài khoản cán bộ", parts: "Dịch vụ tài khoản, Keycloak Admin API", icon: Users },
  { key: "ai", name: "Trí tuệ nhân tạo", parts: "Cổng AI, Ollama, pgvector", icon: Cpu },
  { key: "ledger", name: "Sổ ghi nhận", parts: "Chuỗi băm SHA-256 theo xã", icon: ShieldCheck },
].map((c) => ({ ...c, state: "checking" as State, ms: null, detail: "Đang kiểm tra...", facts: [] })));

const checking = ref(false);
const checkedAt = ref<string | null>(null);
const autoRefresh = ref(true);

const summary = computed(() => {
  const bad = checks.value.filter((c) => c.state === "error").length;
  const warn = checks.value.filter((c) => c.state === "warn").length;
  if (checking.value && !checkedAt.value) return { state: "checking" as State, text: "Đang kiểm tra các dịch vụ..." };
  if (bad) return { state: "error" as State, text: `${bad} dịch vụ không hoạt động` };
  if (warn) return { state: "warn" as State, text: `Hệ thống chạy, ${warn} dịch vụ cần chú ý` };
  return { state: "ok" as State, text: "Tất cả dịch vụ hoạt động bình thường" };
});

function set(key: string, value: Partial<Check>) {
  const c = checks.value.find((x) => x.key === key);
  if (c) Object.assign(c, value);
}

// Gọi một đường dẫn qua cổng; trả về dữ liệu, mã HTTP và thời gian phản hồi.
async function probe<T>(path: string, method: "GET" | "POST" = "GET", body?: object) {
  const started = performance.now();
  try {
    const data = await $fetch<T>(path, { method, body, headers: { Authorization: `Bearer ${token.value}` }, timeout: 15000 });
    return { ok: true, status: 200, data, ms: Math.round(performance.now() - started) };
  } catch (e: any) {
    const status = e?.response?.status ?? 0;
    if (status === 401) await logout();
    return { ok: false, status, data: e?.data as T | undefined, ms: Math.round(performance.now() - started) };
  }
}
const failure = (status: number) =>
  status === 0 ? "Không kết nối được" : status === 502 || status === 503 || status === 504 ? `Không trả lời (HTTP ${status})` : `Lỗi HTTP ${status}`;

async function checkIdentity() {
  const started = performance.now();
  try {
    const r = await $fetch<{ ok: boolean; ms: number; issuer?: string }>("/api/tinh-trang/dinh-danh");
    set("identity", r.ok
      ? { state: "ok", ms: r.ms, detail: "Realm communeos sẵn sàng cấp token", facts: [`Nơi cấp: ${r.issuer}`] }
      : { state: "error", ms: r.ms, detail: "Keycloak không trả lời", facts: [] });
  } catch {
    set("identity", { state: "error", ms: Math.round(performance.now() - started), detail: "Không kiểm tra được Keycloak", facts: [] });
  }
}

async function checkData() {
  const r = await probe<{ code: string; status: string }[]>("/rest/tenants?select=code,status");
  if (!r.ok || !r.data) return set("data", { state: "error", ms: r.ms, detail: failure(r.status), facts: [] });
  const locked = r.data.filter((t) => t.status === "locked").length;
  set("data", { state: "ok", ms: r.ms, detail: "Đọc dữ liệu qua cổng bình thường", facts: [`${r.data.length} xã, ${locked} xã đang khóa`] });
}

async function checkWorkflow() {
  const r = await probe<{ flowable?: { ms: number } }>("/workflow/health");
  set("workflow", r.ok
    ? { state: "ok", ms: r.ms, detail: "Động cơ quy trình sẵn sàng", facts: [`Flowable trả lời sau ${r.data?.flowable?.ms ?? "?"} ms`] }
    : { state: "error", ms: r.ms, detail: r.status === 503 ? "Flowable không trả lời" : failure(r.status), facts: [] });
}

async function checkFiles() {
  const r = await probe<{ storage?: { ok: boolean; ms: number }; antivirus?: { configured: boolean } }>("/files/health");
  const av = r.data?.antivirus?.configured ? "Quét mã độc: đang bật" : "Quét mã độc: chưa bật (tùy chọn)";
  set("files", r.ok
    ? { state: "ok", ms: r.ms, detail: "Kho đối tượng sẵn sàng", facts: [`SeaweedFS trả lời sau ${r.data?.storage?.ms ?? "?"} ms`, av] }
    : { state: "error", ms: r.ms, detail: r.status === 503 ? "Kho đối tượng không trả lời" : failure(r.status), facts: [] });
}

async function checkAccounts() {
  const r = await probe<{ keycloakAdmin?: { ms: number } }>("/accounts/health");
  set("accounts", r.ok
    ? { state: "ok", ms: r.ms, detail: "Quản lý tài khoản cán bộ sẵn sàng", facts: [`Keycloak Admin API trả lời sau ${r.data?.keycloakAdmin?.ms ?? "?"} ms`] }
    : { state: "error", ms: r.ms, detail: r.status === 503 ? "Không vào được Keycloak Admin API" : failure(r.status), facts: [] });
}

async function checkAi() {
  const r = await probe<AiStatus>("/ai/status");
  if (!r.ok || !r.data) return set("ai", { state: "error", ms: r.ms, detail: failure(r.status), facts: [] });
  const s = r.data;
  const facts: string[] = [];
  for (const m of [s.models.chat, s.models.embed]) {
    const loaded = s.ollama.loaded.some((n) => n === m.name || n === `${m.name}:latest`);
    facts.push(`${m.name}: ${m.installed ? (loaded ? "đã tải, đang nạp trong bộ nhớ" : "đã tải") : "CHƯA tải"}`);
  }
  const chunks = s.vectors?.chunks ?? 0;
  const embedded = s.vectors?.embedded ?? 0;
  facts.push(`Chỉ mục ngữ nghĩa: ${embedded}/${chunks} đoạn đã có vector`);
  if (s.usage.asks) facts.push(`${s.usage.asks} câu hỏi, trung bình ${s.usage.averageMs} ms, ${s.usage.modelAnswers} có trích dẫn của mô hình`);
  facts.push(s.externalApis ? "Có gọi API AI bên ngoài" : "Không gọi API AI bên ngoài, mô hình chạy trên máy chủ");
  if (s.usage.lastError) facts.push(`Lỗi gần nhất (${s.usage.lastError.where}): ${s.usage.lastError.message}`);
  const ready = s.ollama.reachable && s.models.chat.installed && s.models.embed.installed;
  set("ai", {
    state: !s.ollama.reachable ? "error" : ready && embedded === chunks ? "ok" : "warn",
    ms: r.ms,
    detail: !s.ollama.reachable ? "Không kết nối được Ollama"
      : !ready ? "Chưa có đủ mô hình: trợ lý đang dùng tìm kiếm toàn văn (chạy make up khi có Internet)"
      : embedded < chunks ? "Đang tạo vector cho chỉ mục tri thức" : "Trợ lý AI sẵn sàng",
    facts,
  });
}

async function checkLedger() {
  const r = await probe<{ tenant_code: string; ok: boolean; entries: number; broken_seq: number | null }[]>("/rest/rpc/verify_ledger", "POST", {});
  if (!r.ok || !r.data) return set("ledger", { state: "error", ms: r.ms, detail: failure(r.status), facts: [] });
  const broken = r.data.filter((x) => !x.ok);
  const entries = r.data.reduce((n, x) => n + x.entries, 0);
  set("ledger", broken.length
    ? { state: "error", ms: r.ms, detail: `Phát hiện sổ bị sửa ở ${broken.length} xã`, facts: broken.map((x) => `${x.tenant_code}: gãy ở dòng ${x.broken_seq}`) }
    : { state: "ok", ms: r.ms, detail: "Nguyên vẹn", facts: [`${entries} dòng của ${r.data.length} xã đã kiểm tra lại chuỗi băm`] });
}

async function checkAll() {
  if (checking.value) return;
  checking.value = true;
  await Promise.all([checkIdentity(), checkData(), checkWorkflow(), checkFiles(), checkAccounts(), checkAi(), checkLedger()]);
  checkedAt.value = new Date().toISOString();
  checking.value = false;
}

let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  checkAll();
  timer = setInterval(() => autoRefresh.value && document.visibilityState === "visible" && checkAll(), 30000);
});
onBeforeUnmount(() => clearInterval(timer));

const tone: Record<State, string> = {
  ok: "border-green-200 bg-green-50 text-green-800",
  warn: "border-amber-200 bg-amber-50 text-amber-800",
  error: "border-red-200 bg-red-50 text-red-800",
  checking: "border-slate-200 bg-slate-50 text-slate-600",
};
const label: Record<State, string> = { ok: "Hoạt động", warn: "Cần chú ý", error: "Không hoạt động", checking: "Đang kiểm tra" };
</script>

<template>
  <section>
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold">Tình trạng hệ thống</h1>
        <p class="mt-2 max-w-2xl text-slate-600">
          Kiểm tra từng dịch vụ của lõi qua cổng API. Mỗi dịch vụ tự kiểm tra thành phần phía sau của nó.
          Trang chỉ đọc, không thay đổi dữ liệu.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <label class="flex items-center gap-2 text-sm text-slate-600">
          <input v-model="autoRefresh" type="checkbox" class="h-4 w-4 accent-blue-700" />
          Tự kiểm tra mỗi 30 giây
        </label>
        <button
          type="button"
          class="inline-flex h-11 items-center gap-2 rounded-md bg-blue-700 px-4 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
          :disabled="checking"
          @click="checkAll"
        >
          <RefreshCw class="h-4 w-4" :class="checking ? 'animate-spin' : ''" aria-hidden="true" />
          {{ checking ? "Đang kiểm tra..." : "Kiểm tra lại" }}
        </button>
      </div>
    </div>

    <div class="mt-6 flex items-center gap-3 rounded-lg border px-4 py-3 font-semibold" :class="tone[summary.state]" role="status" aria-live="polite">
      <CircleCheck v-if="summary.state === 'ok'" class="h-5 w-5" aria-hidden="true" />
      <TriangleAlert v-else-if="summary.state === 'warn'" class="h-5 w-5" aria-hidden="true" />
      <CircleX v-else-if="summary.state === 'error'" class="h-5 w-5" aria-hidden="true" />
      <RefreshCw v-else class="h-5 w-5 animate-spin" aria-hidden="true" />
      {{ summary.text }}
    </div>

    <div class="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <article
        v-for="c in checks"
        :key="c.key"
        class="rounded-lg border bg-white p-4"
        :class="c.state === 'error' ? 'border-red-300' : c.state === 'warn' ? 'border-amber-300' : 'border-slate-200'"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-3">
            <span class="grid h-10 w-10 place-items-center rounded-md bg-slate-100 text-slate-700">
              <component :is="c.icon" class="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 class="font-semibold">{{ c.name }}</h2>
              <p class="text-xs text-slate-500">{{ c.parts }}</p>
            </div>
          </div>
          <span class="shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold" :class="tone[c.state]">
            {{ label[c.state] }}
          </span>
        </div>
        <p class="mt-3 text-sm font-medium text-slate-800">{{ c.detail }}</p>
        <ul v-if="c.facts.length" class="mt-2 space-y-1 text-sm text-slate-600">
          <li v-for="f in c.facts" :key="f">{{ f }}</li>
        </ul>
        <p v-if="c.ms !== null" class="mt-3 text-xs text-slate-500">Phản hồi sau {{ c.ms }} ms</p>
      </article>
    </div>

    <p v-if="checkedAt" class="mt-4 text-sm text-slate-500">Kiểm tra lần cuối lúc {{ formatDateTime(checkedAt) }}.</p>
  </section>
</template>
