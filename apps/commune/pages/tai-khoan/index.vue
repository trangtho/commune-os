<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { Users, UserPlus, Lock, Unlock, KeyRound, History, Pencil, Trash2 } from 'lucide-vue-next'
import type { Staff, StaffAudit } from '~/types/models'
import { PROFILE_FIELDS } from '~/types/staff'

// Lãnh đạo xã quản lý tài khoản cán bộ xử lý của xã mình.
// Tài khoản nằm ở Keycloak; trang này gọi dịch vụ tài khoản của lõi qua /api/staff.
const { data: staff, error, refresh } = await useFetch<Staff[]>('/api/staff', { key: 'staff-list' })
const { data: audit, refresh: refreshAudit } = await useFetch<StaffAudit[]>('/api/staff/audit', {
  key: 'staff-audit',
  default: () => [],
})
const { dateTime } = useFormat()

const form = reactive({ username: '', lastName: '', firstName: '', email: '' })
// Thông tin công vụ ban đầu (không bắt buộc), lưu vào hồ sơ nhân viên ngay sau khi tạo tài khoản.
const work = reactive({ staff_code: '', position: '', department: '', phone: '' })
const workFields = PROFILE_FIELDS.filter((f) => ['staff_code', 'position', 'department', 'phone'].includes(f.key))
const busy = ref('')
const message = ref('')
// Mật khẩu tạm chỉ hiện một lần, ngay sau khi tạo hoặc cấp lại.
const secret = ref<{ username: string; password: string } | null>(null)

const ACTIONS: Record<StaffAudit['action'], string> = {
  create: 'tạo tài khoản',
  lock: 'khóa tài khoản',
  unlock: 'mở khóa tài khoản',
  reset_password: 'cấp lại mật khẩu cho',
  update: 'sửa thông tin tài khoản',
  delete: 'xóa tài khoản',
}

async function done(text: string) {
  message.value = text
  await Promise.all([refresh(), refreshAudit()])
}

async function createStaff() {
  if (busy.value) return
  busy.value = 'create'
  message.value = ''
  secret.value = null
  try {
    const r = await $fetch<{ id: string; username: string; temporaryPassword: string }>('/api/staff', { method: 'POST', body: { ...form } })
    secret.value = { username: r.username, password: r.temporaryPassword }
    let note = ''
    if (Object.values(work).some((v) => v.trim())) {
      try {
        await $fetch(`/api/management/profiles/${r.id}`, {
          method: 'PUT',
          body: { ...work, full_name: `${form.lastName} ${form.firstName}`.trim(), work_email: form.email },
        })
      } catch {
        note = ' Chưa lưu được thông tin công vụ, hãy nhập lại ở mục Hồ sơ nhân viên.'
      }
    }
    Object.assign(form, { username: '', lastName: '', firstName: '', email: '' })
    Object.assign(work, { staff_code: '', position: '', department: '', phone: '' })
    await done(`Đã tạo tài khoản ${r.username}.${note}`)
  } catch (e) {
    message.value = readableError(e)
  } finally {
    busy.value = ''
  }
}

async function setEnabled(s: Staff, enabled: boolean) {
  if (busy.value) return
  busy.value = s.id
  message.value = ''
  secret.value = null
  try {
    await $fetch(`/api/staff/${s.id}/status`, { method: 'PATCH', body: { enabled } })
    await done(`${enabled ? 'Đã mở khóa' : 'Đã khóa'} tài khoản ${s.username}.`)
  } catch (e) {
    message.value = readableError(e)
  } finally {
    busy.value = ''
  }
}

// Sửa họ tên, email tài khoản (dùng lại form bên phải).
const editId = ref('')
function startEdit(s: Staff) {
  editId.value = s.id
  Object.assign(form, { username: s.username, lastName: s.lastName, firstName: s.firstName, email: s.email || '' })
  message.value = ''
}
function stopEdit() {
  editId.value = ''
  Object.assign(form, { username: '', lastName: '', firstName: '', email: '' })
}
async function saveEdit() {
  if (busy.value) return
  busy.value = 'create'
  try {
    await $fetch(`/api/staff/${editId.value}`, { method: 'PATCH', body: { lastName: form.lastName, firstName: form.firstName, email: form.email } })
    const name = form.username
    stopEdit()
    await done(`Đã sửa thông tin tài khoản ${name}.`)
  } catch (e) {
    message.value = readableError(e)
  } finally {
    busy.value = ''
  }
}

// Xóa hẳn tài khoản: lõi chỉ cho xóa khi đã khóa. Hồ sơ cá nhân, việc đã giao và nhật ký vẫn còn.
async function removeStaff(s: Staff) {
  if (busy.value || !confirm(`Xóa hẳn tài khoản ${s.username}? Không khôi phục được. Hồ sơ cá nhân và nhật ký vẫn được giữ.`)) return
  busy.value = s.id
  message.value = ''
  try {
    await $fetch(`/api/staff/${s.id}`, { method: 'DELETE' })
    await done(`Đã xóa tài khoản ${s.username}.`)
  } catch (e) {
    message.value = readableError(e)
  } finally {
    busy.value = ''
  }
}

async function resetPassword(s: Staff) {
  if (busy.value) return
  busy.value = s.id
  message.value = ''
  secret.value = null
  try {
    const r = await $fetch<{ username: string; temporaryPassword: string }>(`/api/staff/${s.id}/reset-password`, { method: 'POST' })
    secret.value = { username: r.username, password: r.temporaryPassword }
    await done(`Đã cấp mật khẩu tạm mới cho ${r.username}.`)
  } catch (e) {
    message.value = readableError(e)
  } finally {
    busy.value = ''
  }
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <h2 class="text-xl font-black">Quản lý cán bộ của xã</h2>
      <p class="text-sm text-muted">
        Lãnh đạo xã tạo, sửa, khóa, mở, cấp lại mật khẩu và xóa tài khoản cán bộ xử lý (muốn xóa phải khóa trước). Tài khoản lãnh đạo do quản trị hệ thống cấp.
      </p>
    </div>

    <div v-if="error" class="panel p-5 text-rose-700">
      {{ error.statusCode === 403 ? 'Chỉ lãnh đạo xã được quản lý cán bộ.' : readableError(error) }}
    </div>

    <template v-else>
      <p v-if="message" role="status" class="rounded-lg bg-brand-50 p-3 text-sm text-brand-800">{{ message }}</p>
      <div v-if="secret" role="alert" class="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <p class="font-bold">Mật khẩu tạm của {{ secret.username }}: <code class="text-base">{{ secret.password }}</code></p>
        <p class="mt-1">
          Mật khẩu chỉ hiện một lần. Chuyển trực tiếp cho cán bộ; lần đăng nhập đầu, cán bộ phải đặt mật khẩu mới.
        </p>
      </div>

      <div class="grid gap-4 lg:grid-cols-3">
        <section class="panel p-5 lg:col-span-2">
          <h3 class="section-label"><Users :size="20" class="text-brand-600" />Cán bộ ({{ staff?.length || 0 }})</h3>
          <div class="overflow-x-auto">
            <table class="w-full min-w-[560px] text-left text-sm">
              <thead class="text-muted">
                <tr>
                  <th scope="col" class="py-2">Họ tên</th>
                  <th scope="col" class="py-2">Tài khoản</th>
                  <th scope="col" class="py-2">Vai trò</th>
                  <th scope="col" class="py-2">Trạng thái</th>
                  <th scope="col" class="py-2 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in staff" :key="s.id" class="border-t">
                  <td class="py-2 font-semibold">{{ s.lastName }} {{ s.firstName }} <small v-if="s.isMe" class="text-muted">(bạn)</small></td>
                  <td class="py-2"><code>{{ s.username }}</code></td>
                  <td class="py-2">{{ s.role === 'leader' ? 'Lãnh đạo' : 'Cán bộ xử lý' }}</td>
                  <td class="py-2">
                    <span :class="s.enabled ? 'text-green-700' : 'text-rose-700'">{{ s.enabled ? 'Đang hoạt động' : 'Đã khóa' }}</span>
                  </td>
                  <td class="py-2 text-right">
                    <div v-if="s.manageable" class="inline-flex gap-1">
                      <button
                        type="button"
                        class="btn-outline !p-2"
                        :disabled="busy === s.id"
                        :aria-label="s.enabled ? `Khóa ${s.username}` : `Mở khóa ${s.username}`"
                        :title="s.enabled ? 'Khóa tài khoản' : 'Mở khóa'"
                        @click="setEnabled(s, !s.enabled)"
                      >
                        <Lock v-if="s.enabled" :size="16" /><Unlock v-else :size="16" />
                      </button>
                      <button
                        type="button"
                        class="btn-outline !p-2"
                        :disabled="busy === s.id"
                        :aria-label="`Sửa thông tin ${s.username}`"
                        title="Sửa thông tin"
                        @click="startEdit(s)"
                      >
                        <Pencil :size="16" />
                      </button>
                      <button
                        v-if="!s.enabled"
                        type="button"
                        class="btn-outline !p-2 !text-rose-700"
                        :disabled="busy === s.id"
                        :aria-label="`Xóa tài khoản ${s.username}`"
                        title="Xóa tài khoản (đã khóa)"
                        @click="removeStaff(s)"
                      >
                        <Trash2 :size="16" />
                      </button>
                      <button
                        type="button"
                        class="btn-outline !p-2"
                        :disabled="busy === s.id"
                        :aria-label="`Cấp lại mật khẩu cho ${s.username}`"
                        title="Cấp lại mật khẩu"
                        @click="resetPassword(s)"
                      >
                        <KeyRound :size="16" />
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="panel p-5">
          <h3 class="section-label"><UserPlus :size="20" class="text-brand-600" />{{ editId ? 'Sửa thông tin tài khoản' : 'Thêm cán bộ xử lý' }}</h3>
          <form class="space-y-3" @submit.prevent="editId ? saveEdit() : createStaff()">
            <div>
              <label class="field-label" for="st-username">Tên đăng nhập</label>
              <input id="st-username" v-model="form.username" class="field" :disabled="!!editId" required minlength="3" maxlength="50" placeholder="vd: canbo3.xa-a" />
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="field-label" for="st-last">Họ</label>
                <input id="st-last" v-model="form.lastName" class="field" required maxlength="60" />
              </div>
              <div>
                <label class="field-label" for="st-first">Tên</label>
                <input id="st-first" v-model="form.firstName" class="field" required maxlength="60" />
              </div>
            </div>
            <div>
              <label class="field-label" for="st-email">Email công vụ (không bắt buộc)</label>
              <input id="st-email" v-model="form.email" type="email" class="field" />
            </div>
            <template v-if="!editId">
              <p class="text-xs font-semibold uppercase text-muted">Thông tin công vụ (không bắt buộc)</p>
              <ProfileFieldInput v-for="f in workFields" :key="f.key" v-model="work[f.key as keyof typeof work]" :field="f" id-prefix="st" />
              <p class="text-xs text-muted">Các thông tin khác (giới tính, ngày sinh, trình độ, lĩnh vực phụ trách...) nhập ở mục Hồ sơ nhân viên.</p>
            </template>
            <button type="submit" class="btn-primary w-full" :disabled="busy === 'create'">
              {{ busy === 'create' ? 'Đang lưu...' : editId ? 'Lưu thay đổi' : 'Tạo tài khoản' }}
            </button>
            <button v-if="editId" type="button" class="btn-outline w-full" @click="stopEdit">Hủy sửa</button>
            <p class="text-xs text-muted">Không dùng thông tin cá nhân thật khi chạy thử.</p>
          </form>
        </section>
      </div>

      <section class="panel p-5">
        <h3 class="section-label"><History :size="20" class="text-brand-600" />Nhật ký quản lý cán bộ</h3>
        <p v-if="!audit?.length" class="text-sm text-muted">Chưa có thao tác nào.</p>
        <ul v-else class="space-y-1 text-sm">
          <li v-for="(a, i) in audit" :key="i">
            <span class="text-muted">{{ dateTime(a.created_at) }}</span> ·
            <b>{{ a.actor }}</b> {{ ACTIONS[a.action] }} <code>{{ a.target_username }}</code>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
