<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->
# Triển khai 18 chức năng trên mã nguồn CommuneOS hiện tại

## Phạm vi, cách tích hợp

Bản này được tích hợp trên mã nguồn `commune-os-feat-citizen-portal-integrated (1)(2).zip` do người dùng cung cấp. **Hai chức năng đã có** (kho giấy tờ số và tự điền biểu mẫu) được giữ nguyên. Các thay đổi bổ sung ưu tiên `apps/citizen`, ngoại trừ migration PostgreSQL, `.env.example`, `docker-compose.yml`, và các lệnh kiểm thử trong `Makefile`. Cơ chế bật thủ tục theo xã (`public.procedure_enabled_for`) và thành phần `core/admin`, `apps/commune`, `packs` của phiên bản hiện tại được giữ nguyên.

## Năm chức năng quản trị thông tin và quyền riêng tư

| Yêu cầu | Vị trí giao diện | Điểm tích hợp |
|---|---|---|
| Lịch sử phiên bản và nguồn pháp lý thủ tục | `/thu-tuc/[slug]` | `ProcedureVersionHistory`, API `/api/procedures/[id]/versions`, bảng `citizen_procedure_versions`; nguồn demo *chưa được xác minh* |
| Thông báo khi quy định thay đổi | `/nop-ho-so/[slug]` | `DraftProcedureAlert`, đối chiếu phiên bản và chặn nộp bản nháp chưa rà soát; cần sự kiện công bố qua API dành cho cán bộ |
| Nhật ký sử dụng dữ liệu | `/nhat-ky-du-lieu` | Sự kiện đã tích hợp ghi nhận kèm chuỗi hash phát hiện chỉnh sửa; không khẳng định bao phủ dịch vụ bên ngoài |
| Sự đồng ý và quyền chia sẻ | `/quyen-chia-se` | Lưu sự kiện cấp/rút quyền; thao tác dùng giấy tờ từ kho đòi hỏi quyền còn hiệu lực và xác nhận riêng |
| Vòng đời và thời hạn lưu trữ | `/vong-doi-du-lieu` | Chính sách, yêu cầu của công dân, quét xác định dữ liệu cần xem xét; **không tự động tiêu hủy** |

## Mười ba chức năng hỗ trợ thông minh

| Yêu cầu | Giao diện / endpoint | Giới hạn hiện tại |
|---|---|---|
| QR kiểm chứng kết quả | `/ho-so/[id]/ket-qua`, `/kiem-chung-ket-qua` | Chỉ cấp QR nếu nhà cung cấp trả kết quả PDF `verified`; so khớp SHA-256, **không tự xác thực chữ ký số** |
| Sổ giao dịch hành chính | `/so-giao-dich` | Lọc, tra cứu, CSV trên sự kiện lưu trong hệ thống |
| Đồng bộ liên địa phương | `/dong-bo-du-lieu` | Yêu cầu chia sẻ có xác nhận và hàng đợi cán bộ duyệt; **chưa có hệ thống đồng bộ quốc gia** |
| Trợ lý hướng dẫn điền biểu mẫu | `/nop-ho-so/[slug]` | Hướng dẫn từng trường dựa trên cấu trúc biểu mẫu, không tự lưu/nộp |
| OCR trích xuất giấy tờ | `CitizenDocumentReview`, `/api/ai/document-review` | Cần nhà cung cấp OCR; mặc định tắt, kết quả chỉ là đề xuất có xác nhận |
| Đánh giá chất lượng giấy tờ | `CitizenDocumentReview` | Cảnh báo quy tắc về kích thước, độ sáng/độ mờ; không khẳng định đã kiểm đủ góc/trang |
| Dự đoán cần bổ sung | `CitizenCaseInsights` | Cảnh báo theo quy tắc và sai khác có nguồn, không phải mô hình ML đánh giá hợp lệ |
| Ước lượng thời gian hoàn thành | `CitizenCaseInsights` | Khoảng phân vị từ ít nhất 10 hồ sơ hoàn thành cùng địa phương và thủ tục, không thay thời hạn pháp định |
| Tìm thủ tục qua tình huống | `/tim-theo-tinh-huong` | Từ đồng nghĩa + danh mục đã công bố, không tự tạo thủ tục mới |
| Đề xuất hành động tiếp theo | `CitizenCaseInsights` | Theo trạng thái ghi nhận; công dân quyết định |
| Trợ lý hỏi đáp từng hồ sơ | `CitizenCaseInsights` | Căn cứ sự kiện thực tế đã cấp quyền; không suy đoán lý do |
| Tổng hợp câu hỏi chưa giải đáp | `/api/internal/ai/unanswered` | API thống kê có phân quyền; chỉ trả nhóm có ít nhất 5 câu; chưa có UI cán bộ |
| Phát hiện mâu thuẫn giấy tờ | `CitizenDocumentReview`, `CitizenCaseInsights` | Chỉ đối chiếu thông tin OCR công dân đã kiểm tra, không tự bác hồ sơ |

## Cấu hình chạy thử

1. Sao lưu mã nguồn, PostgreSQL và lưu trữ tệp. Trên thư mục gốc dự án chạy `git apply --check /duong/dan/communeos-18-features-current.patch` rồi mới `git apply` nếu không lỗi; **không áp dụng lại các PATCH cũ** nếu đã dùng PATCH này.
2. Kiểm tra `docker compose config -q`. Tạo/chỉnh `.env` bằng thông tin thử nghiệm riêng; tuyệt đối không commit mật khẩu, khóa OIDC/OCR hay dữ liệu công dân thật.
3. Chỉ trên môi trường demo có bản sao lưu, chạy `make repair-db` để cập nhật tuần tự `16-citizen-procedure-privacy.sql` và `17-citizen-intelligent-services.sql`; lệnh cũng chạy lại quy trình seed hiện có.
4. Chạy `make procedure-privacy-test` và `make intelligent-services-test` khi PostgreSQL hoạt động, sau đó `cd apps/citizen && npm ci && npm test && npm run typecheck && npm run build`.
5. Đăng nhập hai tài khoản thử nghiệm tại hai xã, kiểm tra RLS, quy trình bản nháp đổi phiên bản, quyền chia sẻ, hồ sơ riêng tư và API cán bộ. Không dùng dữ liệu thật trước khi có kiểm toán bảo mật và căn cứ pháp lý phù hợp.

**Những cấu hình quan trọng** (để trống hoặc tắt theo mặc định trong `.env.example`):

- `CITIZEN_GOVERNANCE_TOKEN` và `CITIZEN_STAFF_BRIDGE_TOKEN`: xác thực API quản trị/nội bộ. Yêu cầu bí mật ít nhất 32 ký tự; không đưa vào client.
- `CITIZEN_RETENTION_SCAN_ENABLED`: mặc định `false`, chỉ quét để đề xuất xem xét.
- `CITIZEN_PUBLIC_ORIGIN`: địa chỉ HTTPS đáng tin cậy cho QR (localhost chỉ cho phát triển).
- `CITIZEN_RESULTS_ENDPOINT`, `CITIZEN_RESULTS_TOKEN`: dịch vụ kết quả PDF có xác minh bên ngoài; Docker truyền cả `NUXT_RESULT_*` khi khởi chạy, không tự bật dịch vụ.
- `CITIZEN_OCR_ENDPOINT`, `CITIZEN_OCR_TOKEN`: dịch vụ OCR tin cậy, HTTPS; cần đồng ý cụ thể trước khi gửi giấy tờ.

## Quy tắc đóng góp và giới hạn kiểm thử

- Không thay đổi màn hình cán bộ/quản trị, module của đồng đội hay cấu trúc nhánh `main`.
- Mọi `.md` **tạo mới** cho Kênh công dân đặt trong `apps/citizen/docs/`. File README đã có được giữ nguyên nơi cũ. File mới đều có SPDX Apache-2.0.
- Các kiểm thử Node kiểm tra logic và hợp đồng mã nguồn; **không thay thế** kiểm thử build Nuxt, API thật, quyền PostgreSQL, kiểm thử UX, OCR, dịch vụ ký số hay bảo mật trong môi trường triển khai.
- Không tự động commit, push hoặc merge.
