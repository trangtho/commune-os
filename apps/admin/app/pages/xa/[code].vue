<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->
<script setup lang="ts">
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  Lock,
  Search,
  ShieldCheck,
  Unlock,
  Users,
} from "lucide-vue-next";
import type { LedgerCheck, Procedure } from "~/types";

// Một xã: tổng quan và các thủ tục xã được mở.
// Quản trị hệ thống cấu hình xã nhưng KHÔNG xem nội dung hồ sơ của dân (chỉ số liệu tổng hợp).
const code = String(useRoute().params.code);
const { tenants, load: loadTenants, toggleLock } = useTenants();
const { procedures, load: loadProcedures, setForTenant, loadError } = useProcedures();
const { api } = useApi();
const config = useRuntimeConfig().public;

const tab = ref<"tong-quan" | "thu-tuc">("tong-quan");
const ledger = ref<LedgerCheck | null>(null);
const message = ref<string | null>(null);
const busy = ref(false);

const tenant = computed(() => tenants.value.find((t) => t.code === code));
const isOpen = (p: Procedure) => p.enabled_tenants.includes(code);
const openTotal = computed(() => procedures.value.filter(isOpen).length);

async function loadAll() {
  await Promise.all([loadTenants(), loadProcedures()]);
  try {
    const rows = await api<LedgerCheck[]>("/rpc/verify_ledger", {
      method: "POST",
      body: { only_tenant: code },
    });
    ledger.value = rows[0] ?? null;
  } catch {
    ledger.value = null;
  }
}
onMounted(loadAll);

// ----- Tab Thủ tục: tìm, lọc theo lĩnh vực, bật/tắt từng thủ tục hoặc cả nhóm đang lọc -----
const query = ref("");
const category = ref("");
const show = ref<"all" | "open" | "closed">("all");
const categories = computed(() => [...new Set(procedures.value.map((p) => p.category))].sort());
const visible = computed(() => {
  const q = query.value.trim().toLowerCase();
  return procedures.value.filter(
    (p) =>
      (!category.value || p.category === category.value) &&
      (show.value === "all" || (show.value === "open") === isOpen(p)) &&
      (!q || p.id.includes(q) || p.title.toLowerCase().includes(q)),
  );
});

async function setProcedures(list: Procedure[], enabled: boolean) {
  const ids = list.filter((p) => isOpen(p) !== enabled).map((p) => p.id);
  if (ids.length === 0) return;
  busy.value = true;
  message.value = await setForTenant(code, ids, enabled);
  busy.value = false;
}

async function toggleTenant() {
  if (!tenant.value) return;
  const action = tenant.value.status === "active" ? "khóa" : "mở khóa";
  if (!window.confirm(`Bạn chắc chắn muốn ${action} ${tenant.value.name}?`)) return;
  message.value = await toggleLock(tenant.value);
}
</script>

<template>
  <section>
    <NuxtLink to="/xa" class="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
      <ArrowLeft class="h-4 w-4" aria-hidden="true" /> Danh sách xã
    </NuxtLink>

    <p v-if="!tenant && tenants.length" class="mt-6 rounded-md bg-red-50 px-3 py-2 text-red-700">
      Không tìm thấy xã có mã "{{ code }}".
    </p>

    <template v-if="tenant">
      <div class="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold">{{ tenant.name }}</h1>
          <p class="mt-1 text-slate-600">
            Mã xã <code>{{ tenant.code }}</code> ·
            <span :class="tenant.status === 'active' ? 'text-green-700' : 'text-slate-600'">
              {{ tenant.status === "active" ? "Đang hoạt động" : "Đã khóa" }}
            </span>
          </p>
        </div>
        <button
          type="button"
          class="inline-flex h-11 items-center gap-2 rounded-md border border-slate-300 px-4 font-semibold hover:bg-slate-100"
          @click="toggleTenant"
        >
          <component :is="tenant.status === 'active' ? Lock : Unlock" class="h-4 w-4" aria-hidden="true" />
          {{ tenant.status === "active" ? "Khóa xã" : "Mở khóa xã" }}
        </button>
      </div>

      <div role="tablist" aria-label="Thông tin xã" class="mt-6 flex gap-1 border-b border-slate-200">
        <button
          v-for="t in [
            { id: 'tong-quan', label: 'Tổng quan' },
            { id: 'thu-tuc', label: `Thủ tục (${openTotal}/${procedures.length})` },
          ]"
          :key="t.id"
          type="button"
          role="tab"
          :aria-selected="tab === t.id"
          class="-mb-px border-b-2 px-4 py-2 text-sm font-semibold"
          :class="tab === t.id ? 'border-brand-700 text-brand-700' : 'border-transparent text-slate-600 hover:text-slate-900'"
          @click="tab = t.id as typeof tab"
        >
          {{ t.label }}
        </button>
      </div>

      <p v-if="message || loadError" role="alert" class="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
        {{ message || loadError }}
      </p>

      <!-- Tổng quan -->
      <div v-if="tab === 'tong-quan'" class="mt-6 space-y-6">
        <dl class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div class="rounded-lg border border-slate-200 bg-white p-4">
            <dt class="text-sm text-slate-500">Hồ sơ của xã</dt>
            <dd class="mt-1 text-2xl font-bold">{{ tenant.dossier_count }}</dd>
          </div>
          <div class="rounded-lg border border-slate-200 bg-white p-4">
            <dt class="text-sm text-slate-500">Thủ tục đang mở</dt>
            <dd class="mt-1 text-2xl font-bold">{{ openTotal }} / {{ procedures.length }}</dd>
          </div>
          <div class="rounded-lg border border-slate-200 bg-white p-4">
            <dt class="text-sm text-slate-500">Sổ ghi nhận</dt>
            <dd class="mt-1 text-lg font-bold" :class="ledger?.ok === false ? 'text-red-700' : 'text-green-700'">
              <template v-if="ledger">
                {{ ledger.ok ? "Nguyên vẹn" : `Bị sửa ở dòng ${ledger.broken_seq}` }}
                <span class="block text-sm font-normal text-slate-500">{{ ledger.entries }} mục</span>
              </template>
              <template v-else>Chưa có mục nào</template>
            </dd>
          </div>
          <div class="rounded-lg border border-slate-200 bg-white p-4">
            <dt class="text-sm text-slate-500">Ngày tạo</dt>
            <dd class="mt-1 text-lg font-bold">{{ formatDateTime(tenant.created_at) }}</dd>
          </div>
        </dl>

        <div class="rounded-lg border border-slate-200 bg-white p-5">
          <h2 class="flex items-center gap-2 text-lg font-semibold">
            <Users class="h-5 w-5 text-brand-700" aria-hidden="true" /> Tài khoản cán bộ
          </h2>
          <ul class="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>
              Quản trị hệ thống chỉ cấp tài khoản <b>lãnh đạo xã</b>: trong Keycloak, tạo người dùng,
              đặt thuộc tính <code>tenant_id = {{ tenant.code }}</code> và gán vai trò <code>leader</code>.
            </li>
            <li>Lãnh đạo xã tự tạo, khóa và cấp lại mật khẩu cho cán bộ xử lý ở màn hình cán bộ xã (mục Nhân viên).</li>
            <li>
              Quản trị hệ thống không đăng nhập thay cán bộ và không xem nội dung hồ sơ của dân;
              cách ly dữ liệu giữa các xã được giữ ở cơ sở dữ liệu.
            </li>
          </ul>
          <div class="mt-4 flex flex-wrap gap-2">
            <a
              :href="config.communeUrl"
              target="_blank"
              rel="noopener"
              class="inline-flex h-10 items-center gap-2 rounded-md bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800"
            >
              Mở màn hình cán bộ xã <ExternalLink class="h-4 w-4" aria-hidden="true" />
            </a>
            <a
              :href="`${config.keycloakPublicUrl}/admin/master/console/#/communeos/users`"
              target="_blank"
              rel="noopener"
              class="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold hover:bg-slate-100"
            >
              Quản lý tài khoản trong Keycloak <ExternalLink class="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </div>

        <p class="flex items-center gap-2 text-sm text-slate-500">
          <ShieldCheck class="h-4 w-4" aria-hidden="true" />
          Xã bị khóa thì cán bộ xã đó không xem được hồ sơ nào; người dân vẫn tra cứu được hồ sơ đã nộp.
        </p>
      </div>

      <!-- Thủ tục -->
      <div v-else class="mt-6">
        <div class="flex flex-wrap items-center gap-3">
          <label class="relative block w-full max-w-xs">
            <span class="sr-only">Tìm thủ tục</span>
            <Search class="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" aria-hidden="true" />
            <input v-model="query" type="search" placeholder="Tìm theo mã hoặc tên" class="h-11 w-full rounded-md border border-slate-300 pl-10 pr-3" />
          </label>
          <label class="flex items-center gap-2 text-sm">
            Lĩnh vực
            <select v-model="category" class="h-11 rounded-md border border-slate-300 px-3">
              <option value="">Tất cả</option>
              <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
            </select>
          </label>
          <label class="flex items-center gap-2 text-sm">
            Hiển thị
            <select v-model="show" class="h-11 rounded-md border border-slate-300 px-3">
              <option value="all">Tất cả</option>
              <option value="open">Đang mở</option>
              <option value="closed">Chưa mở</option>
            </select>
          </label>
          <div class="ml-auto flex gap-2">
            <button type="button" :disabled="busy" class="h-11 rounded-md border border-slate-300 px-4 text-sm font-semibold hover:bg-slate-100 disabled:opacity-50" @click="setProcedures(visible, true)">
              Mở tất cả ({{ visible.filter((p) => !isOpen(p)).length }})
            </button>
            <button type="button" :disabled="busy" class="h-11 rounded-md border border-slate-300 px-4 text-sm font-semibold hover:bg-slate-100 disabled:opacity-50" @click="setProcedures(visible, false)">
              Tắt tất cả ({{ visible.filter(isOpen).length }})
            </button>
          </div>
        </div>
        <p class="mt-2 text-sm text-slate-500">"Mở tất cả" và "Tắt tất cả" chỉ áp dụng cho các thủ tục đang hiện theo bộ lọc.</p>

        <div class="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table class="w-full min-w-[640px] text-left text-sm">
            <thead class="bg-slate-100 text-slate-700">
              <tr>
                <th scope="col" class="px-4 py-3 font-semibold">Thủ tục</th>
                <th scope="col" class="px-4 py-3 font-semibold">Lĩnh vực</th>
                <th scope="col" class="px-4 py-3 font-semibold">Hạn xử lý</th>
                <th scope="col" class="px-4 py-3 font-semibold">Phiên bản</th>
                <th scope="col" class="px-4 py-3 text-right font-semibold">Mở ở xã này</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in visible" :key="p.id" class="border-t border-slate-200">
                <td class="px-4 py-3">
                  <NuxtLink :to="`/thu-tuc/${p.id}`" class="font-semibold text-brand-700 hover:underline">{{ p.title }}</NuxtLink>
                  <span class="block font-mono text-xs text-slate-500">{{ p.id }}</span>
                </td>
                <td class="px-4 py-3">{{ p.category }}</td>
                <td class="px-4 py-3 whitespace-nowrap">{{ p.sla_days }} ngày</td>
                <td class="px-4 py-3">{{ p.version }}</td>
                <td class="px-4 py-3 text-right">
                  <ToggleSwitch
                    :model-value="isOpen(p)"
                    :disabled="busy"
                    :label="`Mở thủ tục ${p.title} ở ${tenant.name}`"
                    @update:model-value="setProcedures([p], $event)"
                  />
                </td>
              </tr>
              <tr v-if="visible.length === 0">
                <td colspan="5" class="px-4 py-8 text-center text-slate-500">Không có thủ tục nào khớp bộ lọc.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="mt-3 flex items-center gap-2 text-sm text-slate-500">
          <FileText class="h-4 w-4" aria-hidden="true" />
          Tắt một thủ tục chỉ chặn hồ sơ nộp mới; hồ sơ đã nộp vẫn được xử lý tiếp.
        </p>
      </div>
    </template>
  </section>
</template>
