<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->
<script setup lang="ts">
import { Search, Upload } from "lucide-vue-next";

// Danh mục thủ tục dùng chung cho cả hệ thống. Việc mở thủ tục cho từng xã làm ở trang của xã
// (Danh sách xã → bấm vào xã → tab Thủ tục), hoặc ở trang chi tiết của thủ tục.
const { procedures, tenants, loading, loadError, load, importPack } = useProcedures();
onMounted(load);

const fileInput = ref<HTMLInputElement | null>(null);
const error = ref<string | null>(null);
const notice = ref<string | null>(null);
const query = ref("");
const category = ref("");

const categories = computed(() => [...new Set(procedures.value.map((p) => p.category))].sort());
const visible = computed(() => {
  const q = query.value.trim().toLowerCase();
  return procedures.value.filter(
    (p) =>
      (!category.value || p.category === category.value) &&
      (!q || p.id.includes(q) || p.title.toLowerCase().includes(q)),
  );
});

async function onFileChosen(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  error.value = null;
  notice.value = null;
  error.value = await importPack(await file.text());
  if (!error.value) {
    notice.value = `Đã nạp thủ tục từ tệp ${file.name}. Thủ tục mới chưa mở cho xã nào: bấm vào thủ tục để mở cho các xã.`;
  }
  input.value = "";
}
</script>

<template>
  <section>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold">Danh mục thủ tục</h1>
        <p class="mt-1 max-w-3xl text-slate-600">
          Bộ thủ tục dùng chung. Thêm thủ tục bằng tệp mô tả (pack.yaml), rồi mở cho từng xã ở trang
          của xã hoặc ở trang chi tiết thủ tục.
        </p>
      </div>
      <div>
        <input
          ref="fileInput"
          type="file"
          accept=".yaml,.yml"
          class="sr-only"
          aria-label="Chọn tệp mô tả thủ tục (pack.yaml)"
          @change="onFileChosen"
        />
        <button
          type="button"
          class="inline-flex h-11 items-center gap-2 rounded-md bg-blue-700 px-4 font-semibold text-white hover:bg-blue-800"
          @click="fileInput?.click()"
        >
          <Upload class="h-4 w-4" aria-hidden="true" />
          Thêm thủ tục
        </button>
      </div>
    </div>

    <p v-if="error || loadError" role="alert" class="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
      {{ error || loadError }}
    </p>
    <p v-if="notice" role="status" class="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm font-medium text-green-800">
      {{ notice }}
    </p>

    <div class="mt-6 flex flex-wrap items-center gap-3">
      <label class="relative block w-full max-w-sm">
        <span class="sr-only">Tìm thủ tục</span>
        <Search class="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" aria-hidden="true" />
        <input v-model="query" type="search" placeholder="Tìm theo mã hoặc tên thủ tục" class="h-11 w-full rounded-md border border-slate-300 pl-10 pr-3" />
      </label>
      <label class="flex items-center gap-2 text-sm">
        Lĩnh vực
        <select v-model="category" class="h-11 rounded-md border border-slate-300 px-3">
          <option value="">Tất cả</option>
          <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
        </select>
      </label>
      <span class="text-sm text-slate-500">{{ visible.length }} / {{ procedures.length }} thủ tục</span>
    </div>

    <div class="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table class="w-full min-w-[720px] text-left text-sm">
        <thead class="bg-slate-100 text-slate-700">
          <tr>
            <th scope="col" class="px-4 py-3 font-semibold">Thủ tục</th>
            <th scope="col" class="px-4 py-3 font-semibold">Lĩnh vực</th>
            <th scope="col" class="px-4 py-3 font-semibold">Phiên bản</th>
            <th scope="col" class="px-4 py-3 font-semibold">Hạn xử lý</th>
            <th scope="col" class="px-4 py-3 font-semibold">Đang mở ở</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in visible" :key="p.id" class="border-t border-slate-200">
            <td class="px-4 py-3">
              <NuxtLink :to="`/thu-tuc/${p.id}`" class="font-semibold text-blue-700 hover:underline">{{ p.title }}</NuxtLink>
              <span class="block font-mono text-xs text-slate-500">{{ p.id }}</span>
            </td>
            <td class="px-4 py-3">{{ p.category }}</td>
            <td class="px-4 py-3">{{ p.version }}</td>
            <td class="px-4 py-3 whitespace-nowrap">{{ p.sla_days }} ngày</td>
            <td class="px-4 py-3 whitespace-nowrap">
              <span
                class="rounded-full px-2.5 py-1 text-xs font-semibold"
                :class="p.enabled_tenants.length === 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'"
              >
                {{ p.enabled_tenants.length }} / {{ tenants.length }} xã
              </span>
            </td>
          </tr>
          <tr v-if="visible.length === 0">
            <td colspan="5" class="px-4 py-8 text-center text-slate-500">
              {{ loading ? "Đang tải..." : procedures.length ? "Không có thủ tục nào khớp điều kiện tìm." : "Chưa có thủ tục nào." }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
