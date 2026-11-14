# CommuneOS – cập nhật hai logo (bản mô phỏng)

## Thay đổi

- Thay biểu tượng ngôi sao tròn tự tạo trong header của cổng công dân bằng hai logo cạnh nhau: Bộ Công an (bên trái) và Học viện Kỹ thuật và Công nghệ An ninh (bên phải).
- Logo hiển thị tại mọi kích thước màn hình. Trên điện thoại hẹp, nhãn đăng nhập thu gọn thành biểu tượng, còn ở chiều rộng dưới 360px thì ẩn chữ CommuneOS để ưu tiên hai logo và điều hướng.
- Thiết lập biểu tượng tab trình duyệt (favicon) theo logo Học viện.

## Tệp ảnh

- `apps/citizen/public/images/logo-bo-cong-an.png`
- `apps/citizen/public/images/logo-hoc-vien-ky-thuat-cong-nghe-an-ninh.png`

**Lưu ý:** Hai hình ảnh đã được vẽ lại từ ảnh tham chiếu do người dùng cung cấp, không phải tệp logo chính thức được xác minh. Nếu cần sử dụng nhận diện chính thức, hãy thay bằng tệp chuẩn do cơ quan chủ quản cung cấp (giữ nguyên tên tệp), và chỉ dùng khi được phép. Dự án CommuneOS vẫn là bản mô phỏng.

## Xem kết quả trên máy local

Tại thư mục dự án:

```bash
docker compose -f docker-compose.yml up -d --build citizen
```

Truy cập `http://localhost:3000` và tải lại trang (Cmd+Shift+R nếu favicon hoặc logo còn lưu trong cache). Không cần chỉnh sửa cơ sở dữ liệu.
