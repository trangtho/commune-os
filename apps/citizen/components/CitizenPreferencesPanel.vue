<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { Save, Sparkles, MapPinned, Trash2, RefreshCw } from 'lucide-vue-next'
import { audienceOptions, emptyPreferences, type ServicePreferences } from '~/shared/personalization'
import type { Procedure } from '~/types/models'
const {data:preferences,error:loadError,refresh:reload}=await useFetch<ServicePreferences>('/api/citizen/preferences',{key:'citizen-service-preferences'})
const {data:localities}=await useFetch<{id:string;name:string;code:string}[]>('/api/localities',{key:'citizen-localities'})
const {data:procedures}=await useFetch<Procedure[]>('/api/procedures',{key:'citizen-procedures'})
const state=reactive<ServicePreferences>({...emptyPreferences,interest_categories:[]})
const categories=computed(()=>[...new Set((procedures.value||[]).map(p=>p.category))].sort((a,b)=>a.localeCompare(b,'vi')))
const saving=ref(false);const message=ref('');const messageError=ref(false)
watch(preferences,value=>{
  if(value)Object.assign(state,{...value,interest_categories:[...(value.interest_categories||[])]})
},{immediate:true})
function toggleInterest(category:string,checked:boolean){
  if(checked&&!state.interest_categories.includes(category))state.interest_categories.push(category)
  else if(!checked)state.interest_categories=state.interest_categories.filter(item=>item!==category)
}
async function save(){
  message.value='';messageError.value=false;saving.value=true
  try{
    await $fetch('/api/citizen/preferences',{method:'PATCH',body:{
      personalization_enabled:state.personalization_enabled,audience_group:state.audience_group,
      interest_categories:[...state.interest_categories],residence_tenant_id:state.residence_tenant_id,
      temporary_tenant_id:state.temporary_tenant_id,preferred_tenant_id:state.preferred_tenant_id
    }})
    await reload();await refreshNuxtData('citizen-procedure-recommendations')
    message.value=state.personalization_enabled?'Đã lưu tùy chọn. Danh sách thủ tục sẽ được xếp hạng theo thông tin bạn cho phép.':'Đã lưu. Cá nhân hóa đang tắt.'
  }catch(e){message.value=readableError(e);messageError.value=true}
  finally{saving.value=false}
}
async function remove(){
  if(!import.meta.client||!window.confirm('Xóa toàn bộ thông tin cá nhân hóa và địa phương tự khai?'))return
  saving.value=true;message.value='';messageError.value=false
  try{
    await $fetch('/api/citizen/preferences',{method:'DELETE'})
    Object.assign(state,{...emptyPreferences,interest_categories:[]})
    await reload();await refreshNuxtData('citizen-procedure-recommendations')
    message.value='Đã xóa tùy chọn cá nhân hóa.'
  }catch(e){message.value=readableError(e);messageError.value=true}
  finally{saving.value=false}
}
</script>
<template>
<section class="panel space-y-4 p-4 sm:p-5" aria-labelledby="preferences-heading">
  <div class="flex flex-wrap items-start justify-between gap-3">
    <div><h3 id="preferences-heading" class="flex items-center gap-2 text-lg font-extrabold"><Sparkles :size="20" class="text-brand-700"/>Gợi ý thủ tục dành cho bạn</h3>
      <p class="mt-1 text-sm text-muted">Tự chọn lĩnh vực quan tâm và nơi cư trú để hệ thống sắp xếp danh mục. Bạn luôn có thể xem tất cả thủ tục.</p>
    </div>
    <NuxtLink to="/thu-tuc" class="btn-outline !text-xs">Xem danh mục</NuxtLink>
  </div>
  <div v-if="loadError" class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">Không tải được tùy chọn. <button type="button" class="font-bold underline" @click="reload()"><RefreshCw :size="14" class="inline"/> Thử lại</button></div>
  <form v-else class="space-y-4" @submit.prevent="save">
    <label for="personalization-enabled" class="flex cursor-pointer items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm">
      <input id="personalization-enabled" v-model="state.personalization_enabled" type="checkbox" class="mt-1 h-4 w-4 accent-blue-700"/>
      <span><b class="block text-brand-800">Bật cá nhân hóa danh sách thủ tục</b><span class="mt-1 block text-xs leading-5 text-slate-600">Khi bật, hệ thống sử dụng lịch sử hồ sơ của chính bạn và các thông tin bạn chọn bên dưới. Tắt bất cứ lúc nào.</span></span>
    </label>
    <p v-if="preferences?.locality_source==='oidc_verified'" class="rounded-lg bg-green-50 px-3 py-2 text-xs text-green-800" role="status">Địa phương được đối chiếu từ thông tin định danh đã xác thực theo cấu hình của hệ thống. Nếu bạn sửa bằng tay, nguồn này sẽ trở thành “tự khai”.</p>
    <div class="grid gap-4 sm:grid-cols-2">
      <div class="sm:col-span-2"><label class="field-label" for="audience-group">Nhóm đối tượng (tự khai)</label>
        <select id="audience-group" v-model="state.audience_group" class="field">
          <option v-for="option in audienceOptions" :key="option.value" :value="option.value">{{option.label}}</option>
        </select>
        <p class="mt-1 text-xs text-muted">Nhóm đối tượng chỉ được sử dụng để gợi ý khi thủ tục có thông tin phân loại đã kiểm chứng.</p>
      </div>
      <div><label for="residence-locality" class="field-label">Địa phương thường trú (tự khai)</label>
        <select id="residence-locality" v-model="state.residence_tenant_id" class="field"><option :value="null">Chưa cung cấp</option><option v-for="loc in localities" :key="loc.id" :value="loc.id">{{loc.name}}</option></select></div>
      <div><label for="temporary-locality" class="field-label">Địa phương tạm trú (tự khai)</label>
        <select id="temporary-locality" v-model="state.temporary_tenant_id" class="field"><option :value="null">Chưa cung cấp</option><option v-for="loc in localities" :key="loc.id" :value="loc.id">{{loc.name}}</option></select></div>
      <div class="sm:col-span-2"><label for="preferred-locality" class="field-label">Địa phương bạn ưu tiên khi nộp hồ sơ</label>
        <select id="preferred-locality" v-model="state.preferred_tenant_id" class="field"><option :value="null">Tự gợi ý theo thông tin đã khai</option><option v-for="loc in localities" :key="loc.id" :value="loc.id">{{loc.name}}</option></select>
        <p class="mt-1 flex items-start gap-1 text-xs text-muted"><MapPinned :size="15" class="shrink-0"/>Lựa chọn không tự xác nhận nơi cư trú hay quyền tiếp nhận. Hệ thống chỉ gửi đến địa phương được backend cho phép.</p>
      </div>
    </div>
    <fieldset class="space-y-2"><legend class="field-label">Lĩnh vực bạn quan tâm (chọn tối đa 8)</legend>
      <div class="flex flex-wrap gap-2"><label v-for="category in categories" :key="category" class="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
        <input type="checkbox" :checked="state.interest_categories.includes(category)" :disabled="!state.interest_categories.includes(category)&&state.interest_categories.length>=8" class="accent-blue-700" @change="toggleInterest(category,($event.target as HTMLInputElement).checked)"/>{{category}}
      </label></div>
    </fieldset>
    <p v-if="message" :class="['rounded-lg p-3 text-sm',messageError?'bg-rose-50 text-rose-800':'bg-green-50 text-green-800']" role="status">{{message}}</p>
    <div class="flex flex-wrap gap-2 border-t pt-4"><button type="submit" class="btn-primary" :disabled="saving"><Save :size="16"/>{{saving?'Đang lưu...':'Lưu tùy chọn'}}</button>
      <button type="button" class="btn-outline" :disabled="saving" @click="remove"><Trash2 :size="16"/>Xóa dữ liệu tự khai</button></div>
  </form>
</section>
</template>
