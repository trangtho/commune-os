<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
# Danh mục thủ tục mở rộng — Kênh công dân

- Thêm **36 thủ tục tham khảo** vào 6 thủ tục demo gốc, tổng cộng **42 thủ tục** trên cơ sở dữ liệu mẫu mới.
- Các nhóm: Hộ tịch, Cư trú, Chứng thực, Kinh doanh, Đất đai – Xây dựng, An sinh xã hội, Người có công, Bảo hiểm y tế.
- Danh mục có tìm kiếm, lọc lĩnh vực và phân trang 12 thẻ/trang.
- **Chỉ là dữ liệu demo chưa xác minh**: thời hạn là `0` (giao diện hiển thị “Chưa cập nhật”), lệ phí “Chưa xác minh”, giấy tờ kèm theo chỉ là gợi ý tùy chọn. Không công bố đây là hướng dẫn/khả năng tiếp nhận chính thức.
- Giữ nguyên 6 thủ tục cũ và thay đổi mà quản trị đã cập nhật vì câu lệnh `ON CONFLICT DO NOTHING`.
- Khởi tạo phiên bản cho thủ tục mới bằng chính cơ chế chính SQL bổ sung, với `provenance_status=unverified_demo`.
- Chỉ bật mặc định những thủ tục mới cho hai xã mô phỏng `xa-a`, `xa-b`. Xã thật phải được quản trị viên cấu hình. Không tự bật ở mọi địa phương.
- Hồ sơ demo của thủ tục chưa có thời hạn được ghi `due_at=NULL` thay vì sinh hạn hẹn không có căn cứ.
- Chức năng này dùng cho trình diễn và kiểm thử; để sử dụng thực tế phải chuẩn hóa mã thủ tục theo Cơ sở dữ liệu quốc gia, cơ quan giải quyết, điều kiện, biểu mẫu, lệ phí, thời hạn, nguồn pháp lý, quy trình và phân quyền tiếp nhận; công bố theo phiên bản được xác minh.

## Triển khai

Từ thư mục gốc của CommuneOS, dùng:

```bash
# Xem trước thay đổi Git và bảo đảm working tree sạch
git diff --check

# Chạy lại db-setup trong docker-compose để thêm dữ liệu vào volume PostgreSQL HIỆN CÓ
# Không dùng docker compose down -v (sẽ xóa dữ liệu).
docker compose up -d --force-recreate db-setup

docker compose logs --no-color db-setup

# Kiểm tra số lượng sau khi db-setup thành công
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT category, COUNT(*) FROM procedures WHERE published GROUP BY category ORDER BY category"'
```

Tùy phiên bản Compose, chạy `docker compose up -d` sau đó để các dịch vụ phụ thuộc bắt đầu cùng cơ sở dữ liệu đã nạp. Khởi tạo lần đầu sẽ tự chạy script mới theo thứ tự được khai báo trong `docker-compose.yml`.

## Vị trí mã nguồn

- `core/db/init/19-citizen-expanded-catalog.sql`: dữ liệu thủ tục demo, tài liệu đính kèm tùy chọn, bật cho xã mẫu.
- `docker-compose.yml`: gọi SQL mới sau khi lược đồ và bảng phiên bản thủ tục được khởi tạo.
- `apps/citizen/pages/thu-tuc/index.vue`: tìm kiếm, phân trang.
- `apps/citizen/components/ProcedureCard.vue`, `apps/citizen/pages/thu-tuc/[slug].vue`, `apps/citizen/pages/tai-quay.vue`, `apps/citizen/pages/lo-trinh-hanh-chinh/[id].vue`: không hiển thị sai thời hạn chưa xác minh.
- `apps/citizen/server/api/applications/[id]/submit.post.ts`: không tạo hạn xử lý giả khi thời hạn chưa có.

**Cảnh báo**: Không nhập thông tin nhạy cảm thật vào môi trường demo. Nguồn tham khảo tên nhóm thủ tục (không phải nguồn xác nhận chi tiết từng thủ tục): Cổng Bộ Tư pháp và Trung tâm Phục vụ hành chính công Hà Nội. Đối chiếu lại trước khi triển khai thật.
