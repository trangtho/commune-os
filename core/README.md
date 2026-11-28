<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# core

Tầng 1: lõi headless. Không chứa giao diện cho người dùng cuối.

Lõi dùng chung cho mọi gói nghiệp vụ trong `modules/` ([gói xã](../modules/xa/README.md),
[gói doanh nghiệp](../modules/doanh-nghiep/README.md)) và không chứa bảng, quy trình nào của gói. Lõi nạp các gói trong
`COMMUNEOS_MODULES`; để rỗng thì chỉ chạy lõi, chưa có gói nào, thêm gói sau bằng `make up`. Ranh giới: [docs/LOI_DUNG_CHUNG.md](../docs/LOI_DUNG_CHUNG.md#ranh-giới-trong-mã-nguồn);
cơ sở dữ liệu của lõi: [db/](db/README.md). Công cụ viết gói mới: `sdk/module-sdk.mjs` (`make module-create`,
`make module-validate`, xem [docs/LOI_DUNG_CHUNG.md](../docs/LOI_DUNG_CHUNG.md#thêm-nghiệp-vụ-mới)).
