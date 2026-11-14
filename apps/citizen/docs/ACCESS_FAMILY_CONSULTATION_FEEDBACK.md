# Kênh Công dân — hỗ trợ tiếp cận, hồ sơ gia đình, lịch tư vấn và đánh giá theo giai đoạn

## Phạm vi phiên bản

Được phát triển trên bản CommuneOS đã có **cá nhân hóa, quyền đại diện và hỗ trợ tại quầy**. Giữ nguyên layout, màu sắc và quy ước dự án. Thay đổi gồm `apps/citizen`, migration `core/db/init/06-*`, `docker-compose.yml`, `Makefile` và bài kiểm thử.

### 1. Hỗ trợ khả năng tiếp cận

Nút hỗ trợ tiếp cận ở header cho phép tăng cỡ chữ, bật tương phản cao, điều hướng với Tab/Enter/Escape và dùng Web Speech API để đọc nội dung bằng giọng nói. Lựa chọn chỉ được lưu trong `localStorage` **của trình duyệt hiện tại**, không thu thập dữ liệu công dân. Không tải lại trang khi thay đổi tùy chọn; biểu mẫu chưa gửi được giữ nguyên. Trên `/huong-dan` có chế độ hiển thị từng bước. Trình duyệt không có giọng đọc tiếng Việt thì chức năng TTS có thể không hoạt động đầy đủ; vẫn có thể đọc bằng trình đọc màn hình riêng của hệ điều hành.

### 2. Hồ sơ gia đình

Trang `/ho-so-gia-dinh` dùng các yêu cầu đại diện **đã được xác minh** (bảng `citizen_representations`) làm cơ sở phạm vi truy cập. Chỉ trả về các hồ sơ **do chính tài khoản đang đăng nhập đã tạo**, `representation_id` phải thuộc quyền còn hiệu lực và đúng thủ tục; RLS từ `applications` và `citizen_representations` tiếp tục được áp dụng. Không chia sẻ toàn bộ hồ sơ từ tài khoản của người thân, không cho phép công dân tự phê duyệt quyền đại diện. Thông báo của hồ sơ do chính tài khoản này gửi vẫn ở hộp thư riêng; khi cần trao quyền chủ động cho tài khoản khác, nhóm Identity/kiểm duyệt phải triển khai quy trình xác minh và đồng ý riêng.

### 3. Đặt lịch tư vấn

Trang `/lich-tu-van` hỗ trợ điện thoại và trực tuyến, tìm theo lĩnh vực, mô tả, chọn khung giờ cán bộ công bố hoặc đề nghị thời gian riêng, xem lịch và hủy lịch. Bảng `citizen_consultation_slots` do **dịch vụ cán bộ** hoặc DB owner công bố, app role chỉ có quyền SELECT. Nếu có slot thì server kiểm tra giờ và giới hạn còn lại trong giao dịch (advisory lock). Các đề nghị khác chỉ mang trạng thái `pending`; tuyệt đối không phát sinh trạng thái `confirmed` hoặc URL họp giả. Cán bộ hoặc dịch vụ quản lý riêng có thẩm quyền cập nhật trạng thái, `meeting_url` và ghi chú. Trigger `citizen_consultation_notify` tạo thông báo khi trạng thái đổi sang confirmed/declined/completed. Mỗi công dân tối đa ba lịch còn hiệu lực để giảm lạm dụng. Liên kết họp chỉ được hiển thị khi bắt đầu bằng HTTPS và lịch đã xác nhận.

**Chưa có UI cán bộ** công bố khung giờ, xác nhận hoặc gửi liên kết họp trong dự án công dân. Cần triển khai API/cổng cán bộ có xác thực, chống trùng lịch và audit trước khi phục vụ thực tế. Không trực tiếp cấp quyền UPDATE cho `communeos_app`.

### 4. Đánh giá theo giai đoạn

Trang `/ho-so/:id/danh-gia` cho đánh giá (1–5 sao, ý kiến tối đa 1.000 ký tự) tại các giai đoạn `guidance`, `reception`, `supplement`, `result`. API kiểm tra chủ sở hữu, trạng thái và sự kiện hồ sơ **trên server**; một đánh giá cho mỗi giai đoạn, không cho sửa/xóa lịch sử. RLS ngăn tài khoản khác truy cập. `citizen_stage_review_summary` là view tổng hợp số lượt, điểm trung bình và điểm thấp theo xã/giai đoạn, không cấp quyền cho app role. Cán bộ có thẩm quyền sẽ dùng dịch vụ riêng có kiểm soát để xem tổng hợp, không hiển thị dữ liệu riêng tư sang tài khoản công dân khác.

## Cập nhật database và kiểm tra

```bash
cd /Users/T07/Hakathon/Source/commune-os-integrated
# Sao lưu cơ sở dữ liệu nếu đang lưu dữ liệu quan trọng.
npm --prefix apps/citizen test
npm --prefix apps/citizen run build
make COMPOSE="docker compose -f docker-compose.yml" repair-db
make COMPOSE="docker compose -f docker-compose.yml" citizen-experience-test
docker compose -f docker-compose.yml up -d --build citizen
```

`repair-db` thêm migration sau `05-citizen-representation-counter.sql`. Không xóa các bảng/volume cũ. Bài kiểm thử PostgreSQL chạy trong transaction và kết thúc bằng `ROLLBACK`.

Sau khi chạy Docker, nghiệm thu `/ho-so-gia-dinh`, `/lich-tu-van`, `/ho-so/:id/danh-gia` và bật chế độ hỗ trợ tiếp cận trên bất kỳ trang nào. Để kiểm thử trình duyệt dùng `npm --prefix apps/citizen run test:e2e`, cần cài Playwright/Chromium và có tài khoản demo; bài kiểm thử này tạo rồi hủy một yêu cầu tư vấn.

**Giới hạn:** Đây là hệ thống mô phỏng. Dữ liệu thủ tục hiện chưa được kiểm chứng pháp lý. Các hành vi phê duyệt quyền đại diện, xác nhận lịch tư vấn và quản lý tổng hợp đánh giá của cán bộ phải được phía phụ trách cán bộ bổ sung trước khi triển khai thật.
