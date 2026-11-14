# Đại diện người thân và chuẩn bị thủ tục tại quầy

## Phạm vi

- `GET /dai-dien`: công dân đã đăng nhập đăng ký người được đại diện, giấy tờ chứng minh, xem trạng thái và lịch sử, tự thu hồi.
- `GET /tai-quay`: **công khai**, chỉ chọn thủ tục, xem yêu cầu giấy tờ và tạo mã phiên chuẩn bị 15 phút. Không nhập/lưu họ tên, số định danh, số điện thoại hay hồ sơ riêng tư; mã phiên **không** cấp quyền nộp hoặc xác thực công dân.
- Trang nộp hồ sơ có tùy chọn nộp cho bản thân hoặc chọn **quyền đại diện đã xác minh**; API kiểm tra lại trạng thái, ngày hết hạn, người được đại diện và phạm vi thủ tục **khi tạo, sửa nháp và khi gửi**.
- `citizen_representations` có RLS theo citizen_id và tenant_id; lịch sử `citizen_representation_audit` chỉ thêm, không xóa/sửa từ vai trò ứng dụng. Nội dung ủy quyền không trở thành dữ liệu truy vấn AI RAG dùng chung.

## Bước cài đặt

```bash
make COMPOSE="docker compose -f docker-compose.yml" repair-db
npm --prefix apps/citizen test
make COMPOSE="docker compose -f docker-compose.yml" representation-test
```

Migration `core/db/init/05-citizen-representation-counter.sql` thêm bảng, index, cột tham chiếu và quyền **không xóa dữ liệu cũ**.

## Quy trình xác minh thực tế phải tích hợp với hệ thống cán bộ

1. Công dân tự khai người thân, căn cứ, thủ tục được đại diện, ngày hết hạn và tải PDF/ảnh minh chứng; hệ thống ghi trạng thái `pending`.
2. **Cán bộ được phân quyền** phải xác minh giấy tờ, danh tính các bên, thời hạn, hiệu lực và phạm vi đại diện. Đội cán bộ/Identity cần cung cấp API nội bộ xác thực cán bộ, lưu dấu vết, phân quyền xét duyệt và kiểm tra căn cứ pháp lý. Trong phiên bản hiện tại **chưa có API xét duyệt cán bộ**, nên các yêu cầu mới không thể tự chuyển thành `verified`.
3. Khi có kết quả xét duyệt đáng tin cậy, dịch vụ xét duyệt sử dụng quyền DB riêng (không phải `communeos_app`) để cập nhật `status='verified'`, `verified_at`, `verified_by` và minh chứng hợp lệ. Trigger ghi nhận chuyển trạng thái. **Không cấp quyền UPDATE status cho app công dân**.
4. Chỉ quyền `verified`, còn hạn, đúng thủ tục, có minh chứng mới được nộp; thu hồi làm các lần nộp sau bị từ chối. Hồ sơ đã nộp giữ nguyên liên kết đại diện và lịch sử để phục vụ kiểm tra.
5. Kiểm thử bổ sung: cố tình truy cập quyền của tài khoản khác, giả yêu cầu `verified`, dùng sai thủ tục, quyền đã thu hồi, quyền hết hạn, thay người thụ hưởng, thay hồ sơ nháp và gửi hồ sơ nhiều lần.

## Quy trình tại quầy

- Tạo mã phiên 80-bit ngẫu nhiên; database chỉ lưu SHA-256 của mã, thủ tục được chọn và thời hạn tối đa 15 phút. Hết hạn hoặc khi bấm **Kết thúc phiên**, mã không còn hợp lệ.
- Cán bộ có thể tham chiếu `GET /api/counter/sessions/{code}` để đọc **chỉ tên thủ tục đã chọn** (chưa có dữ liệu cá nhân). Endpoint này không phải API xác thực hoặc tiếp nhận hồ sơ.
- Để có quy trình nộp không tài khoản hoàn chỉnh, đội cán bộ phải cung cấp API xác minh trực tiếp tại quầy, cơ chế liên kết phiên, biên nhận và quyền truy cập dữ liệu sau khi xác minh. **Không sử dụng mã phiên công khai làm token xác thực**.
- Trước khi triển khai kiosk dùng chung: bổ sung giới hạn tốc độ ở Gateway, chính sách tự kết thúc/khoá màn hình, dọn bản ghi hết hạn, bảo mật thiết bị, kiểm tra khả năng in và chính sách lưu giữ dữ liệu và kiểm tra mã độc cho mọi tệp minh chứng.

## Giới hạn hiện tại

Bản nâng cấp là phần Citizen Portal có thể chạy với database demo: đã có giao diện, đăng ký, minh chứng, kiểm soát server, lịch sử và mã phiên. **Chưa xác minh giấy ủy quyền thực tế, chưa tích hợp cán bộ, chưa có thẩm quyền định danh/tiếp nhận hồ sơ trực tiếp tại quầy**. Không sử dụng với hồ sơ công dân thật trước khi các tích hợp này được kiểm thử và phê duyệt.
