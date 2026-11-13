# Sửa banner trùng chữ và responsive – Kênh Công dân

## Nguyên nhân

Ảnh `ubnd-hero.png` cũ là một phần của ảnh chụp giao diện và chứa sẵn chữ ở khu vực thanh quy trình. Khi thanh quy trình Vue được hiển thị chồng lên ảnh, các dòng mô tả của bước 3 và bước 4 xuất hiện hai lần.

## Sửa đổi

- `public/images/ubnd-hero-clean.png`: chỉ giữ ảnh UBND, không chứa chữ và nút của quy trình.
- `layouts/default.vue`: sử dụng ảnh mới và hiện đầy đủ thanh bước dạng lưới từ màn hình `xl` (>= 1280px); màn hình hẹp có thể vuốt riêng trong thanh bước.
- `pages/dang-nhap.vue`: ảnh nền tại trang đăng nhập cũng chuyển sang ảnh sạch.
- Giữ nguyên kiến trúc `100dvh`, thanh header/banner cố định, cuộn độc lập vùng nội dung, hỗ trợ công dân, API và dữ liệu PostgreSQL.

## Áp dụng bản ZIP cập nhật

Tại thư mục gốc của dự án hiện tại:

```bash
cp -a apps/citizen/layouts/default.vue apps/citizen/layouts/default.vue.bak
unzip -o /duong-dan/CommuneOS_Banner_NoEmbeddedText_Overlay.zip -d .
docker compose up -d --build --no-deps citizen
```

Mở lại trang `http://localhost:3000`, nhấn `Cmd+Shift+R` để tải lại CSS và ảnh mới.

Không chạy `docker compose down -v` và không chỉnh sửa `.env`.
