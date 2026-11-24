<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { House, ShieldCheck, UserPlus } from 'lucide-vue-next'
definePageMeta({ layout: 'blank' })
// Người dân tự tạo tài khoản: chọn xã cư trú trong các xã đang hoạt động, đồng ý xử lý dữ liệu cá nhân
// (Nghị định 13/2023/NĐ-CP). Lõi tạo hồ sơ công dân và tài khoản đăng nhập trong một lần.
const { data: tenants, error: tenantsError } = await useFetch<{ code: string; name: string }[]>('/api/auth/registration-tenants', { default: () => [] })
const form = reactive({ fullName: '', username: '', contact: '', tenantCode: '', password: '', confirm: '', consent: false })
const loading = ref(false)
const errorText = ref('')
const done = ref<string | null>(null)

function check(): string {
  if (form.fullName.trim().length < 2) return 'Nhập họ và tên.'
  if (!/^[a-z0-9][a-z0-9._-]{2,49}$/.test(form.username.trim().toLowerCase())) return 'Tên đăng nhập 3–50 ký tự: chữ thường không dấu, số, dấu chấm, gạch.'
  if (!form.contact.trim()) return 'Nhập email hoặc số điện thoại.'
  if (!form.tenantCode) return 'Chọn xã cư trú.'
  if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password)) return 'Mật khẩu tối thiểu 8 ký tự, có cả chữ và số.'
  if (form.password !== form.confirm) return 'Mật khẩu nhập lại không khớp.'
  if (!form.consent) return 'Cần đồng ý cho phép xử lý dữ liệu cá nhân để đăng ký.'
  return ''
}

async function register() {
  errorText.value = check()
  if (errorText.value) return
  loading.value = true
  try {
    const r = await $fetch<{ authenticated: boolean; notice?: string }>('/api/auth/register', {
      method: 'POST',
      body: { fullName: form.fullName, username: form.username, contact: form.contact, tenantCode: form.tenantCode, password: form.password, consent: form.consent },
    })
    if (r.authenticated) {
      await refreshNuxtData('citizen-auth')
      await navigateTo('/')
    } else {
      done.value = r.notice || 'Đã tạo tài khoản. Vui lòng đăng nhập.'
    }
  } catch (e) {
    errorText.value = readableError(e)
  } finally {
    loading.value = false
  }
}
</script>
<template>
  <div class="grid min-h-screen lg:grid-cols-2">
    <div class="hero-gradient relative hidden items-center justify-center overflow-hidden p-12 text-white lg:flex">
      <div class="relative z-10 max-w-lg">
        <span class="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-white/40 bg-white/20"><House :size="45" /></span>
        <h1 class="text-5xl font-black">CommuneOS</h1>
        <p class="mt-4 text-xl font-bold">Cổng dịch vụ hành chính công cấp xã</p>
        <p class="mt-5 text-sm leading-7 text-blue-50">Tạo tài khoản để nộp hồ sơ trực tuyến, theo dõi tiến độ và nhận kết quả.</p>
      </div>
    </div>
    <div class="flex items-center justify-center p-6">
      <div v-if="done" class="panel w-full max-w-md space-y-4 p-7 text-center" role="status">
        <span class="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-green-100 text-green-700"><UserPlus :size="29" /></span>
        <h2 class="text-2xl font-black">Đã tạo tài khoản</h2>
        <p class="text-sm text-muted">{{ done }}</p>
        <NuxtLink to="/dang-nhap" class="btn-primary w-full justify-center">Đến trang đăng nhập</NuxtLink>
      </div>
      <form v-else class="panel w-full max-w-md space-y-4 p-7" novalidate @submit.prevent="register">
        <div class="mb-4 text-center">
          <span class="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-blue-100 text-brand-700"><UserPlus :size="29" /></span>
          <h2 class="text-2xl font-black">Đăng ký tài khoản Công dân</h2>
          <p class="mt-1 text-sm text-muted">Miễn phí, chỉ cần vài phút</p>
        </div>
        <div>
          <label for="reg-name" class="field-label">Họ và tên</label>
          <input id="reg-name" v-model="form.fullName" class="field" required autocomplete="name" maxlength="100" />
        </div>
        <div>
          <label for="reg-username" class="field-label">Tên đăng nhập</label>
          <input id="reg-username" v-model.trim="form.username" class="field" required autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="50" aria-describedby="reg-username-hint" />
          <p id="reg-username-hint" class="mt-1 text-xs text-muted">Chữ thường không dấu, số, dấu chấm hoặc gạch. Ví dụ: nguyenvanan</p>
        </div>
        <div>
          <label for="reg-contact" class="field-label">Email hoặc số điện thoại</label>
          <input id="reg-contact" v-model.trim="form.contact" class="field" required autocomplete="email" maxlength="100" aria-describedby="reg-contact-hint" />
          <p id="reg-contact-hint" class="mt-1 text-xs text-muted">Để xã liên hệ khi xử lý hồ sơ.</p>
        </div>
        <div>
          <label for="reg-tenant" class="field-label">Xã cư trú</label>
          <select id="reg-tenant" v-model="form.tenantCode" class="field" required>
            <option value="" disabled>Chọn xã</option>
            <option v-for="t in tenants" :key="t.code" :value="t.code">{{ t.name }}</option>
          </select>
          <p v-if="tenantsError" class="mt-1 text-xs text-rose-700">Chưa tải được danh sách xã, vui lòng thử lại sau.</p>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label for="reg-password" class="field-label">Mật khẩu</label>
            <input id="reg-password" v-model="form.password" class="field" type="password" required autocomplete="new-password" maxlength="64" aria-describedby="reg-password-hint" />
          </div>
          <div>
            <label for="reg-confirm" class="field-label">Nhập lại mật khẩu</label>
            <input id="reg-confirm" v-model="form.confirm" class="field" type="password" required autocomplete="new-password" maxlength="64" />
          </div>
        </div>
        <p id="reg-password-hint" class="-mt-2 text-xs text-muted">Tối thiểu 8 ký tự, có cả chữ và số.</p>
        <label class="flex items-start gap-2 rounded-lg border p-3 text-xs leading-5 text-slate-700">
          <input v-model="form.consent" type="checkbox" class="mt-0.5 accent-blue-700" required />
          <span>
            Tôi đồng ý để Ủy ban nhân dân xã đã chọn xử lý dữ liệu cá nhân của tôi (họ tên, liên hệ và thông tin trong hồ sơ
            tôi nộp) nhằm giải quyết thủ tục hành chính, theo Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân. Tôi có thể
            xem nhật ký sử dụng dữ liệu và yêu cầu chỉnh sửa trong tài khoản.
          </span>
        </label>
        <p v-if="errorText" role="alert" class="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{{ errorText }}</p>
        <button type="submit" class="btn-primary w-full" :disabled="loading">
          <UserPlus :size="17" />{{ loading ? 'Đang tạo tài khoản...' : 'Đăng ký' }}
        </button>
        <p class="text-center text-sm">Đã có tài khoản? <NuxtLink to="/dang-nhap" class="font-semibold text-brand-700">Đăng nhập</NuxtLink></p>
        <p class="flex items-start gap-1.5 text-xs leading-5 text-muted">
          <ShieldCheck :size="20" class="shrink-0" />Mật khẩu chỉ lưu ở hệ thống định danh (Keycloak), không lưu trong cơ sở dữ liệu hồ sơ.
        </p>
      </form>
    </div>
  </div>
</template>
