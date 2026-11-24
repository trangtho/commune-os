// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Cập nhật giao diện khi người khác thay đổi dữ liệu (đề nghị mới chờ duyệt, kết quả phê duyệt, việc được giao,
// tài khoản nhân viên, thông báo) mà không cần F5: tải lại mọi dữ liệu của trang đang mở mỗi `intervalMs` khi tab đang
// hiển thị, và ngay khi người dùng quay lại tab / cửa sổ. Tab ẩn thì dừng. Dữ liệu chỉ được thay khi tải xong; các biểu
// mẫu đang nhập giữ bản nháp riêng nên không bị ghi đè.
export function useAutoRefresh(enabled: () => boolean, intervalMs = 15000) {
  if (import.meta.server) return
  let timer: ReturnType<typeof setInterval> | undefined
  let running = false
  async function tick() {
    if (!enabled() || document.visibilityState !== 'visible' || running) return
    running = true
    try { await refreshNuxtData() } catch { /* lỗi mạng tạm thời: lần sau thử lại */ } finally { running = false }
  }
  const onVisible = () => { if (document.visibilityState === 'visible') void tick() }
  onMounted(() => {
    timer = setInterval(tick, intervalMs)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
  })
  onBeforeUnmount(() => {
    if (timer) clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('focus', onVisible)
  })
}
