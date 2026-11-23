<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# core/db

PostgreSQL 17. `init/` chứa schema và chính sách Row-Level Security cho
prototype Công dân; `seed/seed.sql` nạp dữ liệu minh họa. Role ứng dụng
`communeos_app` là `NOSUPERUSER`; API thiết lập `app.citizen_id` và
`app.tenant_id` ở phạm vi transaction.

`make up` chạy `db-setup` ở mỗi lần khởi động, trên cả volume mới và volume đã có dữ liệu;
`make repair-db` chạy lại riêng bước này. Xem
[`../../docs/CITIZEN_SETUP.md`](../../docs/CITIZEN_SETUP.md).

Lược đồ, RLS, sổ cái và view nằm trong các tệp SQL đánh số ở `init/`; dữ liệu mẫu giả lập ở `seed/`,
kiểm thử RLS (chạy trong transaction rồi `ROLLBACK`) ở `tests/`.

Thứ tự chạy do dịch vụ `db-setup` trong `docker-compose.yml` quyết định, **không** theo thứ tự
tên tệp (ví dụ `seed.sql` chạy trước `02-ai-knowledge.sql`). Thêm tệp migration mới thì phải
thêm một dòng vào `db-setup`; mọi tệp phải chạy lại được nhiều lần (idempotent).

## Lịch sử trợ lý AI

`init/03-citizen-chat-history.sql` mở rộng database bằng hai bảng `citizen_ai_conversations` và `citizen_ai_messages`. Bảng dữ liệu riêng có RLS bắt buộc theo công dân và xã, không được phép ghi vào chỉ mục RAG công khai. Để áp dụng với volume PostgreSQL hiện có: `make repair-db`. Để kiểm tra phân quyền chéo tài khoản và xóa liên đới mà không giữ lại dữ liệu thử: `make chat-history-test`.
