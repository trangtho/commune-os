<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->
<script setup lang="ts">
import { Activity, Building2, Package, ScrollText } from "lucide-vue-next";

const menu = [
  { to: "/xa", label: "Xã", icon: Building2 },
  { to: "/goi-thu-tuc", label: "Gói thủ tục", icon: Package },
  { to: "/so-cai", label: "Sổ cái", icon: ScrollText },
  { to: "/tinh-trang", label: "Tình trạng dịch vụ", icon: Activity },
];
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-900 md:flex">
    <aside class="bg-slate-900 text-slate-100 md:w-60 md:shrink-0">
      <div class="px-5 py-4">
        <p class="text-lg font-bold">CommuneOS</p>
        <p class="text-sm text-slate-400">Quản trị lõi</p>
      </div>
      <nav class="flex gap-1 overflow-x-auto px-3 pb-3 md:block md:space-y-1">
        <NuxtLink
          v-for="item in menu"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 whitespace-nowrap rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
          active-class="bg-slate-800 font-semibold text-white"
        >
          <component :is="item.icon" class="h-4 w-4" aria-hidden="true" />
          {{ item.label }}
        </NuxtLink>
      </nav>
    </aside>

    <main class="min-w-0 flex-1 p-4 md:p-8">
      <slot />
    </main>
  </div>
</template>
