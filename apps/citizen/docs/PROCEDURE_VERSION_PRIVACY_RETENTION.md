<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# CommuneOS Citizen – Phiên bản thủ tục và quyền riêng tư (5 chức năng)

> **Phạm vi:** Dựa trên bản `commune-os-feat-citizen-portal-integrated.zip` đã áp dụng PATCH Kho giấy tờ + Tự điền + Docker, bản sửa vị trí Markdown và REUSE. Đặt toàn bộ tài liệu mới trong `apps/citizen/docs/`. Đây là bản thử nghiệm; **không phải nguồn quy phạm pháp luật chính thức**.

## 1. Phiên bản thủ tục / nguồn pháp lý

- Trang `/thu-tuc/[slug]` hiển thị mã phiên bản, hiệu lực, đơn vị khai báo, đường dẫn nguồn và lịch sử cập nhật.
- Dữ liệu có sẵn trong `seed.sql` được gắn `unverified_demo`, không tự gán URL hoặc văn bản pháp luật giả.
- `POST /rest/rpc/publish_procedure_version` (API của lõi, chỉ tài khoản `sys_admin`) yêu cầu `confirmed: true`, URL HTTPS thuộc phạm vi `.gov.vn`, `chinhphu.vn`, `vbpl.vn`, văn bản, cơ quan ban hành, thời điểm hiệu lực và phạm vi áp dụng.
- Khi công bố, giao dịch PostgreSQL cập nhật phiên bản **và** danh mục giấy tờ, lệ phí, hạn xử lý, hướng dẫn và gửi thông báo cho mọi bản nháp liên quan. Lịch sử là **append-only**.
- **Giới hạn:** Nguồn chỉ được kiểm tra định dạng/tên miền và được cán bộ khai báo, không tự xác minh tính pháp lý. `scope_note` là mô tả phạm vi, chưa được đối chiếu tự động với ranh giới địa phương. Bản cập nhật `formRevision` có thể cảnh báo thay đổi biểu mẫu nhưng cấu trúc form thực tế nằm trong `shared/procedure-forms.ts`: cần triển khai code form tương ứng trước khi công bố thay đổi biểu mẫu.
- Chưa tự tải quy định từ cơ quan ban hành và chưa kích hoạt phiên bản có hiệu lực trong tương lai. Việc công bố do hệ thống cán bộ tin cậy gọi tại thời điểm hiệu lực.

## 2. Cảnh báo bản nháp

- Khi tạo hồ sơ, hệ thống lưu `procedure_version_id` và `acknowledged_procedure_version_id`.
- Khi cán bộ công bố phiên bản mới, hệ thống ghi thông báo `procedure_change` trong `citizen_notifications` và ghi dấu gửi để không lặp lại.
- Trong `/nop-ho-so/[slug]?draft=...`, khối `DraftProcedureAlert` liệt kê những mục khác biệt. Công dân xem lại và xác nhận qua `POST /api/applications/[id]/procedure-change/ack`.
- `submit.post.ts` **từ chối nộp** nếu phiên bản đã xác nhận không còn là phiên bản mới nhất. Việc khóa hàng thủ tục ở bước nộp giúp hạn chế xung đột công bố đồng thời.
- Chưa triển khai push SMS/email bên ngoài, thông báo nằm trong hệ thống. Trình duyệt đang mở lâu cần làm mới để thấy cảnh báo mới, nhưng API luôn kiểm tra ở lúc nộp.

## 3. Nhật ký sử dụng dữ liệu

- Trang `/nhat-ky-du-lieu`, API `/api/citizen/data-access`.
- Có ghi nhận (trong cùng giao dịch) khi xem hồ sơ cá nhân, mở hồ sơ, đọc gợi ý tự điền, mở/tải tài liệu và chia sẻ từ kho, thay đổi đồng ý, gửi yêu cầu quyền riêng tư.
- Nhật ký theo từng công dân, RLS cô lập hai tài khoản, có hàm băm liên kết theo thứ tự ghi, trigger chặn sửa/xóa, và API kiểm tra lại chuỗi.
- **Giới hạn quan trọng:** Ghi lại những API đã tích hợp, **không phải nhật ký toàn bộ** Keycloak, S3, PostgREST, cán bộ hoặc bên thứ ba. Chuỗi băm phát hiện một số sửa đổi, **không chống quản trị viên CSDL có quyền cao sửa và tính lại chuỗi**. Cần ký mốc kiểm tra ra kho WORM/ngoài hệ thống cho chứng cứ độc lập khi triển khai thật. Metadata không chứa giá trị hồ sơ nhạy cảm.

## 4. Trung tâm đồng ý / chia sẻ

- Trang `/quyen-chia-se`: xem mục đích, nhóm dữ liệu, đơn vị sử dụng, hạn dùng và căn cứ.
- `vault_case_reuse` là mục đích dựa trên **đồng ý**, có thể cấp/rút; lịch sử quyết định là bảng ghi thêm, mặc định có thời hạn 180 ngày.
- API sao chép giấy tờ từ kho sang hồ sơ kiểm tra **quyền đang hiệu lực** và yêu cầu `confirmed: true` cho từng lần đính kèm. Nếu rút quyền, thao tác chia sẻ trong tương lai bị từ chối; không xóa các bản sao đã nộp.
- `case_required_processing` là ví dụ minh họa hoạt động có thể dựa trên căn cứ khác, **không cung cấp nút rút đồng ý**; cơ quan vận hành phải thẩm định và cấu hình căn cứ pháp lý thực.
- **Thay đổi hành vi:** Trước khi tái sử dụng giấy tờ từ kho, công dân cần đến trang Quyền chia sẻ để cấp quyền. Việc tải mới một tệp vào hồ sơ không sử dụng kho không bị ảnh hưởng.

## 5. Vòng đời / lưu trữ và yêu cầu công dân

- Trang `/vong-doi-du-lieu`: chính sách từng nhóm dữ liệu, danh sách cần xem xét, yêu cầu truy cập/đính chính/hạn chế/xóa/xem xét thời hạn và trạng thái tiếp nhận.
- Mặc định chưa cấu hình thời hạn lưu trữ hành chính **đã phê duyệt**, nên không tự xóa hoặc hạn chế hồ sơ.
- API của lõi `POST /rest/rpc/scan_citizen_retention` (lãnh đạo xã) phát hiện phiên bản giấy tờ quá hạn, đồng thời xem xét hồ sơ đã kết thúc nếu chính sách `case-retention` được phê duyệt và có thời hạn; có dedup và thông báo trong hệ thống.
- API của lõi cho lãnh đạo xã: `rpc/citizen_privacy_requests` (danh sách trong đơn vị) và `rpc/review_citizen_privacy_request` quyết định trạng thái yêu cầu. `rpc/citizen_retention_reviews` (danh sách chờ xem xét) và `rpc/decide_citizen_retention` quyết định `restricted` / `archived` / `keep`; quyết định `restricted` hay `archived` sẽ chặn truy cập/tái sử dụng phiên bản giấy tờ liên quan. Có ghi nhật ký.
- **Tự động quét:** đặt `CITIZEN_RETENTION_SCAN_ENABLED=true` tại `.env` và khởi động lại `citizen`. Plugin Nitro bắt đầu kiểm tra sau khi server chạy khoảng 60 giây và lặp lại mỗi 24 giờ khi container còn chạy. Mặc định **tắt** để không làm thay đổi hoạt động demo nếu chưa lựa chọn. Cũng có thể gọi `POST /rest/rpc/scan_citizen_retention` bằng token lãnh đạo xã từ job định kỳ; nhiều lần quét không tạo trùng review.
- **Giới hạn:** Không xóa dữ liệu vật lý hay file object store. Máy chủ phải hoạt động để lịch quét chạy; nếu yêu cầu lịch chính xác tại một giờ nhất định, sử dụng bộ lập lịch ngoài và tắt plugin. Khi triển khai thực tế, tiêu hủy cần quy trình phê duyệt, đảm bảo nghĩa vụ lưu trữ và xóa an toàn cả bản sao lưu.

## Cập nhật và kiểm thử

Sau khi **sao lưu PostgreSQL và tệp**, áp dụng PATCH với `git apply --check` rồi `git apply`. Cập nhật CSDL thông qua `make repair-db` hoặc `docker compose run --rm db-setup`. Các lệnh init là idempotent nhưng vẫn thực thi lại schema/seed hiện hữu; hãy kiểm tra bản sao lưu trước.

```bash
cd apps/citizen
npm ci
npm test
npm run typecheck
npm run build
cd ../..
make procedure-privacy-test
```

Kiểm thử trình duyệt trong môi trường demo cô lập bằng `npm run test:e2e` (yêu cầu Playwright và các dịch vụ đã chạy). Không sử dụng dữ liệu cá nhân thật.

### API công bố phiên bản (API của lõi, chỉ quản trị hệ thống)

`POST /rest/rpc/publish_procedure_version` qua cổng APISIX bằng token Keycloak của tài khoản `sys_admin`, thân `{"p_data": {...}}`. Ví dụ `p_data` với các **giá trị minh họa, không phải văn bản có thật**:

```json
{
  "procedureId": "chung-thuc",
  "title": "Chứng thực bản sao (mẫu)",
  "summary": "Ví dụ minh họa cập nhật thủ tục",
  "instructions": "Đối chiếu theo văn bản gốc.",
  "feeNote": "Theo biểu phí mẫu mới",
  "slaDays": 2,
  "formRevision": "sample-2",
  "documents": [{"documentCode":"ban-chinh","documentName":"Bản chính cần đối chiếu","isRequired":true}],
  "sourceUrl": "https://vbpl.vn/",
  "sourceTitle": "Nguồn tham khảo (ví dụ)",
  "sourceReference": "THAM-CHIEU-GIA-2026",
  "issuingAuthority": "Cơ quan giả lập",
  "scopeNote": "Phạm vi mô phỏng",
  "effectiveFrom": "2026-11-17",
  "changeNote": "Minh họa thay đổi thời hạn",
  "confirmed": true
}
```

**Không gửi ví dụ trên vào môi trường thật**. Luồng này cần chức năng xác thực và phê duyệt nội dung của cơ quan phụ trách trước khi công bố. Cần dùng ngày hiệu lực thực và URL văn bản thực.

## Những điểm cần hoàn thiện trước khi vận hành thật

1. Quy trình phê duyệt, đối chiếu nguồn chính thức và phạm vi áp dụng theo địa phương.
2. Lịch quét vòng đời, phê duyệt tiêu hủy và xử lý file vật lý.
3. Tích hợp nhật ký từ Core/Staff/Keycloak/Storage, neo dấu băm bên ngoài.
4. Kiểm thử PostgreSQL thật, luồng OIDC/Keycloak và build Nuxt trên môi trường triển khai.
5. Quy định về thời hạn và xử lý dữ liệu do đơn vị có thẩm quyền phê duyệt; không suy đoán pháp luật từ dữ liệu demo.
