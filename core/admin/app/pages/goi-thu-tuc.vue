<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->
<script setup lang="ts">
import { ChevronDown, ChevronRight, Upload } from "lucide-vue-next";

const { packs, loadPack } = usePacks();

const fileInput = ref<HTMLInputElement | null>(null);
const error = ref<string | null>(null);
const notice = ref<string | null>(null);
const expanded = ref<string | null>(null);

async function onFileChosen(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  error.value = null;
  notice.value = null;
  const text = await file.text();
  error.value = loadPack(text);
  if (!error.value) notice.value = `Đã nạp gói từ tệp ${file.name}.`;
  input.value = "";
}

function toggle(code: string) {
  expanded.value = expanded.value === code ? null : code;
}
</script>

<template>
  <section>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold">Gói thủ tục</h1>
        <p class="mt-1 text-slate-600">
          Mỗi thủ tục là một gói cấu hình. Nạp gói mới không cần sửa mã.
        </p>
      </div>
      <div>
        <input
          ref="fileInput"
          type="file"
          accept=".yaml,.yml"
          class="sr-only"
          aria-label="Chọn tệp pack.yaml"
          @change="onFileChosen"
        />
        <button
          type="button"
          class="inline-flex h-11 items-center gap-2 rounded-md bg-blue-700 px-4 font-semibold text-white hover:bg-blue-800"
          @click="fileInput?.click()"
        >
          <Upload class="h-4 w-4" aria-hidden="true" />
          Nạp gói
        </button>
      </div>
    </div>

    <p
      v-if="error"
      role="alert"
      class="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
    >
      {{ error }}
    </p>
    <p
      v-if="notice"
      role="status"
      class="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm font-medium text-green-800"
    >
      {{ notice }}
    </p>

    <div
      class="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white"
    >
      <table class="w-full text-left text-sm">
        <thead class="bg-slate-100 text-slate-700">
          <tr>
            <th scope="col" class="w-10 px-4 py-3">
              <span class="sr-only">Mở rộng</span>
            </th>
            <th scope="col" class="px-4 py-3 font-semibold">Mã gói</th>
            <th scope="col" class="px-4 py-3 font-semibold">Tên thủ tục</th>
            <th scope="col" class="px-4 py-3 font-semibold">Phiên bản</th>
            <th scope="col" class="px-4 py-3 font-semibold">Kênh nhận</th>
            <th scope="col" class="px-4 py-3 font-semibold">Ngày nạp</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="pack in packs" :key="pack.code">
            <tr class="border-t border-slate-200">
              <td class="px-4 py-3">
                <button
                  type="button"
                  class="rounded p-1 hover:bg-slate-100"
                  :aria-expanded="expanded === pack.code"
                  :aria-label="`Xem chi tiết gói ${pack.name}`"
                  @click="toggle(pack.code)"
                >
                  <component
                    :is="expanded === pack.code ? ChevronDown : ChevronRight"
                    class="h-4 w-4"
                    aria-hidden="true"
                  />
                </button>
              </td>
              <td class="px-4 py-3 font-mono">{{ pack.code }}</td>
              <td class="px-4 py-3">{{ pack.name }}</td>
              <td class="px-4 py-3">{{ pack.version }}</td>
              <td class="px-4 py-3">
                <span
                  v-for="channel in pack.channels"
                  :key="channel"
                  class="mr-1 inline-block rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800"
                >
                  {{ CHANNEL_LABELS[channel] }}
                </span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap">
                {{ formatDateTime(pack.loaded_at) }}
              </td>
            </tr>
            <tr
              v-if="expanded === pack.code"
              class="border-t border-slate-100 bg-slate-50"
            >
              <td />
              <td colspan="5" class="px-4 py-4">
                <div class="grid gap-6 md:grid-cols-2">
                  <div>
                    <h2 class="font-semibold">Giấy tờ bắt buộc</h2>
                    <ul class="mt-2 list-disc space-y-1 pl-5">
                      <li
                        v-for="doc in pack.required_documents"
                        :key="doc.code"
                      >
                        {{ doc.name }}
                        <span class="font-mono text-xs text-slate-500"
                          >({{ doc.code }})</span
                        >
                      </li>
                      <li
                        v-if="pack.required_documents.length === 0"
                        class="list-none text-slate-500"
                      >
                        Gói không khai báo giấy tờ bắt buộc.
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h2 class="font-semibold">Các bước xử lý</h2>
                    <ol class="mt-2 list-decimal space-y-1 pl-5">
                      <li>
                        Tiếp nhận:
                        {{
                          ROLE_LABELS[pack.roles.receive] ?? pack.roles.receive
                        }}
                      </li>
                      <li>
                        Thẩm tra:
                        {{
                          ROLE_LABELS[pack.roles.review] ?? pack.roles.review
                        }}
                      </li>
                      <li>
                        Ký duyệt:
                        {{ ROLE_LABELS[pack.roles.sign] ?? pack.roles.sign }}
                      </li>
                    </ol>
                    <p class="mt-3 text-slate-600">
                      Hạn xử lý: {{ pack.sla_hours }} giờ làm việc
                    </p>
                  </div>
                </div>
              </td>
            </tr>
          </template>
          <tr v-if="packs.length === 0">
            <td colspan="6" class="px-4 py-8 text-center text-slate-500">
              Chưa có gói thủ tục nào. Bấm "Nạp gói" và chọn tệp pack.yaml.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="mt-4 text-sm text-slate-500">
      Đang dùng dữ liệu giả lập. Để thử, chọn tệp
      <span class="font-mono">packs/_template/pack.yaml</span> trong repo.
    </p>
  </section>
</template>
