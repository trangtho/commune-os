<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# modules/xa – Gói nghiệp vụ chính quyền cấp xã

Ứng dụng minh họa chính chạy trên lõi CommuneOS: bộ phận một cửa cấp xã, Kênh người dân, màn hình cán bộ xã.
Mỗi xã là một đơn vị của lõi. Gói chỉ dựa vào phần lõi dùng chung (đơn vị, hàm đọc token, quy trình, sổ ghi nhận,
tệp, tài khoản), xem [docs/LOI_DUNG_CHUNG.md](../../docs/LOI_DUNG_CHUNG.md).

| Thư mục, tệp | Nội dung |
| --- | --- |
| [`module.json`](module.json) | Khai báo gói: thứ tự tệp SQL, quy trình hồ sơ (`/workflow/dossiers`), việc định kỳ |
| `db/` | Công dân, thủ tục, hồ sơ, giấy tờ, thông báo, cán bộ xã, API của Kênh người dân (`*.sql`); danh mục thủ tục mẫu (`seed.sql`) |
| `db/tests/` | Kiểm thử SQL của gói (chạy trong transaction rồi `ROLLBACK`), `make test-sql` |
| `bpmn/` | Quy trình xử lý hồ sơ `xu-ly-ho-so` |
| `demo/` | Dữ liệu mẫu tạo qua API của lõi: 2 xã, lãnh đạo, cán bộ, công dân, hồ sơ (`make demo`) |
| [`packs/`](packs/README.md) | Gói thủ tục (`pack.yaml`) nạp qua bảng quản trị |

Ứng dụng của gói nằm ở `apps/`: `apps/citizen` (Kênh người dân), `apps/commune` (màn hình cán bộ),
`apps/admin` (bảng quản trị, phần thủ tục và xã). Các ứng dụng chỉ gọi lõi qua cổng API.

Bật gói: có `xa` trong `COMMUNEOS_MODULES` (mặc định có), rồi `make up`. Kiểm thử: `make test`, `make test-sql`,
`make test-citizen`, `make e2e-citizen`.
