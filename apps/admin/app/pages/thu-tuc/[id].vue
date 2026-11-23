<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->
<script setup lang="ts">
import { ArrowLeft, Search } from "lucide-vue-next";
import type { ProcedureDocument, Tenant } from "~/types";

// Chi tiết một thủ tục: giấy tờ cần nộp và các xã đang mở thủ tục.
const id = String(useRoute().params.id);
const { procedures, tenants, loadError, load, setForProcedure, documents } = useProcedures();

const docs = ref<ProcedureDocument[]>([]);
const message = ref<string | null>(null);
const busy = ref(false);
const query = ref("");

onMounted(async () => {
  await load();
  try {
    docs.value = await documents(id);
  } catch (e) {
    message.value = (e as Error).message;
  }
});

const procedure = computed(() => procedures.value.find((p) => p.id === id));
const isOpen = (t: Tenant) => procedure.value?.enabled_tenants.includes(t.code) ?? false;
const visible = computed(() => {
  const q = query.value.trim().toLowerCase();
  return tenants.value.filter((t) => !q || t.code.includes(q) || t.name.toLowerCase().includes(q));
});

async function setTenants(list: Tenant[], enabled: boolean) {
  const codes = list.filter((t) => isOpen(t) !== enabled).map((t) => t.code);
  if (codes.length === 0) return;
  busy.value = true;
  message.value = await setForProcedure(id, codes, enabled);
  busy.value = false;
}
</script>

<template>
  <section>
    <NuxtLink to="/thu-tuc" class="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
      <ArrowLeft class="h-4 w-4" aria-hidden="true" /> Danh mục thủ tục
    </NuxtLink>

    <p v-if="!procedure && procedures.length" class="mt-6 rounded-md bg-red-50 px-3 py-2 text-red-700">
      Không tìm thấy thủ tục "{{ id }}".
    </p>

    <template v-if="procedure">
      <h1 class="mt-3 text-2xl font-bold">{{ procedure.title }}</h1>
      <p class="mt-1 text-slate-600">
        <code>{{ procedure.id }}</code> · {{ procedure.category }} · phiên bản {{ procedure.version }} ·
        hạn xử lý {{ procedure.sla_days }} ngày
      </p>
      <p class="mt-2 max-w-3xl text-slate-700">{{ procedure.summary }}</p>

      <p v-if="message || loadError" role="alert" class="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
        {{ message || loadError }}
      </p>

      <div class="mt-6 grid gap-6 lg:grid-cols-2">
        <div class="rounded-lg border border-slate-200 bg-white p-5">
          <h2 class="text-lg font-semibold">Giấy tờ cần nộp</h2>
          <p v-if="docs.length === 0" class="mt-2 text-sm text-slate-500">Chưa khai báo giấy tờ.</p>
          <ul v-else class="mt-2 space-y-2 text-sm">
            <li v-for="d in docs" :key="d.document_code" class="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 last:border-0">
              <span>{{ d.document_name }}</span>
              <span class="shrink-0 text-xs" :class="d.is_required ? 'font-semibold text-slate-800' : 'text-slate-500'">
                {{ d.is_required ? "Bắt buộc" : "Không bắt buộc" }}
              </span>
            </li>
          </ul>
        </div>

        <div class="rounded-lg border border-slate-200 bg-white p-5">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="text-lg font-semibold">
              Xã đang mở ({{ procedure.enabled_tenants.length }}/{{ tenants.length }})
            </h2>
            <div class="flex gap-2">
              <button type="button" :disabled="busy" class="h-9 rounded-md border border-slate-300 px-3 text-sm font-semibold hover:bg-slate-100 disabled:opacity-50" @click="setTenants(visible, true)">
                Mở cho tất cả
              </button>
              <button type="button" :disabled="busy" class="h-9 rounded-md border border-slate-300 px-3 text-sm font-semibold hover:bg-slate-100 disabled:opacity-50" @click="setTenants(visible, false)">
                Tắt tất cả
              </button>
            </div>
          </div>
          <label class="relative mt-3 block">
            <span class="sr-only">Tìm xã</span>
            <Search class="pointer-events-none absolute left-3 top-2.5 h-5 w-5 text-slate-400" aria-hidden="true" />
            <input v-model="query" type="search" placeholder="Tìm xã" class="h-10 w-full rounded-md border border-slate-300 pl-10 pr-3" />
          </label>
          <ul class="mt-3 max-h-96 space-y-1 overflow-y-auto">
            <li v-for="t in visible" :key="t.code" class="flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-slate-50">
              <NuxtLink :to="`/xa/${t.code}`" class="text-sm hover:underline">
                <b>{{ t.name }}</b> <span class="font-mono text-xs text-slate-500">{{ t.code }}</span>
              </NuxtLink>
              <ToggleSwitch
                :model-value="isOpen(t)"
                :disabled="busy"
                :label="`Mở ${procedure.title} ở ${t.name}`"
                @update:model-value="setTenants([t], $event)"
              />
            </li>
          </ul>
          <p class="mt-2 text-xs text-slate-500">"Mở cho tất cả" và "Tắt tất cả" áp dụng cho các xã đang hiện theo ô tìm.</p>
        </div>
      </div>
    </template>
  </section>
</template>
