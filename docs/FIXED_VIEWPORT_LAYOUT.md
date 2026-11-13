<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
# Giao diện cố định theo chiều cao màn hình

Phạm vi: kênh Công dân `apps/citizen/`, không thay đổi API, PostgreSQL hoặc dữ liệu mẫu.

- Trang sử dụng chiều cao `100dvh`, `html/body/#__nuxt` không cuộn.
- Header + banner + thanh bước cố định; vùng nội dung giữa (`main`) cuộn dọc độc lập.
- Cột trái/phải có vùng cuộn riêng khi nội dung dài.
- Menu điện thoại phủ lên trang, không đẩy banner xuống.
- Trang đăng nhập có vùng cuộn riêng để biểu mẫu không bị cắt ở màn hình thấp.
- Thanh cuộn được ẩn nhưng người dùng vẫn cuộn bằng chuột, trackpad, phím và cảm ứng.
- Chuyển trang: cuộn vùng nội dung chính về đầu.

Sau khi cập nhật file frontend:

```sh
docker compose up -d --build --no-deps citizen
```

Mở http://localhost:3000 và làm mới cứng trình duyệt (Cmd+Shift+R).

**Không chạy** `docker compose down -v` vì sẽ xóa volume dữ liệu.
