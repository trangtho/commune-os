# Chuyển tiếp hồ sơ trực tuyến ↔ tại quầy và theo dõi hỗ trợ

Hai chức năng này mở rộng **Kênh công dân** theo bố cục `main`. Bản triển khai là mô phỏng nghiệp vụ, không phải hệ thống tiếp nhận hồ sơ hành chính chính thức.

## Giao diện công dân

- `/chuyen-tiep`: sau khi đăng nhập, chọn hồ sơ **nháp**; phát hành mã ngẫu nhiên 192 bit (hiển thị **một lần**) dùng tối đa 15 phút. Các mã cũ đang hoạt động được thu hồi khi phát hành mã mới. Có thể xem lịch sử phát hành/đã tiếp nhận/thu hồi và tự thu hồi mã chưa sử dụng.
- `/ho-so/:id`: hồ sơ ở trạng thái nháp có liên kết chuyển tiếp trực tiếp.
- `/yeu-cau-ho-tro`: gửi yêu cầu có mã YC, loại vấn đề, mã hồ sơ liên quan tùy chọn, tìm kiếm/lọc/phân trang, phân biệt trạng thái nhận thông tin với trạng thái cán bộ xử lý.
- `/yeu-cau-ho-tro/:id`: xem lịch sử trao đổi, người phụ trách, kết quả thực tế; phản hồi tiếp khi chưa hài lòng. Yêu cầu đã giải quyết/đóng sẽ chuyển sang `reopened` khi có phản hồi mới.
- `/lien-he` và API phản hồi cũ vẫn tương thích: phản hồi mới gửi qua API cũ cũng tự tạo ticket để theo dõi; migration nhập các phản hồi cũ vào trung tâm (không xóa bản ghi cũ).

## Migration, phân quyền và kiểm thử

- Migration: `core/db/init/07-citizen-handoff-support.sql` chạy sau migration `06` trong `docker-compose.yml`, có thể chạy lại; không xóa dữ liệu cũ.
- `citizen_case_handoffs`: lưu **SHA-256 của mã**, không lưu mã rõ; thời hạn, người phát hành, người tiếp nhận; PostgreSQL `FORCE ROW LEVEL SECURITY` theo `citizen_id` và `tenant_id`.
- `citizen_support_tickets` + `citizen_support_ticket_events`: kiểm soát quyền đọc/ghi theo tài khoản và địa phương. Công dân không thể tự đổi người phụ trách hay trạng thái staff; nhật ký tin nhắn không bị ghi đè.
- `npm --prefix apps/citizen test` kiểm tra logic và cấu trúc; `make COMPOSE="docker compose -f docker-compose.yml" handoff-support-test` thử RLS, tenant, mã dùng một lần và phân quyền (SQL `ROLLBACK`). Cần chạy cả Nuxt build và kiểm thử UI thực tế trước khi tích hợp.

## API phía công dân (cookie đăng nhập)

- `POST /api/applications/:id/handoff` → `{handoffId, code, expiresAt, applicationId}`. Chỉ cấp cho hồ sơ nháp do chính tài khoản sở hữu; giới hạn 5 lần/giờ/hồ sơ.
- `GET /api/applications/:id/handoff` → lịch sử, **không** trả lại mã rõ.
- `DELETE /api/applications/:id/handoff/:handoffId` → thu hồi mã chưa sử dụng.
- `POST /api/tickets` → `{id, code, status}` với `{category, subject, message, applicationId?}`.
- `GET /api/tickets?status=&q=&page=` → danh sách 10 yêu cầu/trang.
- `GET /api/tickets/:id` → chi tiết và lịch sử sự kiện (tối đa 200 sự kiện ở giao diện).
- `POST /api/tickets/:id/reply` → `{ok,status}` với `{message}`.

## API tích hợp cán bộ (SERVER-TO-SERVER, KHÔNG dùng trình duyệt công dân)

**Không hoạt động khi chưa cấu hình token** `CITIZEN_STAFF_BRIDGE_TOKEN` dài tối thiểu 32 ký tự. Sinh token bằng `openssl rand -hex 32`, chỉ lưu ở `.env` máy cục bộ hoặc kho secret manager, không commit. Dịch vụ cán bộ phải xác thực nhân sự, kiểm tra quyền từng địa phương và gửi các header sau:

```http
Authorization: Bearer <CITIZEN_STAFF_BRIDGE_TOKEN>
X-CommuneOS-Tenant-ID: <UUID địa phương được cán bộ phân quyền>
X-CommuneOS-Staff-ID: <mã nhân sự đã xác minh bởi backend cán bộ>
```

Gọi API **chỉ từ backend đã xác thực**, không bao giờ gửi bearer này ra frontend:

- `POST /api/internal/handoffs/redeem` với `{ "code": "MÃ_32_KÝ_TỰ" }` → một lần nhận dữ liệu bản nháp, mã `handoffId`, dữ liệu kê khai và metadata các tài liệu. Cần đúng tenant, mã chưa hết hạn/chưa dùng, trạng thái vẫn là nháp. Ghi audit vào `application_events`, và gửi thông báo công dân. **Không tự động nộp hồ sơ**.
- `GET /api/internal/handoffs/:handoffId/documents/:documentId` → tải giấy tờ của mã đã nhận; chỉ cùng staff và tenant, trong 2 giờ kể từ khi nhận. Các nội dung cá nhân chỉ chuyển qua HTTPS trong triển khai thực tế.
- `GET /api/internal/support/tickets` → danh sách yêu cầu trong tenant của cán bộ.
- `GET /api/internal/support/tickets/:id` → chi tiết, lịch sử.
- `POST /api/internal/support/tickets/:id/update` với `{ "status":"processing|waiting_citizen|answered|resolved|closed", "message":"...", "resolution":"..." }` → đổi trạng thái, ghi lịch sử và tạo thông báo qua SSE cho công dân.

**Ranh giới an toàn:** Mã chuyển tiếp không cho phép công dân khác xem hồ sơ. Chỉ dịch vụ cán bộ dùng token server đã cấu hình + nhân sự/địa phương đã được xác thực ở hệ thống cán bộ mới được truy xuất. Cần tích hợp bộ phận một cửa để kiểm tra danh tính, đối chiếu bản gốc và tạo biên nhận chính thức; gọi API chuyển tiếp **không** có nghĩa đã nhận hồ sơ. Việc cấp token và phân quyền thực tế thuộc thành viên phụ trách backend cán bộ/Identity. Để triển khai chính thức phải triển khai HTTPS, giới hạn IP/service network, rotation token, kiểm tra an toàn log và kiểm toán quyền theo từng vai trò.

## Lệnh chạy trên Mac

```bash
cd /Users/T07/Hakathon/Source/commune-os-integrated
npm --prefix apps/citizen test
npm --prefix apps/citizen run build
# Sao lưu dữ liệu có giá trị trước khi cập nhật schema
make COMPOSE="docker compose -f docker-compose.yml" repair-db
make COMPOSE="docker compose -f docker-compose.yml" handoff-support-test
```

Không cần cấu hình `CITIZEN_STAFF_BRIDGE_TOKEN` để công dân tạo mã, gửi yêu cầu và xem lịch sử. Nhưng API cán bộ sẽ trả về 503 cho đến khi đội phụ trách cung cấp dịch vụ xác thực.
