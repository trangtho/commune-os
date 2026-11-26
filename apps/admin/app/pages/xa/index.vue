<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->
<script setup lang="ts">
import { ChevronRight, Lock, Plus, Search, Unlock, X } from "lucide-vue-next";
import type { IssuedPassword, Tenant } from "~/types";

const { tenants, loading, loadError, load, addTenant, toggleLock } =
  useTenants();

// Gói nghiệp vụ đã cài và gói bật cho từng đơn vị.
const { modules, load: loadModules, modulesOf, has, xaInstalled } = useModules();

// Số thủ tục đang mở của từng xã lấy từ danh mục thủ tục (chỉ khi cài gói xã).
const { procedures, load: loadProcedures, openCount } = useProcedures();

// Mở trang là lấy danh sách đơn vị và gói từ API; danh mục thủ tục chỉ có khi cài gói xã.
onMounted(async () => {
  await Promise.all([load(), loadModules()]);
  if (xaInstalled.value) await loadProcedures();
});

// Tìm theo mã hoặc tên, lọc theo trạng thái: dùng được khi có hàng trăm xã.
const query = ref("");
const statusFilter = ref<"all" | "active" | "locked">("all");
const visible = computed(() => {
  const q = query.value.trim().toLowerCase();
  return tenants.value.filter(
    (t) =>
      (statusFilter.value === "all" || t.status === statusFilter.value) &&
      (!q || t.code.includes(q) || t.name.toLowerCase().includes(q)),
  );
});

// Thêm đơn vị kèm gói nghiệp vụ và tài khoản lãnh đạo: một lần gọi lõi, mật khẩu tạm chỉ hiện một lần.
// Mặc định chọn gói xã nếu lõi có cài.
const showForm = ref(false);
const emptyForm = () => ({
  code: "", name: "", leaderUsername: "", leaderFullName: "", leaderEmail: "",
  modules: (xaInstalled.value ? ["xa"] : []) as string[],
});
const form = reactive(emptyForm());
const error = ref<string | null>(null);
const saving = ref(false);
const issued = ref<IssuedPassword | null>(null);

function openForm() {
  Object.assign(form, emptyForm());
  error.value = null;
  issued.value = null;
  showForm.value = true;
}

async function submit() {
  saving.value = true;
  const r = await addTenant(form);
  saving.value = false;
  error.value = r.error;
  if (!r.error) {
    showForm.value = false;
    issued.value = r.leader ?? null;
  }
}

async function confirmToggle(tenant: Tenant) {
  const action = tenant.status === "active" ? "khóa" : "mở khóa";
  const note =
    tenant.status === "active"
      ? " Người của đơn vị sẽ không xem được dữ liệu nào."
      : "";
  if (window.confirm(`Bạn chắc chắn muốn ${action} ${tenant.name}?${note}`)) {
    const message = await toggleLock(tenant);
    if (message) window.alert(message);
  }
}
</script>

<template>
  <section>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold">Đơn vị</h1>
        <p class="mt-1 text-slate-600">
          Mỗi đơn vị (xã, công ty...) có dữ liệu riêng, không xem được dữ liệu của đơn vị khác, và chỉ dùng các gói
          nghiệp vụ được bật cho mình.
        </p>
      </div>
      <button
        type="button"
        class="inline-flex h-11 items-center gap-2 rounded-md bg-brand-700 px-4 font-semibold text-white hover:bg-brand-800"
        @click="openForm"
      >
        <Plus class="h-4 w-4" aria-hidden="true" />
        Thêm đơn vị
      </button>
    </div>

    <form
      v-if="showForm"
      class="mt-6 rounded-lg border border-slate-200 bg-white p-5"
      novalidate
      @submit.prevent="submit"
    >
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold">Thêm đơn vị mới</h2>
        <button
          type="button"
          class="rounded p-1 text-slate-500 hover:bg-slate-100"
          aria-label="Đóng"
          @click="showForm = false"
        >
          <X class="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div class="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label for="tenant-code" class="block text-sm font-medium"
            >Mã đơn vị</label
          >
          <input
            id="tenant-code"
            v-model.trim="form.code"
            type="text"
            autocomplete="off"
            class="mt-1 h-11 w-full rounded-md border border-slate-300 px-3"
            aria-describedby="tenant-code-hint"
          />
          <p id="tenant-code-hint" class="mt-1 text-sm text-slate-500">
            Chữ thường không dấu, số và gạch ngang. Ví dụ: xa-c
          </p>
        </div>
        <div>
          <label for="tenant-name" class="block text-sm font-medium"
            >Tên đơn vị</label
          >
          <input
            id="tenant-name"
            v-model="form.name"
            type="text"
            autocomplete="off"
            class="mt-1 h-11 w-full rounded-md border border-slate-300 px-3"
          />
        </div>
      </div>

      <fieldset class="mt-5 border-t border-slate-200 pt-4">
        <legend class="pr-2 text-base font-semibold">Gói nghiệp vụ</legend>
        <p class="text-sm text-slate-500">
          Đơn vị chỉ dùng được các gói được chọn. Đổi được sau ở trang chi tiết đơn vị.
        </p>
        <div class="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          <label v-for="m in modules" :key="m.name" class="flex items-center gap-2 text-sm">
            <input v-model="form.modules" type="checkbox" :value="m.name" class="h-4 w-4" />
            <span><b>{{ m.title }}</b> <code class="text-slate-500">{{ m.name }}</code></span>
          </label>
          <span v-if="modules.length === 0" class="text-sm text-slate-500">Lõi chưa cài gói nghiệp vụ nào.</span>
        </div>
      </fieldset>

      <fieldset class="mt-5 border-t border-slate-200 pt-4">
        <legend class="pr-2 text-base font-semibold">Tài khoản lãnh đạo</legend>
        <p class="text-sm text-slate-500">
          Hệ thống tạo tài khoản lãnh đạo cùng lúc với đơn vị và cấp mật khẩu tạm. Lãnh đạo tự tạo tài khoản cán bộ của
          đơn vị.
        </p>
        <div class="mt-3 grid gap-4 md:grid-cols-3">
          <div>
            <label for="leader-username" class="block text-sm font-medium">Tên đăng nhập</label>
            <input
              id="leader-username"
              v-model.trim="form.leaderUsername"
              type="text"
              autocomplete="off"
              autocapitalize="none"
              spellcheck="false"
              class="mt-1 h-11 w-full rounded-md border border-slate-300 px-3"
              aria-describedby="leader-username-hint"
            />
            <p id="leader-username-hint" class="mt-1 text-sm text-slate-500">Ví dụ: lanhdao.xa-c</p>
          </div>
          <div>
            <label for="leader-name" class="block text-sm font-medium">Họ và tên</label>
            <input
              id="leader-name"
              v-model="form.leaderFullName"
              type="text"
              autocomplete="off"
              class="mt-1 h-11 w-full rounded-md border border-slate-300 px-3"
            />
          </div>
          <div>
            <label for="leader-email" class="block text-sm font-medium">
              Email <span class="font-normal text-slate-500">(không bắt buộc)</span>
            </label>
            <input
              id="leader-email"
              v-model.trim="form.leaderEmail"
              type="email"
              autocomplete="off"
              class="mt-1 h-11 w-full rounded-md border border-slate-300 px-3"
            />
          </div>
        </div>
      </fieldset>

      <p
        v-if="error"
        role="alert"
        class="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
      >
        {{ error }}
      </p>

      <div class="mt-5 flex gap-3">
        <button
          type="submit"
          :disabled="saving"
          class="h-11 rounded-md bg-brand-700 px-5 font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {{ saving ? "Đang tạo..." : "Tạo đơn vị và tài khoản lãnh đạo" }}
        </button>
        <button
          type="button"
          class="h-11 rounded-md border border-slate-300 px-5 font-semibold hover:bg-slate-100"
          @click="showForm = false"
        >
          Hủy
        </button>
      </div>
    </form>

    <IssuedPasswordNotice v-if="issued" class="mt-6" :issued="issued" @close="issued = null" />

    <div class="mt-6 flex flex-wrap items-center gap-3">
      <label class="relative block w-full max-w-sm">
        <span class="sr-only">Tìm đơn vị theo mã hoặc tên</span>
        <Search class="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" aria-hidden="true" />
        <input
          v-model="query"
          type="search"
          placeholder="Tìm theo mã hoặc tên đơn vị"
          class="h-11 w-full rounded-md border border-slate-300 pl-10 pr-3"
        />
      </label>
      <label class="flex items-center gap-2 text-sm">
        Trạng thái
        <select v-model="statusFilter" class="h-11 rounded-md border border-slate-300 px-3">
          <option value="all">Tất cả</option>
          <option value="active">Đang hoạt động</option>
          <option value="locked">Đã khóa</option>
        </select>
      </label>
      <span class="text-sm text-slate-500">{{ visible.length }} / {{ tenants.length }} đơn vị</span>
    </div>

    <p
      v-if="loadError"
      role="alert"
      class="mt-6 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
    >
      {{ loadError }}
    </p>
    <div
      class="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white"
    >
      <table class="w-full text-left text-sm">
        <thead class="bg-slate-100 text-slate-700">
          <tr>
            <th scope="col" class="px-4 py-3 font-semibold">Mã</th>
            <th scope="col" class="px-4 py-3 font-semibold">Tên đơn vị</th>
            <th scope="col" class="px-4 py-3 font-semibold">Gói nghiệp vụ</th>
            <th scope="col" class="px-4 py-3 font-semibold">Số hồ sơ</th>
            <th scope="col" class="px-4 py-3 font-semibold">Thủ tục đang mở</th>
            <th scope="col" class="px-4 py-3 font-semibold">Trạng thái</th>
            <th scope="col" class="px-4 py-3 font-semibold">Ngày tạo</th>
            <th scope="col" class="px-4 py-3 text-right font-semibold">
              Thao tác
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="tenant in visible"
            :key="tenant.id"
            class="border-t border-slate-200"
          >
            <td class="px-4 py-3 font-mono whitespace-nowrap">{{ tenant.code }}</td>
            <td class="px-4 py-3">
              <NuxtLink :to="`/xa/${tenant.code}`" class="font-semibold text-brand-700 hover:underline">
                {{ tenant.name }}
              </NuxtLink>
            </td>
            <td class="px-4 py-3">
              <span
                v-for="m in modulesOf(tenant.code)"
                :key="m.module"
                class="mr-1 inline-block whitespace-nowrap rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-800"
                :title="m.title"
              >{{ m.module }}</span>
              <span v-if="modulesOf(tenant.code).length === 0" class="text-slate-400">Chưa bật</span>
            </td>
            <td class="px-4 py-3">{{ has(tenant.code, "xa") ? tenant.dossier_count ?? 0 : "—" }}</td>
            <td class="px-4 py-3">
              <template v-if="has(tenant.code, 'xa')">{{ openCount(tenant.code) }} / {{ procedures.length }}</template>
              <template v-else>—</template>
            </td>
            <td class="px-4 py-3">
              <span
                class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
                :class="
                  tenant.status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-slate-200 text-slate-700'
                "
              >
                <Lock
                  v-if="tenant.status === 'locked'"
                  class="h-3 w-3"
                  aria-hidden="true"
                />
                {{ tenant.status === "active" ? "Đang hoạt động" : "Đã khóa" }}
              </span>
            </td>
            <td class="px-4 py-3 whitespace-nowrap">
              {{ formatDateTime(tenant.created_at) }}
            </td>
            <td class="px-4 py-3 text-right whitespace-nowrap">
              <NuxtLink
                :to="`/xa/${tenant.code}`"
                class="mr-2 inline-flex h-9 items-center gap-1 rounded-md border border-slate-300 px-3 font-medium hover:bg-slate-100"
              >
                Chi tiết <ChevronRight class="h-4 w-4" aria-hidden="true" />
              </NuxtLink>
              <button
                type="button"
                class="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 px-3 font-medium hover:bg-slate-100"
                @click="confirmToggle(tenant)"
              >
                <component
                  :is="tenant.status === 'active' ? Lock : Unlock"
                  class="h-4 w-4"
                  aria-hidden="true"
                />
                {{ tenant.status === "active" ? "Khóa" : "Mở khóa" }}
              </button>
            </td>
          </tr>
          <tr v-if="loading && tenants.length === 0">
            <td colspan="8" class="px-4 py-8 text-center text-slate-500">
              Đang tải...
            </td>
          </tr>
          <tr v-else-if="tenants.length > 0 && visible.length === 0">
            <td colspan="8" class="px-4 py-8 text-center text-slate-500">
              Không có đơn vị nào khớp điều kiện tìm.
            </td>
          </tr>
          <tr v-else-if="tenants.length === 0">
            <td colspan="8" class="px-4 py-8 text-center text-slate-500">
              Chưa có đơn vị nào. Bấm "Thêm đơn vị" để tạo đơn vị đầu tiên.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="mt-4 text-sm text-slate-500">
      Bấm vào tên đơn vị để bật, tắt gói nghiệp vụ, mở thủ tục (đơn vị dùng gói xã) và xem tình trạng.
      Đơn vị bị khóa thì người của đơn vị đó không xem được dữ liệu nào.
    </p>
  </section>
</template>
