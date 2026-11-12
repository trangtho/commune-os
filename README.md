<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# CommuneOS

**DX-OS Open-Core cho chính quyền cơ sở.**

CommuneOS là nền tảng lõi mở headless, đa thuê ước, giúp một xã tự dựng hệ
điều hành số của mình: định danh, cổng API, dữ liệu, quy trình và AI chạy
ngay trên máy chủ của xã, không phụ thuộc nhà cung cấp.

Bài dự thi Phần mềm nguồn mở - Olympic Tin học Sinh viên Việt Nam (OLP) 2026,
chủ đề "Xây dựng Hệ điều hành Chuyển đổi số bằng Công nghệ Lõi nguồn mở
(DX-OS Open-Core)".

## Giấy phép

Dự án phát hành theo **Apache License 2.0** (toàn văn trong tệp
[LICENSE](LICENSE)). Chúng tôi chọn giấy phép này để mọi cơ quan, tổ chức và
cá nhân được tự do sử dụng, sửa đổi và phân phối lại phần mềm, kể cả cho mục
đích thương mại, với điều kiện giữ nguyên thông báo bản quyền và giấy phép.

Mỗi tệp mã nguồn mang tiêu đề `SPDX-License-Identifier: Apache-2.0`.
Giấy phép của các thành phần bên thứ ba được liệt kê trong
[DEPENDENCIES.md](DEPENDENCIES.md).

## Kiến trúc

| Tầng | Thư mục | Nội dung |
| --- | --- | --- |
| Tầng 1 - Lõi headless | `core/` | Cửa ngõ API, định danh, dữ liệu, quy trình, sổ cái, AI, bảng quản trị |
| Tầng 2 - Ứng dụng | `apps/commune/` | Ứng dụng xã cho cán bộ, lãnh đạo, cấp trên |
| Tầng 2 - Ứng dụng | `apps/citizen/` | Kênh nộp hồ sơ trực tuyến cho người dân |
| Cấu hình | `packs/` | Gói thủ tục: BPMN, biểu mẫu, bảng kiểm giấy tờ, wiki |

Lõi không cấp giao diện cho người dùng cuối; nó chỉ có bảng quản trị cho quản
trị viên hệ thống. Ứng dụng ở Tầng 2 chỉ gọi lõi qua cửa ngõ API.

Chi tiết: [docs/](docs/).

## Yêu cầu hệ thống

- Docker Engine và Docker Compose (hoặc Podman)
- GNU Make
- Khoảng 16 GB RAM để chạy đầy đủ, kể cả mô hình AI cục bộ

## Dựng từ mã nguồn

```bash
git clone https://github.com/trangtho/commune-os.git
cd commune-os
cp .env.example .env      # sửa mật khẩu trong .env
make up                   # dựng và khởi động toàn bộ dịch vụ
make seed                 # nạp dữ liệu mẫu giả lập
make test                 # chạy bộ kiểm thử
```

Mọi cấu hình nằm trong tệp `.env`; không cần sửa tệp mã nguồn nào.

## Cấu hình

Xem chú thích từng biến trong [.env.example](.env.example).

## Mở rộng

- Thêm thủ tục mới: sao `packs/_template/`, sửa rồi nạp qua bảng quản trị.
- Xây ứng dụng mới trên lõi: thêm thư mục trong `apps/`, gọi API qua cửa ngõ.

Hướng dẫn chi tiết trong [docs/](docs/).

## Đóng góp và báo lỗi

- Báo lỗi và đề xuất: [Issues](https://github.com/trangtho/commune-os/issues)
- Hướng dẫn đóng góp: [CONTRIBUTING.md](CONTRIBUTING.md)
- Lịch sử thay đổi: [CHANGELOG.md](CHANGELOG.md)

## Đội phát triển

Danh sách người đóng góp: [Contributors](https://github.com/trangtho/commune-os/graphs/contributors).
