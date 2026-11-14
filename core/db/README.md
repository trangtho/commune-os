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

Lược đồ, RLS, sổ cái và view. Tệp SQL đánh số trong migrations/, dữ liệu mẫu giả lập trong seed/.

## Lịch sử trợ lý AI

`init/03-citizen-chat-history.sql` mở rộng database bằng hai bảng `citizen_ai_conversations` và `citizen_ai_messages`. Bảng dữ liệu riêng có RLS bắt buộc theo công dân và xã, không được phép ghi vào chỉ mục RAG công khai. Để áp dụng với volume PostgreSQL hiện có: `make repair-db`. Để kiểm tra phân quyền chéo tài khoản và xóa liên đới mà không giữ lại dữ liệu thử: `make chat-history-test`.
