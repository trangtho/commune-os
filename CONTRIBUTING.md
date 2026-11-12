<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# Hướng dẫn đóng góp

Cảm ơn bạn quan tâm đến CommuneOS. Mọi đóng góp được phát hành theo
Apache License 2.0.

## Báo lỗi và đề xuất

Mở một issue tại trình theo dõi lỗi của kho mã. Với lỗi, nêu rõ: bước tái
hiện, kết quả mong đợi, kết quả thực tế, phiên bản đang dùng.

## Quy trình làm việc

1. Mỗi việc ứng với một issue.
2. Tạo nhánh từ `main`: `feat/<mô-tả>`, `fix/<mô-tả>`, `docs/<mô-tả>`,
   `chore/<mô-tả>`.
3. Commit theo mẫu `loại: mô tả ngắn (#số-issue)`, ví dụ
   `feat: thêm chính sách RLS cho bảng dossiers (#12)`.
4. Mở pull request vào `main`; cần ít nhất một người khác duyệt.
5. Không ghi đè lịch sử (`git push --force`) trên `main`.

## Danh sách kiểm trước khi mở pull request

- [ ] Mọi tệp mã mới có hai dòng tiêu đề giấy phép (xem bên dưới).
- [ ] Thành phần hoặc thư viện mới đã được thêm vào `DEPENDENCIES.md`.
- [ ] `CHANGELOG.md` đã cập nhật ở mục "Chưa phát hành".
- [ ] Không có mật khẩu, khóa bí mật hay dữ liệu cá nhân thật.
- [ ] Không chép mã nguồn của dự án khác vào kho.
- [ ] `make test` chạy qua.

## Tiêu đề giấy phép

Đặt ở đầu mỗi tệp mã, theo cú pháp chú thích của ngôn ngữ:

```
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
```

| Loại tệp | Cú pháp chú thích |
| --- | --- |
| `.ts`, `.js` | `// ...` |
| `.py`, `.yml`, `.sh`, `Dockerfile`, `Makefile`, `.env.example` | `# ...` |
| `.sql` | `-- ...` |
| `.vue`, `.md`, `.bpmn`, `.dmn`, `.xml`, `.html` | `<!-- ... -->` |

Tệp không chứa được chú thích (ví dụ `.json`, ảnh) được khai báo giấy phép
trong tệp `REUSE.toml` ở thư mục gốc.

## Dữ liệu mẫu

Chỉ dùng dữ liệu giả lập do đội tự tạo. Không đưa giấy tờ, ảnh căn cước hay
thông tin của người thật vào kho mã, máy chủ thử nghiệm hoặc tài liệu.
