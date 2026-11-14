<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import {UserRound,Save,ShieldCheck} from 'lucide-vue-next'
import type {Profile} from '~/types/models'
const {data:profile,error,refresh}=await useFetch<Profile>('/api/profile', {key:'citizen-profile'})
const form=reactive({display_name:'',email:'',phone:'',address:''})
const editing=ref(false)
watch(profile,(v)=>{if(v&&!editing.value){form.display_name=v.display_name;form.email=v.email;form.phone=v.phone;form.address=v.address}},{immediate:true})
const busy=ref(false);const result=ref('')
async function save(){busy.value=true;result.value='';try{await $fetch('/api/profile',{method:'PATCH',body:form});result.value='Thông tin cá nhân đã được cập nhật trong PostgreSQL.';editing.value=false;await refresh();await refreshNuxtData('citizen-auth')}catch(e){result.value=readableError(e)}finally{busy.value=false}}
</script>
<template><div class="space-y-4"><div><h2 class="text-xl font-black">Hồ sơ cá nhân</h2><p class="text-sm text-muted">Quản lý thông tin tài khoản Công dân đang đăng nhập.</p></div><div v-if="error" class="panel p-6 text-rose-700">Không tải được hồ sơ cá nhân.</div><form v-else class="panel space-y-5 p-5" @submit.prevent="save" @input="editing=true"><div class="flex items-center gap-3 border-b pb-4"><span class="grid h-16 w-16 place-items-center rounded-full bg-brand-100 text-brand-600"><UserRound :size="35"/></span><div><b class="text-lg">{{profile?.display_name}}</b><p class="text-sm text-muted">Công dân · {{profile?.tenant_name}}</p></div></div><div class="grid gap-4 sm:grid-cols-2"><div><label class="field-label">Họ và tên</label><input v-model="form.display_name" class="field" required minlength="2" maxlength="100"/></div><div><label class="field-label">Email</label><input v-model="form.email" class="field" type="email" maxlength="150"/></div><div><label class="field-label">Số điện thoại</label><input v-model="form.phone" class="field" maxlength="25"/></div><div><label class="field-label">Địa chỉ</label><input v-model="form.address" class="field" maxlength="250"/></div></div><p v-if="result" class="rounded-lg bg-brand-50 p-3 text-sm text-brand-800">{{result}}</p><div class="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><NuxtLink to="/bao-mat" class="btn-outline"><ShieldCheck :size="17"/> Bảo mật tài khoản</NuxtLink><button class="btn-primary" :disabled="busy" type="submit"><Save :size="17"/>{{busy?'Đang lưu...':'Lưu thay đổi'}}</button></div></form></div></template>
