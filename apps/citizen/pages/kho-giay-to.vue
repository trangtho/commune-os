<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { Archive, ArrowLeft, CheckCircle2, Clock3, CloudUpload, Download, FileClock, FilePlus2, FileSearch, Files, FolderLock, History, Pencil, RotateCcw, Search, ShieldCheck, X } from 'lucide-vue-next'
import { vaultCategories,vaultIsUsable,todayVietnam } from '~/shared/citizen-vault'
type VaultVersion={id:string;version_no:number;original_name:string;mime_type:string;size_bytes:number;sha256:string;expires_on:string|null;uploaded_at:string}
type VaultDocument={id:string;title:string;category:string;archived_at:string|null;created_at:string;versions:VaultVersion[]}
type VaultShare={id:string;version_id:string;application_id:string;document_code:string;confirmed_at:string;title:string;version_no:number;procedure_id:string}
const {data,error,refresh,pending}=await useFetch<{documents:VaultDocument[];shares:VaultShare[]}>('/api/citizen/vault',{key:'citizen-vault',default:()=>({documents:[],shares:[]})})
const query=ref('');const category=ref('all');const includeArchived=ref(false);const busy=ref(false)
const notice=ref('');const failure=ref('');const showForm=ref(false)
const editId=ref('');const editTitle=ref('');const editCategory=ref('other')
const upload=reactive({documentId:'',title:'',category:'identity',expiresOn:''});const selectedFile=ref<File|null>(null)
const now=todayVietnam()
const allDocuments=computed(()=>data.value?.documents??[])
const shares=computed(()=>data.value?.shares??[])
const docs=computed(()=>allDocuments.value.filter(doc=>{
 if(doc.archived_at&&!includeArchived.value)return false
 if(category.value!=='all'&&doc.category!==category.value)return false
 return [doc.title,...doc.versions.map(v=>v.original_name)].join(' ').toLocaleLowerCase('vi').includes(query.value.toLocaleLowerCase('vi').trim())
}))
const currentDocs=computed(()=>allDocuments.value.filter(d=>!d.archived_at).length)
const versionCount=computed(()=>allDocuments.value.reduce((acc,d)=>acc+d.versions.length,0))
function categoryName(code:string){return vaultCategories.find(c=>c.value===code)?.label||'Khác'}
function shortDate(date:string|null){return date?new Date(date).toLocaleDateString('vi-VN'):'Không giới hạn'}
function filesize(bytes:number){return bytes<1024*1024?`${(bytes/1024).toFixed(1)} KB`:`${(bytes/1024/1024).toFixed(2)} MB`}
function startNew(){upload.documentId='';upload.title='';upload.category='identity';upload.expiresOn='';selectedFile.value=null;showForm.value=true;notice.value='';failure.value=''}
function addVersion(doc:VaultDocument){upload.documentId=doc.id;upload.title=doc.title;upload.category=doc.category;upload.expiresOn='';selectedFile.value=null;showForm.value=true;notice.value='';failure.value=''}
function fileChanged(event:Event){selectedFile.value=(event.target as HTMLInputElement).files?.[0]||null}
async function uploadFile(){
 if(!selectedFile.value||busy.value)return
 failure.value='';notice.value='';busy.value=true
 try{
  const form=new FormData();form.set('file',selectedFile.value)
  if(upload.documentId)form.set('documentId',upload.documentId)
  else{form.set('title',upload.title.trim());form.set('category',upload.category)}
  if(upload.expiresOn)form.set('expiresOn',upload.expiresOn)
  await $fetch('/api/citizen/vault',{method:'POST',body:form})
  await refresh();showForm.value=false;selectedFile.value=null
  notice.value='Giấy tờ đã lưu thành công vào kho cá nhân.'
 }catch(e){failure.value=readableError(e)}finally{busy.value=false}
}
function beginEdit(doc:VaultDocument){editId.value=doc.id;editTitle.value=doc.title;editCategory.value=doc.category;failure.value=''}
async function patchDoc(id:string,body:Record<string,unknown>,message:string){
 if(busy.value)return
 busy.value=true;failure.value='';notice.value=''
 try{await $fetch(`/api/citizen/vault/${encodeURIComponent(id)}`,{method:'PATCH',body});await refresh();editId.value='';notice.value=message}
 catch(e){failure.value=readableError(e)}finally{busy.value=false}
}
async function saveEdit(){await patchDoc(editId.value,{title:editTitle.value,category:editCategory.value},'Đã cập nhật thông tin giấy tờ.')}
async function changeExpiry(v:VaultVersion){
 const value=prompt('Ngày hết hạn mới (YYYY-MM-DD), để trống nếu không có:',v.expires_on||'')
 if(value===null||busy.value)return
 busy.value=true;failure.value='';notice.value=''
 try{await $fetch(`/api/citizen/vault/versions/${v.id}`,{method:'PATCH',body:{expiresOn:value.trim()||null}});await refresh();notice.value='Đã cập nhật thời hạn sử dụng.'}
 catch(e){failure.value=readableError(e)}finally{busy.value=false}
}
</script>
<template>
<div class="space-y-5">
 <div class="flex flex-wrap items-start justify-between gap-4"><div><NuxtLink to="/ho-so-ca-nhan" class="mb-2 inline-flex items-center gap-1 text-xs font-bold text-brand-700"><ArrowLeft :size="15"/> Hồ sơ cá nhân</NuxtLink><h2 class="text-2xl font-black text-brand-900">Kho giấy tờ số cá nhân</h2><p class="mt-1 max-w-2xl text-sm text-muted">Lưu một lần, quản lý phiên bản và chủ động chia sẻ giấy tờ phù hợp khi nộp hồ sơ.</p></div><button class="btn-primary" @click="startNew"><FilePlus2 :size="17"/>Thêm giấy tờ</button></div>
 <div class="grid gap-3 sm:grid-cols-3"><div class="panel flex items-center gap-3 p-4"><FolderLock class="text-brand-600" :size="25"/><div><p class="text-2xl font-black">{{currentDocs}}</p><p class="text-xs text-muted">Nhóm giấy tờ đang sử dụng</p></div></div><div class="panel flex items-center gap-3 p-4"><Files class="text-brand-600" :size="25"/><div><p class="text-2xl font-black">{{versionCount}}</p><p class="text-xs text-muted">Phiên bản đã lưu</p></div></div><div class="panel flex items-center gap-3 p-4"><ShieldCheck class="text-green-600" :size="25"/><div><p class="text-2xl font-black">{{shares.length}}</p><p class="text-xs text-muted">Lượt chia sẻ gần đây</p></div></div></div>
 <div class="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm leading-6 text-blue-900"><ShieldCheck class="mr-1 inline" :size="17"/>Chỉ tài khoản của bạn được xem kho giấy tờ. Chia sẻ sang hồ sơ cần xác nhận riêng từng lần; tài liệu gốc không bị thay đổi. Dữ liệu đang ở môi trường demo, không tải giấy tờ thật.</div>
 <section v-if="showForm" class="panel space-y-4 border-blue-200 p-4 sm:p-5" aria-label="Tải giấy tờ vào kho"><div class="flex items-center justify-between gap-2"><h3 class="text-lg font-extrabold text-brand-900">{{upload.documentId?'Tải phiên bản mới':'Thêm giấy tờ mới'}}</h3><button class="btn-outline !px-2 !py-1" type="button" @click="showForm=false"><X :size="17"/>Đóng</button></div>
  <form class="space-y-4" @submit.prevent="uploadFile"><div v-if="upload.documentId" class="rounded-lg bg-blue-50 p-3 text-sm font-semibold">{{upload.title}} · sẽ được lưu thành phiên bản kế tiếp</div><div v-else class="grid gap-3 sm:grid-cols-2"><div><label for="vault-title" class="field-label">Tên giấy tờ *</label><input id="vault-title" v-model="upload.title" class="field" required minlength="2" maxlength="120" placeholder="Ví dụ: Bản sao giấy khai sinh"/></div><div><label for="vault-category" class="field-label">Phân loại *</label><select id="vault-category" v-model="upload.category" class="field"><option v-for="cat in vaultCategories" :key="cat.value" :value="cat.value">{{cat.label}}</option></select></div></div>
   <div class="grid gap-3 sm:grid-cols-2"><div><label for="vault-file" class="field-label">Tệp PDF / PNG / JPG, tối đa 5 MB *</label><input id="vault-file" type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" class="field !py-2" required @change="fileChanged"/><p v-if="selectedFile" class="mt-1 break-all text-xs text-muted">{{selectedFile.name}} · {{filesize(selectedFile.size)}}</p></div><div><label for="vault-expiry" class="field-label">Ngày hết hạn (nếu có)</label><input id="vault-expiry" v-model="upload.expiresOn" type="date" class="field"/><p class="mt-1 text-xs text-muted">Tệp hết hạn không được dùng để bổ sung hồ sơ mới.</p></div></div>
   <div class="flex justify-end"><button class="btn-primary" type="submit" :disabled="busy||!selectedFile"><CloudUpload :size="16"/>{{busy?'Đang lưu...':'Lưu vào kho'}}</button></div></form></section>
 <p v-if="notice" class="rounded-lg bg-green-50 p-3 text-sm text-green-800" role="status">{{notice}}</p><p v-if="failure" class="rounded-lg bg-rose-50 p-3 text-sm text-rose-700" role="alert">{{failure}}</p>
 <section class="panel space-y-3 p-4"><div class="flex flex-wrap items-center gap-3"><div class="relative min-w-[190px] flex-1"><Search class="absolute left-3 top-3 text-slate-400" :size="17"/><input v-model="query" class="field !pl-10" placeholder="Tìm theo tên giấy tờ, tệp..." aria-label="Tìm giấy tờ"/></div><select v-model="category" class="field !w-full sm:!w-48" aria-label="Lọc theo phân loại"><option value="all">Tất cả nhóm</option><option v-for="cat in vaultCategories" :key="cat.value" :value="cat.value">{{cat.label}}</option></select></div><label class="flex items-center gap-2 text-xs font-semibold text-slate-600"><input v-model="includeArchived" type="checkbox"/>Hiện cả giấy tờ đã lưu trữ</label></section>
 <p v-if="error" class="rounded-lg bg-rose-50 p-4 text-sm text-rose-700" role="alert">Không thể tải kho giấy tờ. Hãy kiểm tra dịch vụ và thử lại.</p><p v-else-if="pending" class="p-5 text-sm text-muted">Đang tải kho giấy tờ...</p>
 <section v-else-if="!docs.length" class="panel flex flex-col items-center gap-3 p-10 text-center"><FileSearch :size="36" class="text-brand-500"/><h3 class="font-extrabold">Chưa tìm thấy giấy tờ</h3><p class="text-sm text-muted">Thêm giấy tờ PDF hoặc hình ảnh để dùng lại trong các thủ tục tiếp theo.</p><button type="button" class="btn-primary" @click="startNew"><FilePlus2 :size="15"/>Thêm giấy tờ</button></section>
 <section v-else class="space-y-3" aria-label="Danh sách giấy tờ"><article v-for="doc in docs" :key="doc.id" class="panel space-y-3 p-4 sm:p-5"><div class="flex flex-wrap items-start gap-3"><span class="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><Files :size="24"/></span><div class="min-w-0 flex-1"><h3 class="break-words font-extrabold text-brand-900">{{doc.title}}</h3><p class="mt-1 text-xs text-muted">{{categoryName(doc.category)}} · {{doc.versions.length}} phiên bản · Tạo {{shortDate(doc.created_at)}}</p><span v-if="doc.archived_at" class="mt-2 inline-block rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">Đã lưu trữ – không thể chia sẻ</span></div><div class="flex flex-wrap gap-2"><button v-if="!doc.archived_at" class="btn-outline !px-3 !py-2 !text-xs" type="button" @click="addVersion(doc)"><FilePlus2 :size="14"/> Phiên bản mới</button><button class="btn-outline !px-3 !py-2 !text-xs" type="button" @click="beginEdit(doc)"><Pencil :size="14"/>Sửa</button><button class="btn-outline !px-3 !py-2 !text-xs" type="button" :disabled="busy" @click="patchDoc(doc.id,{archived:!doc.archived_at},doc.archived_at?'Đã đưa giấy tờ trở lại kho.':'Đã chuyển giấy tờ sang trạng thái lưu trữ.')"><RotateCcw v-if="doc.archived_at" :size="14"/><Archive v-else :size="14"/>{{doc.archived_at?'Khôi phục':'Lưu trữ'}}</button></div></div>
  <form v-if="editId===doc.id" class="grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-[1fr_180px_auto]" @submit.prevent="saveEdit"><input v-model="editTitle" class="field" required minlength="2" maxlength="120" aria-label="Tên giấy tờ"/><select v-model="editCategory" class="field" aria-label="Phân loại giấy tờ"><option v-for="cat in vaultCategories" :key="cat.value" :value="cat.value">{{cat.label}}</option></select><div class="flex gap-2"><button type="submit" :disabled="busy" class="btn-primary !px-3">Lưu</button><button type="button" class="btn-outline !px-3" @click="editId=''">Hủy</button></div></form>
  <div class="space-y-2"><div v-for="v in doc.versions" :key="v.id" class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs"><div class="min-w-0 flex-1"><p class="break-all font-semibold text-slate-800">Phiên bản {{v.version_no}} · {{v.original_name}}</p><p class="mt-1 text-muted">{{filesize(v.size_bytes)}} · {{shortDate(v.uploaded_at)}} · <span :class="vaultIsUsable(doc.archived_at,v.expires_on,now)?'text-green-700':'text-amber-700'">{{v.expires_on?'Hạn '+shortDate(v.expires_on):'Không có ngày hết hạn'}}</span></p></div><div class="flex gap-2"><a :href="`/api/citizen/vault/files/${v.id}?view=1`" target="_blank" rel="noopener noreferrer" class="btn-outline !px-2 !py-1.5 !text-xs"><Download :size="13"/>Xem</a><button v-if="!doc.archived_at" type="button" class="btn-outline !px-2 !py-1.5 !text-xs" @click="changeExpiry(v)"><FileClock :size="13"/>Thời hạn</button></div></div></div>
 </article></section>
 <section class="panel space-y-3 p-4 sm:p-5"><h3 class="flex items-center gap-2 font-extrabold text-brand-900"><History :size="19"/>Lịch sử chia sẻ với hồ sơ</h3><p class="text-xs text-muted">Chỉ phát sinh khi bạn chủ động xác nhận dùng một phiên bản giấy tờ cho hồ sơ cụ thể. Hiển thị tối đa 100 lượt gần nhất.</p><p v-if="!shares.length" class="rounded-lg bg-slate-50 p-3 text-sm text-muted">Chưa có lượt chia sẻ nào.</p><div v-else class="space-y-2"><div v-for="share in shares" :key="share.id" class="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 text-sm"><div><p class="font-semibold">{{share.title}} · Phiên bản {{share.version_no}}</p><p class="text-xs text-muted">Mã loại: {{share.document_code}} · {{shortDate(share.confirmed_at)}}</p></div><NuxtLink :to="`/ho-so/${encodeURIComponent(share.application_id)}`" class="text-xs font-bold text-brand-700 underline">Hồ sơ {{share.application_id}}</NuxtLink></div></div></section>
</div>
</template>
