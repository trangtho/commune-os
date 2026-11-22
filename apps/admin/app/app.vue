<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->
<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<style>
/* Hình nền trống đồng, hoa sen của dự án cho mọi trang; khung nội dung giữ nền trắng để dễ đọc. */
body {
  background-color: #f8fafc;
  background-image: url('/images/nen-trong-dong.webp');
  background-position: center bottom;
  background-size: cover;
  background-repeat: no-repeat;
  background-attachment: fixed;
}
@media print { body { background: white; } }
</style>
