<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# core/tests

Kiểm thử phần lõi dùng chung, không phụ thuộc gói nghiệp vụ nào, và kiểm thử kiến trúc.

| Tệp                   | Kiểm tra                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `wait-ready.sh`       | Không phải kiểm thử: chờ mọi dịch vụ sẵn sàng (healthcheck đạt, `db-setup`, `identity-setup`, `rest-keys` kết thúc với mã 0), báo dịch vụ lỗi. Dùng ở cuối `make up`, trong `make ready` và CI. |
| `platform.sh`         | Phần lõi dùng chung, không phụ thuộc gói nào (`make test-platform`): gói đã cài khớp `COMMUNEOS_MODULES`, không token bị chặn, tạo và hủy đơn vị kèm lãnh đạo qua dịch vụ tài khoản, token mang đúng đơn vị, đơn vị chỉ dùng gói chọn khi tạo (tắt được, gói chưa cài bị từ chối, lãnh đạo không tự bật), sổ ghi nhận nguyên vẹn và không xóa được, loại quy trình chưa khai báo trả 404; tệp đính kèm, kho tri thức chỉ đi qua dịch vụ của lõi; khi không cài gói xã thì không có bảng, API nào của gói xã. CI chạy cả trên bản cài chỉ có lõi. |
| `architecture.test.mjs` | Kiểm tra tĩnh (`make test-architecture`, không cần stack chạy): SQL và mã dịch vụ của lõi không nhắc tới bảng, hàm, đường dẫn của gói nào; tệp khai báo trong `module.json` đều tồn tại; không ứng dụng nào nối thẳng PostgreSQL (trừ LISTEN của Kênh người dân); cookie phiên được mã hóa; bản sao mã dùng chung không lệch nguồn |

## Chạy

Cần `docker compose up -d` đang chạy, cùng `curl` và `python3`. Tài khoản quản trị hệ thống lấy từ
`COMMUNEOS_ADMIN_USERNAME`, `COMMUNEOS_ADMIN_PASSWORD`, phần dọn dữ liệu kiểm thử dùng `KEYCLOAK_ADMIN`,
`KEYCLOAK_ADMIN_PASSWORD` (không đặt thì đọc từ `.env`).

```bash
make test-platform        # chạy được cả khi không cài gói xã
make test-architecture    # kiểm tra tĩnh, không cần stack chạy
```

Kiểm thử của từng gói nằm trong gói: gói xã ở `modules/xa/tests/` (`make test`, `make portal-smoke`), gói doanh nghiệp
ở `modules/doanh-nghiep/test.sh` (`make example-enterprise`).
