<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# CommuneOS Citizen – 14 chức năng về lộ trình hành chính cá nhân

## Phạm vi và nguyên tắc

Bản triển khai gia tăng từ `communeos-18-features-current-full.zip`; ưu tiên `apps/citizen`, bổ sung PostgreSQL migration và Docker Compose. Không tự chỉnh sửa `apps/commune`, `core/admin` hoặc Git. Các tính năng **hỗ trợ quyết định/chuẩn bị** và không thay cơ quan nhà nước xác nhận điều kiện pháp lý. Dữ liệu thủ tục trong dự án là **dữ liệu mô phỏng**, các bản công bố nội bộ không đồng nghĩa nguồn pháp lý đã được xác minh độc lập.

| # | Yêu cầu | Điểm tích hợp / mức độ triển khai |
|---|---|---|
| 1 | Từ nhu cầu sang quy trình | `/lo-trinh-hanh-chinh` + `POST /api/journeys/analyze`; truy xuất danh mục đang công bố, phân tích bằng từ đồng nghĩa/quy tắc và hỏi thêm 3 điều kiện tùy chọn. Không tự suy diễn điều kiện pháp lý. **Chưa tích hợp mô hình NLP học máy chuyên dụng**. |
| 2 | Lộ trình nhiều thủ tục theo sự kiện | `/lo-trinh-hanh-chinh/[id]`; lưu các thủ tục công dân đã chọn, tình trạng từng bước và liên kết hồ sơ. Quan hệ phụ thuộc/thực hiện song song vẫn *chưa xác minh*, nên hiển thị là lộ trình chuẩn bị, không khẳng định thứ tự bắt buộc. |
| 3 | Trợ lý đồng hành kê khai | `CitizenFilingCompanion.vue` trong `nop-ho-so/[slug].vue`: hướng dẫn trường và bước hiện tại từ cấu trúc biểu mẫu, có thể gửi phản ánh ẩn danh. |
| 4 | Xem trước tạo bộ hồ sơ | `GET /api/applications/[id]/packet-preview`: đề xuất thông tin tự khai/đã xác minh từ nguồn OIDC được phê duyệt, liệt kê giấy tờ thiếu và phiên bản kho; không tự sao chép. Công dân chủ động áp dụng từng trường và xác nhận chia sẻ giấy tờ theo luồng kho số có sẵn. OCR dùng tích hợp trước đó và cần nhà cung cấp thật. |
| 5 | Mô phỏng kiểm tra trước nộp | Dùng `reviewStoredDraft`, `CitizenCaseInsights`, `CitizenDocumentReview` và kiểm tra ở `submit.post.ts`; thiếu giấy tờ/trường bắt buộc bị chặn. Kiểm tra pháp lý cuối cùng vẫn thuộc cơ quan có thẩm quyền. |
| 6 | Đề xuất phương thức thuận tiện | `GET /api/procedures/[id]/channels`: chỉ hiển thị trực tuyến khi địa phương mở tiếp nhận, hoặc lịch tại quầy thực có. Không tự bịa số lần phải đi lại hay mức phí. |
| 7 | Cập nhật lộ trình theo trạng thái mới | `GET /api/applications/[id]/roadmap`, `CitizenCaseRoadmap.vue` tích hợp chi tiết hồ sơ; chỉ giải thích trạng thái và sự kiện thật, cảnh báo phiên bản chưa xác nhận và mục bổ sung chưa có phản hồi. |
| 8 | Gợi ý thủ tục từ thay đổi | `GET /api/citizen/life-suggestions`: chỉ dùng sự kiện mà công dân **đã nhập và lưu** trong lộ trình, không tự quét hồ sơ cá nhân để suy đoán. Không tự lập hồ sơ. |
| 9 | Nhắc nghĩa vụ/thời hạn | `/lich-hanh-chinh`; cài đặt bật/tắt và ngày báo trước; công việc tự tạo + thời hạn hồ sơ + lịch đã đặt. Khi `CITIZEN_REMINDERS_ENABLED=true` và công dân bật nhắc, bộ quét gửi thông báo **trong ứng dụng** với khóa chống trùng; không SMS/email. |
| 10 | Không gian hành chính thống nhất | `/khong-gian-ca-nhan` + `/api/citizen/workspace`: hồ sơ, bản nháp, kho giấy tờ, công việc, thông báo, lịch, gợi ý bước tiếp theo. |
| 11 | Tiếp tục phiên trên thiết bị khác | `citizen_draft_cursors`, `PUT /api/applications/[id]/autosave` và `/api/citizen/draft-cursors/[id]`. **Sau khi người dùng lưu bản nháp hợp lệ lần đầu**, thay đổi các trường biểu mẫu được lưu sau khoảng 1,8 giây; số phiên bản ngăn ghi đè từ thiết bị cũ (HTTP 409). Bước hiện tại cũng được lưu. Dữ liệu chưa từng lưu không thể được khôi phục. |
| 12 | Giải thích trạng thái dễ hiểu | Dùng `explainCaseStatus`, nhật ký xử lý và các gợi ý thật trong `/api/applications/[id]/roadmap`; không đoán nguyên nhân nếu chưa có ghi chú từ cán bộ. |
| 13 | Trợ lý có nguồn và giới hạn | Mở rộng API chatbot trả `sourceEvidence` gồm nguồn khai báo, phạm vi, hiệu lực, mức xác minh. Chỉ trích dẫn thủ tục trong PostgreSQL đang công bố, hiển thị cảnh báo dữ liệu demo/nguồn chưa xác minh. **Chưa đủ dữ liệu xác minh độc lập để cam kết trợ lý chỉ trả lời từ văn bản pháp luật có hiệu lực**, do đó cần thẩm tra nguồn trước triển khai thật. |
| 14 | Phát hiện điểm chưa rõ trong tương tác | `POST /api/citizen/feedback-signals` chỉ nhận mã vấn đề sau khi công dân đồng ý; không lưu nội dung trường, câu hỏi, IP hay danh tính. `POST /rest/rpc/citizen_friction_summary` (API của lõi) chỉ lãnh đạo xã gọi được; chỉ trả nhóm từ 5 sự kiện/90 ngày. Chưa tự thay giao diện hay nội dung thủ tục. |

## Database và bảo mật

- Migration: `modules/xa/db/18-citizen-life-journeys.sql`, chạy sau 17; không sửa dữ liệu hồ sơ có sẵn.
- Bảng `citizen_life_journeys`, `citizen_life_journey_items`, `citizen_reminder_settings`, `citizen_personal_tasks`, `citizen_draft_cursors` dùng **RLS buộc công dân + địa phương**. Người dùng chỉ thao tác qua API có `citizenTx`.
- Bảng `citizen_reminder_deliveries` chống gửi lại cùng sự kiện/ngày và **không cho app user INSERT trực tiếp**. Các tác vụ chạy dưới PostgreSQL SECURITY DEFINER. Cần giới hạn truy cập nội bộ và không để lộ token dịch vụ.
- Thống kê trải nghiệm không gắn tài khoản, IP, mã hồ sơ hoặc trường dữ liệu; ngưỡng 5 chỉ nhằm hạn chế tiết lộ, chưa cung cấp cơ chế riêng tư vi sai.
- Không tự điền giấy tờ từ nguồn cá nhân sang hồ sơ người được đại diện. Không tự nộp, phê duyệt, hoặc quyết định đủ điều kiện.
- Đồng bộ bản nháp dùng revision (optimistic concurrency). Nếu hai thiết bị sửa đồng thời, hiển thị lỗi 409 và yêu cầu tải lại.

## Chạy thử trên máy phát triển

1. Kiểm tra patch (`git apply --check ...`), sao lưu các thay đổi trong Git và PostgreSQL.
2. `docker compose config -q`; cập nhật schema trên dữ liệu **demo** qua `make repair-db`. Quy trình có chạy lại các bước seed, vì vậy tuyệt đối không chạy trên dữ liệu thật khi chưa rà soát và sao lưu.
3. `make life-journey-test` để kiểm tra RLS và chống trùng thông báo; SQL có `BEGIN` / `ROLLBACK`.
4. `cd apps/citizen && npm ci && npm test && npm run typecheck && npm run build`.
5. Đăng nhập bằng 2 công dân của 2 địa phương, thử truy cập chéo lộ trình, bản nháp, nhắc việc; thử một bản nháp cùng mở trên hai thiết bị và gửi cập nhật khác phiên bản.
6. Kiểm tra việc chọn giấy tờ kho số vẫn yêu cầu đồng ý riêng, và không có API tự động submit.

### Kích hoạt nhắc việc tự động

Thiết lập `CITIZEN_REMINDERS_ENABLED=true` trong `.env`, chạy lại `make up` (trên môi trường demo), sau đó người dùng bật nhắc trong `/lich-hanh-chinh`. Dịch vụ điều phối của lõi (`orchestrator`) gửi nhắc mỗi giờ và khoảng 30 giây sau khi khởi động (`api.system_dispatch_citizen_reminders`, có kiểm tra trùng trong PostgreSQL). Quản trị hệ thống cũng gửi được bằng `POST /rest/rpc/dispatch_citizen_reminders` (API của lõi). Nếu biến tắt, lịch vẫn hiển thị nhưng không gửi tự động.

## Các giới hạn không được diễn giải thành tính năng đã kiểm chứng

- Chưa dùng mô hình AI học máy để suy luận luồng thủ tục, thứ tự phụ thuộc, khả năng thực hiện đồng thời hoặc chấm điểm phương án tiện nhất. Đây là gợi ý dựa trên danh mục và quy tắc giải thích được.
- Chưa xác minh độc lập văn bản pháp luật, đối tượng có quyền hưởng chính sách, lệ phí pháp lý hoặc cơ quan xử lý liên thông thực tế.
- OCR/chữ ký số/nguồn dữ liệu xác thực vẫn phụ thuộc kết nối nhà cung cấp đã được phê duyệt; không tạo nguồn chứng thực giả.
- Chưa kiểm thử được PostgreSQL thực chạy hoặc build Nuxt nếu môi trường kiểm thử không có Docker/dependencies. Phải chạy các lệnh trên trước khi chia sẻ cho người sử dụng thật.
