<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->
<script setup lang="ts">
import { ShieldAlert, ShieldCheck } from "lucide-vue-next";

// Sổ ghi nhận của lõi: mỗi thao tác (trên hồ sơ, đơn, tệp đính kèm... của mọi gói) là 1 dòng, nối với dòng trước bằng mã băm.
// Trang này gọi API lõi:
//   POST /rest/rpc/verify_ledger   kiểm tra chuỗi của từng đơn vị
//   GET  /rest/ledger              các dòng mới nhất
interface VerifyRow {
  tenant_code: string;
  entries: number;
  ok: boolean;
  broken_seq: number | null;
  reason: string | null;
}
interface LedgerRow {
  seq: number;
  tenant_code: string;
  dossier_id: string;
  action: string;
  actor: string;
  created_at: string;
  hash: string;
}

const ACTIONS: Record<string, string> = {
  submitted: "Nộp",
  assigned: "Phân công cán bộ",
  document_upload: "Tải lên giấy tờ",
  document_delete: "Xóa giấy tờ",
  processing: "Chuyển xử lý",
  supplement: "Yêu cầu bổ sung",
  supplement_received: "Nhận bổ sung",
  completed: "Hoàn thành",
  rejected: "Từ chối",
  withdrawn: "Rút hồ sơ",
  attachment: "Đính kèm tệp",
  dept_approved: "Trưởng phòng duyệt",
  approved: "Đồng ý",
};

const { api } = useApi();
// Hiện tên đơn vị thay cho mã (mã vẫn ghi kèm để đối chiếu).
const { tenants, load: loadTenants } = useTenants();
const tenantName = (code: string) => tenants.value.find((t) => t.code === code)?.name ?? code;
const results = ref<VerifyRow[]>([]);
const rows = ref<LedgerRow[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const checkedAt = ref<string | null>(null);

async function check() {
  loading.value = true;
  error.value = null;
  try {
    results.value = await api<VerifyRow[]>("/rpc/verify_ledger", {
      method: "POST",
      body: {},
    });
    rows.value = await api<LedgerRow[]>("/ledger?order=seq.desc&limit=30");
    checkedAt.value = new Date().toISOString();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  check();
  if (!tenants.value.length) loadTenants();
});
</script>

<template>
  <section>
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold">Sổ ghi nhận</h1>
        <p class="mt-2 max-w-2xl text-slate-600">
          Mỗi thao tác (trên hồ sơ, đơn, tệp đính kèm... của mọi gói nghiệp vụ) được ghi thành một dòng và nối với
          dòng trước của cùng đơn vị bằng mã kiểm tra. Nếu ai đó sửa hoặc xóa một dòng, chuỗi sẽ gãy và trang này
          báo ngay.
        </p>
      </div>
      <button
        type="button"
        class="inline-flex h-11 items-center gap-2 rounded-md bg-brand-700 px-4 font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
        :disabled="loading"
        @click="check"
      >
        {{ loading ? "Đang kiểm tra..." : "Kiểm tra lại" }}
      </button>
    </div>

    <p
      v-if="error"
      role="alert"
      class="mt-6 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
    >
      {{ error }}
    </p>

    <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="r in results"
        :key="r.tenant_code"
        class="rounded-lg border bg-white p-4"
        :class="r.ok ? 'border-slate-200' : 'border-red-300'"
      >
        <div class="flex items-center gap-2">
          <ShieldCheck
            v-if="r.ok"
            class="h-5 w-5 text-green-700"
            aria-hidden="true"
          />
          <ShieldAlert v-else class="h-5 w-5 text-red-700" aria-hidden="true" />
          <span class="font-semibold">{{ tenantName(r.tenant_code) }}</span>
          <span class="font-mono text-xs text-slate-600">{{ r.tenant_code }}</span>
        </div>
        <p v-if="r.ok" class="mt-2 text-sm text-green-800">
          Nguyên vẹn. Đã kiểm tra {{ r.entries }} dòng.
        </p>
        <p v-else class="mt-2 text-sm font-medium text-red-700">
          Phát hiện bị sửa ở dòng số {{ r.broken_seq }}: {{ r.reason }}.
        </p>
      </div>
    </div>
    <p v-if="checkedAt" class="mt-3 text-sm text-slate-500">
      Kiểm tra lúc {{ formatDateTime(checkedAt) }}.
    </p>

    <h2 class="mt-8 text-lg font-semibold">30 dòng mới nhất</h2>
    <div
      class="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white"
    >
      <table class="w-full min-w-[960px] whitespace-nowrap text-left text-sm">
        <thead class="border-b border-slate-200 bg-slate-50 text-slate-600">
          <tr>
            <th scope="col" class="px-4 py-3 font-semibold">Số dòng</th>
            <th scope="col" class="px-4 py-3 font-semibold">Đơn vị</th>
            <th scope="col" class="px-4 py-3 font-semibold">Mã đối tượng</th>
            <th scope="col" class="px-4 py-3 font-semibold">Thao tác</th>
            <th scope="col" class="px-4 py-3 font-semibold">Người thực hiện</th>
            <th scope="col" class="px-4 py-3 font-semibold">Thời điểm</th>
            <th scope="col" class="px-4 py-3 font-semibold">Mã kiểm tra</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.seq"
            class="border-b border-slate-100 last:border-0"
          >
            <td class="px-4 py-3">{{ row.seq }}</td>
            <td class="px-4 py-3">{{ tenantName(row.tenant_code) }}</td>
            <td class="px-4 py-3 font-mono">{{ row.dossier_id }}</td>
            <td class="px-4 py-3">{{ ACTIONS[row.action] ?? row.action }}</td>
            <td class="px-4 py-3">{{ row.actor }}</td>
            <td class="px-4 py-3 text-slate-600">
              {{ formatDateTime(row.created_at) }}
            </td>
            <td class="px-4 py-3 font-mono text-slate-500" :title="row.hash">
              {{ row.hash.slice(0, 12) }}…
            </td>
          </tr>
          <tr v-if="rows.length === 0">
            <td colspan="7" class="px-4 py-8 text-center text-slate-500">
              {{ loading ? "Đang tải..." : "Chưa có dòng nào." }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="mt-3 text-sm text-slate-500">
      Sổ chỉ lưu mã đối tượng, thao tác, người thực hiện và mã băm của ghi chú; không lưu nội dung.
    </p>
  </section>
</template>
