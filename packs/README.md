<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# packs

Gói thủ tục. Mỗi thủ tục một thư mục; hiện lõi đọc tệp `pack.yaml` (mã, tên, phiên bản, lĩnh vực,
giấy tờ cần nộp) và thư mục `wiki/` hướng dẫn. Mẫu: [`_template/`](_template/README.md);
ví dụ: [`dang-ky-tam-vang/`](dang-ky-tam-vang/pack.yaml).

Nạp gói: bảng quản trị → Danh mục thủ tục → Thêm thủ tục (gọi `api.import_procedure`).
Sơ đồ quy trình hiện dùng chung `core/orchestrator/bpmn/xu-ly-ho-so.bpmn20.xml`; lõi chưa đọc
sơ đồ BPMN, biểu mẫu hay bảng quyết định DMN riêng của từng gói.
