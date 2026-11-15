<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# Tóm tắt thay đổi của bản kênh Công dân

- Không xóa hay thay thế nội dung `core/`, `packs/`, `apps/commune/` đã có.
- Bổ sung Nuxt/TypeScript/Tailwind trong `apps/citizen/`, gồm layout chung,
  các component tái sử dụng, 16 route Vue (bao phủ 18 chức năng/giao diện
  mẫu, trong đó một số là bước wizard chung).
- Bổ sung REST API Nitro cho Công dân, đăng nhập demo ký cookie, upload file,
  kiểm tra Poka-yoke phía server và kiểm soát quyền sở hữu tài nguyên.
- Bổ sung SQL schema, seed 2 tenant/2 công dân, RLS và kiểm tra hai xã.
- Cập nhật docker compose, Makefile, README, DEPENDENCIES, CHANGELOG.
- Kèm ba ảnh giao diện người dùng đã lựa chọn trong `docs/ui-references/`.

Chi tiết cách chạy: `docs/CITIZEN_SETUP.md`.
Tình trạng kiểm chứng: `docs/VALIDATION_REPORT.md`.
