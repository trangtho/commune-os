<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->
# 13 tiện ích công dân bổ sung — Hướng dẫn kỹ thuật

## Phạm vi và sự thật về AI

Bản cập nhật bổ sung UI + API cho 13 yêu cầu theo hướng **an toàn, không suy đoán**. Mọi hình thức dự báo theo mẫu thống kê, phân loại theo quy tắc hoặc gợi ý từ danh mục không được gọi là mô hình AI học máy. Tích hợp OCR **chỉ hoạt động khi có dịch vụ thật** được cấu hình. Kết quả ký số **chỉ đối chiếu dữ liệu theo nhà cung cấp và SHA-256 PDF**, không tự xác nhận chữ ký số bằng chứng thư tin cậy.

| # | Chức năng | Giao diện/API | Trạng thái |
|---|---|---|---|
| 1 | Kiểm chứng PDF qua mã QR | `/ho-so/:id/ket-qua`, `/kiem-chung-ket-qua`, API `POST /api/applications/:id/verification` | Có luồng ký số ngoài hệ thống, mã ngẫu nhiên, hash SHA-256; QR SVG qua `qrencode`. Cần kết nối nguồn kết quả thật. |
| 2 | Sổ giao dịch và CSV | `/so-giao-dich`, `GET /api/citizen/transactions?format=csv` | Từ sự kiện đã lưu, lọc và xuất; chỉ tài khoản sở hữu. |
| 3 | Đồng bộ giữa địa phương | `/dong-bo-du-lieu`, `POST /api/citizen/sync`, lãnh đạo xã dùng `rpc/citizen_sync_queue`, `rpc/decide_citizen_sync` (API của lõi) | Trao đổi dữ liệu tự khai theo yêu cầu; cán bộ xem xét xung đột, không cập nhật tự động. Chưa kết nối nền tảng liên tỉnh. |
| 4 | Hướng dẫn biểu mẫu theo bước | `/nop-ho-so/:slug`, `GET /api/procedures/:id/guide` | Gợi ý dựa trên trường biểu mẫu; không tự thay đổi hoặc nộp. |
| 5 | OCR | Bước tải tài liệu `CitizenDocumentReview`, API `POST /api/ai/document-review` | Tùy chọn nhà cung cấp, cần đồng ý tường minh. Không cấu hình thì báo chưa có. |
| 6 | Chất lượng ảnh | `CitizenDocumentReview`, `utils/document-quality.ts` | Kiểm tra kích thước, ánh sáng và độ sắc nét trên trình duyệt; không xác minh đủ trang/cắt góc. |
| 7 | Cảnh báo nguy cơ bổ sung | `CitizenCaseInsights`, `GET /api/applications/:id/insights` | Dựa trên preflight và sai khác do người dùng xác nhận, không chấm điểm kết luận pháp lý. |
| 8 | Ước lượng thời gian | `CitizenCaseInsights`, SQL `citizen_forecast_days` | Phân vị 25–75 theo ít nhất 10 hồ sơ đã hoàn thành cùng thủ tục/địa phương, hiển thị số hồ sơ đang xử lý; chưa có mô hình học máy hay hiệu chỉnh theo tải. |
| 9 | Tìm theo tình huống | `/tim-theo-tinh-huong`, `POST /api/procedures/situation` | Quy tắc từ đồng nghĩa + đối chiếu danh mục công bố, có câu hỏi gợi ý, không phải vector AI. |
| 10 | Gợi ý hành động tiếp | `CitizenCaseInsights` | Dựa trên trạng thái hồ sơ thực; chỉ điều hướng, không tự xử lý. |
| 11 | Trợ lý theo từng hồ sơ | `CitizenCaseInsights`, `POST /api/applications/:id/ask` | Trả lời dựa trên trạng thái, ghi chú, sự kiện người dùng được xem; không bịa nguyên nhân. |
| 12 | Phân tích câu hỏi chưa giải đáp | `POST /rest/rpc/citizen_unanswered_summary` (API của lõi, lãnh đạo xã) | Chỉ thống kê chủ đề, mỗi nhóm tối thiểu 5 câu trong 90 ngày; không lưu câu hỏi gốc trong bảng tổng hợp. Chưa có màn hình cán bộ. |
| 13 | Phát hiện mâu thuẫn giấy tờ | `CitizenDocumentReview`, `POST /api/applications/:id/observations`, `CitizenCaseInsights` | Chỉ từ trường OCR đã được công dân rà soát và xác nhận; cảnh báo, không tự bác hồ sơ. |

## Migration và vận hành

1. Sao lưu PostgreSQL và object store (SeaweedFS) trước khi chạy.
2. Áp dụng incremental PATCH **sau** 5 chức năng trước, dùng `git apply --check` và `git apply`, không ghi đè thay đổi nhóm.
3. `docker compose config -q`; cập nhật `.env`; `make repair-db` chạy tất cả schema/seed hiện có, hãy kiểm tra tính idempotent tại môi trường thực tế trước khi chạy với dữ liệu thật.
4. `make intelligent-services-test` (chạy SQL trong transaction rollback); `cd apps/citizen && npm ci && npm test && npm run typecheck && npm run build`.
5. Kiểm thử giao diện bằng ít nhất hai tài khoản ở hai địa phương; kiểm tra RLS, API nội bộ và mọi tình huống OCR chưa cấu hình.

**Cấu hình thêm (mặc định không kết nối):**

- `CITIZEN_PUBLIC_ORIGIN`: URL HTTPS đáng tin cậy (ví dụ `https://congdan.example.vn`); bắt buộc khi tạo mã QR. Không lấy host tự khai từ request.
- `CITIZEN_RESULTS_ENDPOINT`, `CITIZEN_RESULTS_TOKEN`: kho văn bản kết quả đã có từ trước. Chỉ cấp QR khi metadata trả `verification=verified` **và** PDF hợp lệ. Trang kiểm chứng tải lại PDF và đối chiếu SHA-256; nếu không liên hệ được nhà cung cấp hiển thị "chưa thể kiểm chứng".
- `CITIZEN_OCR_ENDPOINT`, `CITIZEN_OCR_TOKEN`: HTTPS endpoint do đơn vị phê duyệt. Contract: HTTP POST multipart `file` + `requestedFields` (JSON danh sách key), header `Authorization: Bearer <token>`; response `{"fields":{"birthDate":{"value":"2020-01-01","confidence":0.91}}}`. Không lưu ảnh OCR trong endpoint; nhà cung cấp phải có chính sách dữ liệu riêng.
- `qrencode` phải cài trên môi trường chạy Node Nitro; Dockerfile runtime đã có gói Alpine.

## Yêu cầu trước triển khai thực tế

- Tất cả dữ liệu thủ tục demo trước đây **không được tự coi là nguồn pháp lý đã xác minh**.
- Chỉ dùng dữ liệu mô phỏng. Kiểm tra pháp lý các mục đích xử lý, căn cứ trao đổi dữ liệu, lưu trữ và hoạt động OCR.
- Cần tích hợp dịch vụ xác minh chữ ký số theo chuẩn phù hợp trước khi công bố kết quả "được xác thực chữ ký số".
- Cần nhà cung cấp OCR và các tập dữ liệu được thẩm định, phép đo chất lượng mô hình, quy trình đánh giá sai lệch trước khi gọi các tiện ích quy tắc là "AI dự đoán" hay "AI OCR" thực tế.
- Mã tra cứu QR là bearer token, ai có link có thể xem trạng thái tối thiểu; không đưa họ tên, mã định danh, ngày sinh trong phản hồi. Mã hết hạn sau 180 ngày hoặc bị thu hồi khi cấp lại.
- API đồng bộ chỉ gửi request và cung cấp payload cho lãnh đạo xã được chỉ định xem xét qua API của lõi; chưa có hệ thống master-data bên ngoài và **không đồng bộ ngầm**.
- Kiểm thử tại môi trường CI có Docker/PostgreSQL/Playwright vẫn bắt buộc; chỉ chạy Node test không chứng minh hoạt động thực tế.

## Thư mục tài liệu

Mọi file Markdown **được tạo mới** đặt trong `apps/citizen/docs`. README có sẵn không di chuyển. Không tự động commit, push hoặc merge.
