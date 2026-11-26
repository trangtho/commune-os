<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# modules/xa/packs

Gói thủ tục của gói nghiệp vụ xã. Mỗi thủ tục một thư mục; gói xã đọc tệp `pack.yaml` (mã, tên, phiên bản, lĩnh vực,
giấy tờ cần nộp) và thư mục `wiki/` hướng dẫn. Mẫu: [`_template/`](_template/README.md);
ví dụ: [`dang-ky-tam-vang/`](dang-ky-tam-vang/pack.yaml).

Nạp gói: bảng quản trị → Danh mục thủ tục → Thêm thủ tục (gọi `api.import_procedure`).
Mọi thủ tục dùng chung sơ đồ `modules/xa/bpmn/xu-ly-ho-so.bpmn20.xml`; gói xã chưa đọc
sơ đồ BPMN, biểu mẫu hay bảng quyết định DMN riêng của từng gói.
