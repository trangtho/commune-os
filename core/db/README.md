<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# core/db

PostgreSQL 17. `init/` chứa schema và chính sách Row-Level Security cho
prototype Công dân; `seed/seed.sql` nạp dữ liệu minh họa. Role ứng dụng
`communeos_app` là `NOSUPERUSER`; API thiết lập `app.citizen_id` và
`app.tenant_id` ở phạm vi transaction.

Để demo hoạt động, khởi tạo trên volume mới bằng `make up`; schema init
không tự chạy lại trên volume PostgreSQL đã có dữ liệu. Xem
[`../../docs/CITIZEN_SETUP.md`](../../docs/CITIZEN_SETUP.md).
