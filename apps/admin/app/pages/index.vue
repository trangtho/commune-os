<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->
<script setup lang="ts">
// Trang tổng quan: số đơn vị, gói nghiệp vụ, tình trạng sổ ghi nhận của từng đơn vị, lối tắt tới việc thường làm.
// Chỉ đọc qua API lõi (cổng APISIX): GET /rest/tenants, /rest/modules, /rest/tenant_modules, POST /rest/rpc/verify_ledger;
// có gói xã thì đọc thêm GET /rest/procedures.
import { Activity, ArrowRight, Building2, Package, ShieldAlert, ShieldCheck } from "lucide-vue-next";
import type { Tenant } from "~/types";

interface VerifyRow { tenant_code: string; entries: number; ok: boolean; broken_seq: number | null }

const { api } = useApi();
const { modules, load: loadModules, modulesOf, has, xaInstalled } = useModules();
const tenants = ref<Tenant[]>([]);
const procedureCount = ref<number | null>(null);
const ledger = ref<VerifyRow[]>([]);
const error = ref<string | null>(null);
const loading = ref(true);

const activeCount = computed(() => tenants.value.filter((t) => t.status === "active").length);
const entryCount = computed(() => ledger.value.reduce((n, r) => n + (r.entries || 0), 0));
const broken = computed(() => ledger.value.filter((r) => !r.ok));
const tenantName = (code: string) => tenants.value.find((t) => t.code === code)?.name ?? code;

onMounted(async () => {
  try {
    const [t, l] = await Promise.all([
      api<Tenant[]>("/tenants"),
      api<VerifyRow[]>("/rpc/verify_ledger", { method: "POST", body: {} }),
      loadModules(),
    ]);
    tenants.value = t;
    ledger.value = l;
    if (xaInstalled.value) procedureCount.value = (await api<{ id: string }[]>("/procedures?select=id")).length;
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <section class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold">Tổng quan</h1>
      <p class="mt-1 text-slate-600">Tình hình chung của các đơn vị dùng CommuneOS và các gói nghiệp vụ đã cài.</p>
    </div>

    <p v-if="error" role="alert" class="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{{ error }}</p>

    <div class="grid gap-3 sm:grid-cols-3">
      <NuxtLink to="/xa" class="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-brand-300 hover:shadow-md">
        <span class="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700"><Building2 class="h-[22px] w-[22px]" aria-hidden="true" /></span>
        <span><span class="block text-2xl font-bold">{{ loading ? "…" : activeCount }}<small class="text-base font-medium text-slate-600"> / {{ tenants.length }}</small></span><span class="block text-sm text-slate-600">Đơn vị đang hoạt động</span></span>
      </NuxtLink>
      <NuxtLink v-if="xaInstalled" to="/thu-tuc" class="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-brand-300 hover:shadow-md">
        <span class="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700"><Package class="h-[22px] w-[22px]" aria-hidden="true" /></span>
        <span><span class="block text-2xl font-bold">{{ procedureCount ?? "…" }}</span><span class="block text-sm text-slate-600">Thủ tục trong danh mục (gói xã)</span></span>
      </NuxtLink>
      <NuxtLink v-else to="/xa" class="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-brand-300 hover:shadow-md">
        <span class="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700"><Package class="h-[22px] w-[22px]" aria-hidden="true" /></span>
        <span><span class="block text-2xl font-bold">{{ modules.length }}</span><span class="block text-sm text-slate-600">Gói nghiệp vụ đã cài</span></span>
      </NuxtLink>
      <NuxtLink to="/so-cai" class="flex items-center gap-3 rounded-xl border bg-white p-4 transition hover:shadow-md" :class="broken.length ? 'border-red-300' : 'border-slate-200 hover:border-brand-300'">
        <span class="grid h-11 w-11 place-items-center rounded-xl" :class="broken.length ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'">
          <ShieldAlert v-if="broken.length" class="h-[22px] w-[22px]" aria-hidden="true" /><ShieldCheck v-else class="h-[22px] w-[22px]" aria-hidden="true" />
        </span>
        <span><span class="block text-2xl font-bold">{{ loading ? "…" : broken.length ? `${broken.length} đơn vị` : "Nguyên vẹn" }}</span><span class="block text-sm text-slate-600">{{ broken.length ? "Sổ ghi nhận bị sửa" : `Sổ ghi nhận, ${entryCount} dòng` }}</span></span>
      </NuxtLink>
    </div>

    <div class="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div class="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 class="font-bold">Các đơn vị</h2>
        <NuxtLink to="/xa" class="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">Quản lý đơn vị <ArrowRight class="h-4 w-4" aria-hidden="true" /></NuxtLink>
      </div>
      <ul class="divide-y divide-slate-100">
        <li v-for="t in tenants" :key="t.code">
          <NuxtLink :to="`/xa/${t.code}`" class="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-brand-50/60">
            <span class="min-w-0 flex-1"><span class="block font-semibold">{{ t.name }}</span><span class="block text-sm text-slate-600">Mã {{ t.code }} · gói {{ modulesOf(t.code).map((m) => m.module).join(", ") || "chưa bật" }}<template v-if="has(t.code, 'xa')"> · {{ t.dossier_count ?? 0 }} hồ sơ</template></span></span>
            <span class="rounded-full px-2.5 py-0.5 text-xs font-semibold" :class="t.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-700'">{{ t.status === "active" ? "Đang hoạt động" : "Đã khóa" }}</span>
            <span v-if="ledger.find((r) => r.tenant_code === t.code && !r.ok)" class="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">Sổ bị sửa</span>
          </NuxtLink>
        </li>
        <li v-if="!loading && !tenants.length" class="px-4 py-6 text-center text-slate-600">Chưa có đơn vị nào.</li>
      </ul>
    </div>

    <p v-if="broken.length" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      Sổ ghi nhận của {{ broken.map((r) => tenantName(r.tenant_code)).join(", ") }} không khớp. Mở
      <NuxtLink to="/so-cai" class="font-semibold underline">Sổ ghi nhận</NuxtLink> để xem dòng bị sửa.
    </p>

    <NuxtLink to="/tinh-trang" class="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline">
      <Activity class="h-4 w-4" aria-hidden="true" /> Xem tình trạng các dịch vụ lõi
    </NuxtLink>
  </section>
</template>
