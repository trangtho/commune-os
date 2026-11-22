<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->
<script setup lang="ts">
// Công tắc Bật/Tắt có thể dùng bằng bàn phím và trình đọc màn hình (role="switch").
defineProps<{ modelValue: boolean; label: string; disabled?: boolean }>();
defineEmits<{ "update:modelValue": [value: boolean] }>();
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="modelValue"
    :aria-label="label"
    :disabled="disabled"
    class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-50"
    :class="modelValue ? 'bg-brand-700' : 'bg-slate-300'"
    @click="$emit('update:modelValue', !modelValue)"
  >
    <span
      class="inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform"
      :class="modelValue ? 'translate-x-5' : 'translate-x-0.5'"
    />
  </button>
</template>
