<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->
<script setup lang="ts">
import { Activity, Building2, LayoutDashboard, LogOut, Package, ScrollText } from "lucide-vue-next";

const { username, logout } = useAuth();
const route = useRoute();

const menu = [
  { to: "/", label: "Tổng quan", icon: LayoutDashboard },
  { to: "/xa", label: "Đơn vị", icon: Building2 },
  { to: "/thu-tuc", label: "Danh mục thủ tục", icon: Package },
  { to: "/so-cai", label: "Kiểm tra hồ sơ đã ký", icon: ScrollText },
  { to: "/tinh-trang", label: "Tình trạng hệ thống", icon: Activity },
];
const isActive = (to: string) => (to === "/" ? route.path === "/" : route.path === to || route.path.startsWith(`${to}/`));
</script>

<template>
  <div class="admin-app-shell min-h-screen md:flex md:gap-5 md:p-4">
    <aside class="border-b border-slate-200 bg-white md:sticky md:top-4 md:flex md:h-[calc(100vh-2rem)] md:w-60 md:shrink-0 md:flex-col md:rounded-2xl md:border">
      <div class="flex items-center gap-3 px-5 py-4">
        <img src="/images/logo-communeos.svg" alt="" width="40" height="40" class="h-10 w-10 shrink-0" />
        <div>
          <p class="text-lg font-bold text-brand-800">CommuneOS</p>
          <p class="text-sm text-slate-600">Quản trị hệ thống</p>
        </div>
      </div>
      <nav class="flex gap-1 overflow-x-auto px-3 pb-3 md:block md:flex-1 md:space-y-1" aria-label="Điều hướng chính">
        <NuxtLink
          v-for="item in menu"
          :key="item.to"
          :to="item.to"
          :aria-current="isActive(item.to) ? 'page' : undefined"
          :class="[
            'flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-semibold transition',
            isActive(item.to) ? 'bg-brand-100 text-brand-800' : 'text-slate-700 hover:bg-brand-50',
          ]"
        >
          <component :is="item.icon" class="h-[18px] w-[18px]" aria-hidden="true" />
          {{ item.label }}
        </NuxtLink>
      </nav>
      <div class="hidden border-t border-slate-200 px-5 py-3 text-sm md:block">
        <p class="truncate text-slate-600">Đang đăng nhập: <b class="font-semibold text-slate-800">{{ username }}</b></p>
        <button type="button" class="mt-2 inline-flex items-center gap-2 font-semibold text-slate-700 hover:text-brand-700" @click="logout">
          <LogOut class="h-4 w-4" aria-hidden="true" />
          Đăng xuất
        </button>
      </div>
    </aside>

    <main class="admin-content min-w-0 flex-1 p-3 md:p-0">
      <div class="admin-sheet"><slot /></div>
      <button type="button" class="mt-3 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-700 md:hidden" @click="logout">
        <LogOut class="h-4 w-4" aria-hidden="true" />
        Đăng xuất ({{ username }})
      </button>
    </main>
  </div>
</template>
