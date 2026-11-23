<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
// Trang "Tài khoản của tôi": gom các chức năng phụ thành 4 nhóm thay cho menu trái dài.
// Giữ nguyên đường dẫn cũ của từng trang để liên kết trong thông báo, tài liệu không bị hỏng.
import { FolderLock, UsersRound, UserRound, BookMarked, CalendarClock, ClipboardList, Route, CalendarDays, ArrowRightLeft, ShieldCheck, Activity, Archive, RefreshCw, Headset, BookOpen, MessageSquare, LayoutDashboard, Search, Layers3, ListChecks, BadgeCheck } from 'lucide-vue-next'
const groups = [
  { title: 'Hồ sơ và giấy tờ', items: [
    { to: '/khong-gian-ca-nhan', name: 'Không gian hành chính', desc: 'Tổng hợp hồ sơ, việc cần làm, nhắc hạn', icon: LayoutDashboard },
    { to: '/kho-giay-to', name: 'Kho giấy tờ số', desc: 'Giấy tờ đã lưu để dùng lại khi nộp hồ sơ', icon: FolderLock },
    { to: '/ho-so-gia-dinh', name: 'Hồ sơ gia đình', desc: 'Hồ sơ của người thân bạn được đại diện', icon: UsersRound },
    { to: '/dai-dien', name: 'Đại diện người thân', desc: 'Đăng ký làm thủ tục thay người thân', icon: UserRound },
    { to: '/so-giao-dich', name: 'Sổ giao dịch', desc: 'Lịch sử các giao dịch hành chính', icon: BookMarked },
    { to: '/kiem-chung-ket-qua', name: 'Kiểm chứng kết quả', desc: 'Kiểm tra kết quả điện tử bằng mã', icon: BadgeCheck },
  ] },
  { title: 'Tìm thủ tục và lịch hẹn', items: [
    { to: '/tim-theo-tinh-huong', name: 'Tìm theo tình huống', desc: 'Mô tả việc cần làm, hệ thống gợi ý thủ tục', icon: Search },
    { to: '/goi-y-thu-tuc', name: 'Tìm thủ tục qua câu hỏi', desc: 'Trả lời vài câu hỏi để được gợi ý', icon: ListChecks },
    { to: '/lien-thong', name: 'Nhóm nhiều thủ tục', desc: 'Chuẩn bị nhiều thủ tục cùng lúc', icon: Layers3 },
    { to: '/lo-trinh-hanh-chinh', name: 'Lộ trình theo nhu cầu', desc: 'Các thủ tục cần làm cho một sự kiện', icon: Route },
    { to: '/lich-hanh-chinh', name: 'Lịch và nhắc việc', desc: 'Hạn nộp, lịch hẹn, việc cần làm', icon: CalendarDays },
    { to: '/lich-hen-mot-cua', name: 'Lịch tại quầy', desc: 'Đặt lịch và lấy số thứ tự', icon: CalendarClock },
    { to: '/lich-tu-van', name: 'Đặt lịch tư vấn', desc: 'Hẹn gặp cán bộ hướng dẫn', icon: CalendarClock },
    { to: '/tai-quay', name: 'Hỗ trợ tại quầy', desc: 'Mã phiên để cán bộ hỗ trợ trực tiếp', icon: ClipboardList },
    { to: '/chuyen-tiep', name: 'Chuyển tiếp tại quầy', desc: 'Chuyển hồ sơ trực tuyến sang nộp tại quầy', icon: ArrowRightLeft },
  ] },
  { title: 'Quyền riêng tư', items: [
    { to: '/bao-mat', name: 'Bảo mật tài khoản', desc: 'Đổi mật khẩu', icon: ShieldCheck },
    { to: '/quyen-chia-se', name: 'Quyền chia sẻ dữ liệu', desc: 'Đồng ý hoặc rút lại việc chia sẻ', icon: ShieldCheck },
    { to: '/nhat-ky-du-lieu', name: 'Nhật ký sử dụng dữ liệu', desc: 'Ai đã xem dữ liệu của bạn, khi nào', icon: Activity },
    { to: '/vong-doi-du-lieu', name: 'Vòng đời dữ liệu', desc: 'Thời hạn lưu trữ, yêu cầu xóa', icon: Archive },
    { to: '/dong-bo-du-lieu', name: 'Đồng bộ dữ liệu', desc: 'Yêu cầu đồng bộ giữa các địa phương', icon: RefreshCw },
  ] },
  { title: 'Hỗ trợ', items: [
    { to: '/yeu-cau-ho-tro', name: 'Theo dõi hỗ trợ', desc: 'Các yêu cầu hỗ trợ đã gửi', icon: Headset },
    { to: '/lien-he', name: 'Liên hệ và phản hồi', desc: 'Gửi góp ý, báo lỗi', icon: MessageSquare },
    { to: '/huong-dan', name: 'Hướng dẫn sử dụng', desc: 'Cách nộp hồ sơ, theo dõi, nhận kết quả', icon: BookOpen },
  ] },
]
</script>

<template>
  <div class="space-y-8">
    <section v-for="g in groups" :key="g.title" :aria-labelledby="`nhom-${g.title}`">
      <h2 :id="`nhom-${g.title}`" class="mb-3 text-lg font-semibold text-ink">{{ g.title }}</h2>
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <NuxtLink v-for="item in g.items" :key="item.to" :to="item.to" class="panel flex items-start gap-3 p-4 transition hover:border-brand-300 hover:bg-brand-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300">
          <span class="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700"><component :is="item.icon" :size="20" /></span>
          <span class="min-w-0"><span class="block font-semibold text-ink">{{ item.name }}</span><span class="mt-0.5 block text-sm text-slate-600">{{ item.desc }}</span></span>
        </NuxtLink>
      </div>
    </section>
    <p class="text-sm text-slate-600">Dữ liệu trong bản trình diễn là dữ liệu giả lập, không phải hồ sơ hành chính có giá trị pháp lý.</p>
  </div>
</template>
