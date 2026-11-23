<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { Users, Inbox, ClipboardList, Activity, IdCard } from 'lucide-vue-next'
// Khu Quản lý nhân viên: chỉ lãnh đạo xã. Trang này là khung chung (thanh mục), các trang con nằm trong pages/tai-khoan/.
// Ẩn menu chỉ để gọn giao diện; quyền thật do lõi kiểm tra (dịch vụ tài khoản + hàm SQL require_leader()).
const { data: auth } = await useAsyncData('staff-auth', () => useRequestFetch()<{ authenticated: boolean; role?: string }>('/api/auth/me'))
const isLeader = computed(() => auth.value?.role === 'admin')
const { data: overview } = await useFetch<{ requests: { status: string }[] }>('/api/management/overview', {
  key: 'mgmt-overview', immediate: isLeader.value,
})
const pending = computed(() => overview.value?.requests.filter((r) => r.status === 'pending').length || 0)
const tabs = computed(() => [
  { to: '/tai-khoan', name: 'Tài khoản', icon: Users },
  { to: '/tai-khoan/ho-so', name: 'Hồ sơ nhân viên', icon: IdCard },
  { to: '/tai-khoan/yeu-cau', name: pending.value ? `Chờ duyệt (${pending.value})` : 'Chờ duyệt', icon: Inbox },
  { to: '/tai-khoan/giao-viec', name: 'Giao việc', icon: ClipboardList },
  { to: '/tai-khoan/giam-sat', name: 'Giám sát công việc', icon: Activity },
])
const route = useRoute()
</script>
<template>
  <div v-if="!isLeader" class="panel p-5 text-rose-700">Chỉ lãnh đạo xã được dùng khu Quản lý nhân viên.</div>
  <div v-else class="space-y-4">
    <nav class="flex flex-wrap gap-2" aria-label="Quản lý nhân viên">
      <NuxtLink v-for="t in tabs" :key="t.to" :to="t.to" :class="route.path === t.to ? 'btn-primary' : 'btn-outline'" :aria-current="route.path === t.to ? 'page' : undefined">
        <component :is="t.icon" :size="16" />{{ t.name }}
      </NuxtLink>
    </nav>
    <NuxtPage />
  </div>
</template>
