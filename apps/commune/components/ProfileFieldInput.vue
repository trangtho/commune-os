<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import type { ProfileField } from '~/types/staff'
// Một ô nhập cho một trường hồ sơ cán bộ: chữ, ngày, danh sách chọn, hoặc chữ có gợi ý.
const props = defineProps<{ field: ProfileField; idPrefix: string }>()
const model = defineModel<string>({ default: '' })
const id = computed(() => `${props.idPrefix}-${props.field.key}`)
</script>
<template>
  <div :class="field.wide ? 'sm:col-span-2' : ''">
    <label class="field-label" :for="id">{{ field.label }}</label>
    <select v-if="field.type === 'select'" :id="id" v-model="model" class="field">
      <option value="">— Chọn —</option>
      <option v-for="o in field.options" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>
    <textarea v-else-if="field.type === 'textarea'" :id="id" v-model="model" class="field min-h-20" maxlength="500" />
    <template v-else>
      <input :id="id" v-model="model" class="field" :type="field.type || 'text'" maxlength="300"
        :list="field.suggestions ? `${id}-list` : undefined" :required="field.key === 'full_name'" />
      <datalist v-if="field.suggestions" :id="`${id}-list`">
        <option v-for="s in field.suggestions" :key="s" :value="s" />
      </datalist>
    </template>
  </div>
</template>
