<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Khung ngoài cố định (citizen-app-shell bị overflow: clip trong main.css) và vùng cuộn riêng bên trong, như layout
     mặc định. Gộp hai vai trò vào một thẻ thì clip đè overflow-y-auto: trang dài (đăng ký) không cuộn được trên màn hình rộng. -->
<template><div class="citizen-app-shell"><main class="citizen-inner-scroll scrollbar-hide h-full min-h-0 overflow-x-hidden overflow-y-auto overscroll-contain" tabindex="0" aria-label="Nội dung đăng nhập"><slot/></main></div></template>
