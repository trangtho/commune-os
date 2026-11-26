// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
type AdminInfo = { authenticated: boolean; username: string; isSysAdmin: boolean }
const empty = (): AdminInfo => ({authenticated: false, username: '', isSysAdmin: false})
export function useAuth() {
  const info = useState<AdminInfo>('admin-session', empty)
  const username = computed(() => info.value.username)
  const isSysAdmin = computed(() => info.value.isSysAdmin)
  const isLoggedIn = computed(() => info.value.authenticated)
  async function check() {
    try {
      info.value = await $fetch<AdminInfo>('/api/auth/me', {credentials: 'same-origin'})
    } catch (error: any) {
      const status = error?.statusCode ?? error?.response?.status
      if (status === 401 || status === 403) info.value = empty()
      else throw createError({statusCode: 503, statusMessage: 'Chưa kiểm tra được phiên đăng nhập, vui lòng tải lại trang'})
    }
  }
  async function login(user: string, password: string, otp = ''): Promise<string | null> {
    try {
      info.value = await $fetch<AdminInfo>('/api/dang-nhap', {method: 'POST', body: {username: user, password, otp}})
      return info.value.authenticated && info.value.isSysAdmin ? null : 'Tài khoản không có quyền quản trị.'
    } catch (e: any) { return e?.data?.statusMessage || e?.statusMessage || 'Không đăng nhập được.' }
  }
  async function logout() {
    await $fetch('/api/auth/logout', {method: 'POST'})
    info.value = empty()
    return navigateTo('/dang-nhap')
  }
  return {username, isSysAdmin, isLoggedIn, check, login, logout}
}
