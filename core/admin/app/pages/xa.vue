<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->
<script setup lang="ts">
import { Lock, Plus, Unlock, X } from "lucide-vue-next";
import type { Tenant } from "~/types";

const { tenants, addTenant, toggleLock } = useTenants();

const showForm = ref(false);
const code = ref("");
const name = ref("");
const error = ref<string | null>(null);

function openForm() {
  code.value = "";
  name.value = "";
  error.value = null;
  showForm.value = true;
}

function submit() {
  error.value = addTenant(code.value, name.value);
  if (!error.value) showForm.value = false;
}

function confirmToggle(tenant: Tenant) {
  const action = tenant.status === "active" ? "khóa" : "mở khóa";
  const note =
    tenant.status === "active" ? " Cán bộ của xã sẽ không đăng nhập được." : "";
  if (window.confirm(`Bạn chắc chắn muốn ${action} ${tenant.name}?${note}`)) {
    toggleLock(tenant.id);
  }
}
</script>

<template>
  <section>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold">Danh sách xã</h1>
        <p class="mt-1 text-slate-600">
          Mỗi xã có dữ liệu riêng. Xã này không xem được dữ liệu của xã khác.
        </p>
      </div>
      <button
        type="button"
        class="inline-flex h-11 items-center gap-2 rounded-md bg-blue-700 px-4 font-semibold text-white hover:bg-blue-800"
        @click="openForm"
      >
        <Plus class="h-4 w-4" aria-hidden="true" />
        Thêm xã
      </button>
    </div>

    <form
      v-if="showForm"
      class="mt-6 rounded-lg border border-slate-200 bg-white p-5"
      novalidate
      @submit.prevent="submit"
    >
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold">Thêm xã mới</h2>
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
            >Mã xã</label
          >
          <input
            id="tenant-code"
            v-model.trim="code"
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
            >Tên xã</label
          >
          <input
            id="tenant-name"
            v-model="name"
            type="text"
            autocomplete="off"
            class="mt-1 h-11 w-full rounded-md border border-slate-300 px-3"
          />
        </div>
      </div>

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
          class="h-11 rounded-md bg-blue-700 px-5 font-semibold text-white hover:bg-blue-800"
        >
          Tạo xã
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

    <div
      class="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white"
    >
      <table class="w-full text-left text-sm">
        <thead class="bg-slate-100 text-slate-700">
          <tr>
            <th scope="col" class="px-4 py-3 font-semibold">Mã xã</th>
            <th scope="col" class="px-4 py-3 font-semibold">Tên xã</th>
            <th scope="col" class="px-4 py-3 font-semibold">Trạng thái</th>
            <th scope="col" class="px-4 py-3 font-semibold">Ngày tạo</th>
            <th scope="col" class="px-4 py-3 text-right font-semibold">
              Thao tác
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="tenant in tenants"
            :key="tenant.id"
            class="border-t border-slate-200"
          >
            <td class="px-4 py-3 font-mono">{{ tenant.code }}</td>
            <td class="px-4 py-3">{{ tenant.name }}</td>
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
            <td class="px-4 py-3 text-right">
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
          <tr v-if="tenants.length === 0">
            <td colspan="5" class="px-4 py-8 text-center text-slate-500">
              Chưa có xã nào. Bấm "Thêm xã" để tạo xã đầu tiên.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="mt-4 text-sm text-slate-500">
      Đây là dữ liệu mẫu để xem thử. Thay đổi sẽ mất khi tải lại trang.
    </p>
  </section>
</template>
