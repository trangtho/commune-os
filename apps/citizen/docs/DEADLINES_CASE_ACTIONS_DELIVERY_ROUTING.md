<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# Cảnh báo hạn xử lý, đề nghị về hồ sơ, nhận kết quả và chuyển cơ quan

**Phạm vi:** Kênh công dân CommuneOS, dựa trên mã nguồn đã có chức năng kiểm tra trước nộp và tiến trình cán bộ. Đây là cơ chế hỗ trợ tiếp nhận yêu cầu; **không tự kết luận điều kiện pháp lý hoặc phê duyệt thay cán bộ**.

## Giao diện công dân

| Trang | Mục đích |
| --- | --- |
| `/ho-so/:id/yeu-cau` | Cảnh báo gần hạn/quá hạn, lý do do cán bộ nhập, gửi đề nghị xem xét/chỉnh sửa/rút và tạo nháp nộp lại |
| `/ho-so/:id/nhan-ket-qua` | Xem danh sách phương thức nhận kết quả đã được cơ quan phê duyệt, lưu lựa chọn, theo dõi kết quả giao nhận |
| `/ho-so/:id/chuyen-co-quan` | Xem cơ quan tiếp nhận, tuyến được phê duyệt và gửi đề nghị chuyển đến cơ quan khác |

Các trang được dẫn từ `/ho-so/:id`. Danh sách `/ho-so` hiển thị cảnh báo dựa trên `due_at` cho hồ sơ đang xử lý.

## Thời hạn

- `GET /api/applications/:id/deadline` đối chiếu `due_at` với ngày hiện tại của PostgreSQL. Khi còn 2 ngày hoặc quá hạn sẽ tạo cảnh báo **một lần trên mỗi mức** (`approaching`, `overdue`) và thông báo trong hộp thư công dân; dữ liệu đã lưu không bị suy diễn là chính sách SLA chính thức.
- Lý do thay đổi hiển thị từ `citizen_case_stage_updates`, chỉ khi cán bộ đã ghi nhận. Không tự động sinh lời giải thích hoặc tự cập nhật hạn dự kiến.
- `POST /api/internal/deadlines/scan` dùng bearer token của kênh backend cán bộ và `x-communeos-tenant-id`, `x-communeos-staff-id` để quét hồ sơ đến hạn theo địa phương, tạo thông báo đã khử trùng lặp.
- **Chưa có bộ lập lịch chạy sẵn**: để cảnh báo chủ động cho công dân không mở ứng dụng, nhóm vận hành cần cấu hình scheduler an toàn gọi endpoint trên theo chu kỳ (ví dụ hằng ngày), qua mạng nội bộ. Không để token xuất hiện trên trình duyệt/log.

## Yêu cầu xử lý hồ sơ

- `GET/POST /api/applications/:id/requests` nhận các loại `deadline_review`, `amendment`, `withdrawal`, `transfer`; chỉ tài khoản chủ hồ sơ có quyền gửi; cùng một loại đề nghị đang chờ không được gửi trùng.
- Trạng thái từ `draft`, `completed`, `rejected` hoặc `withdrawn` không được gửi đề nghị trên hồ sơ đang hoạt động.
- Đề nghị **chỉnh sửa** không cập nhật trực tiếp hồ sơ đã nộp. Cần quy trình nghiệp vụ cán bộ phê duyệt và xử lý trên hệ thống cán bộ; API hiện chỉ ghi nhận quyết định và nhật ký, chưa tự thay đổi biểu mẫu chính thức.
- Đề nghị **rút** chỉ đổi trạng thái thành `withdrawn` nếu backend cán bộ đã xác thực, đúng cơ quan tiếp nhận và phê duyệt; không thay đổi khi công dân mới gửi đề nghị.
- `POST /api/applications/:id/reapply` chỉ cho hồ sơ đã `rejected`, `completed`, `withdrawn`: sao chép thông tin biểu mẫu từ hồ sơ cũ thành **bản nháp mới**, không sao chép file đính kèm hoặc trạng thái hoàn tất. Recheck quyền đại diện, thủ tục được công bố và địa phương tiếp nhận.

## Phương thức nhận kết quả

- **Không seed phương thức pháp lý mặc định**. Phải công bố từng `procedure_id`, `tenant_id`, `method` với căn cứ phê duyệt, ngày hết hạn trong `citizen_result_channels`.
- `GET /api/applications/:id/delivery` chỉ hiển thị những phương thức còn hiệu lực và dữ liệu giao nhận của chính công dân.
- `POST /api/applications/:id/delivery` yêu cầu phương thức có phê duyệt; gửi bưu chính yêu cầu địa chỉ và điện thoại. Nếu cán bộ đã xác nhận trạng thái khác `selected`, công dân không thể tự sửa.
- Chỉ hiển thị mã vận đơn và trạng thái khi cán bộ cập nhật. Nút xem văn bản điện tử vẫn dùng endpoint kết quả ký số có xác thực hiện tại, không tự tạo văn bản hoặc mã giao nhận.

## Gợi ý và chuyển cơ quan

- Tái sử dụng `citizen_procedure_receivers` hiện có; chỉ tuyến `enabled`, có `approval_reference`, `valid_until > now()` mới được gợi ý. Dữ liệu địa phương từ cá nhân hóa có thể là tự khai nên **không dùng để kết luận thẩm quyền**.
- Công dân có thể gửi `transfer` đến một tuyến đã duyệt; không tự cập nhật `receiving_tenant_id`.
- Cán bộ nguồn khởi tạo giao dịch và đơn vị đích **phải xác nhận tiếp nhận**. Khi có xác nhận hợp lệ và tuyến còn hiệu lực, `receiving_tenant_id` mới được đổi, lưu trong `citizen_case_transfer_handoffs` và `application_events`. Quyền sở hữu hồ sơ của công dân (`tenant_id`, `citizen_id`) không đổi.
- Dự án cán bộ cần đồng bộ workflow và hồ sơ vật lý/hồ sơ điện tử phù hợp trước khi coi quá trình chuyển giao hoàn tất về mặt nghiệp vụ.

## API dành cho dịch vụ cán bộ (chưa có giao diện cán bộ tương ứng)

**Tất cả các API sau yêu cầu `Authorization: Bearer <CITIZEN_STAFF_BRIDGE_TOKEN>` và hai header định danh nhân sự/địa phương do backend cán bộ đã xác thực truyền qua mạng nội bộ**. Header không được nhận trực tiếp từ giao diện công dân. Chỉ bật token sau khi đã kiểm tra ranh giới mạng và xác thực dịch vụ cán bộ.

| Endpoint | Ý nghĩa |
| --- | --- |
| `GET /api/internal/cases/requests` | Danh sách đề nghị đang chờ của địa phương |
| `POST /api/internal/cases/requests/:id/decide` | Duyệt/từ chối đề nghị không phải chuyển cơ quan (`approved`, `response`) |
| `POST /api/internal/cases/transfers/start` | Chuyển yêu cầu đã xác thực (`requestId`, `response`) sang trạng thái chờ đích |
| `GET /api/internal/cases/transfers` | Danh sách chuyển giao đang chờ thuộc địa phương nhận |
| `POST /api/internal/cases/transfers/:id/decide` | Đơn vị nhận xác nhận/từ chối (`accepted`, `reason`) |
| `POST /api/internal/results/methods` | Công bố phương thức trả kết quả (`procedureId`, `method`, `approvalReference`, `validUntil`, `instructions`) |
| `POST /api/internal/results/delivery` | Cập nhật trạng thái giao nhận (`applicationId`, `status`, `shipmentReference`, `note`) |
| `POST /api/internal/deadlines/scan` | Ghi nhận cảnh báo gần/quá hạn theo địa phương qua công việc định kỳ |

Cần phân quyền nghiệp vụ theo **vai trò cán bộ** ở hệ thống nguồn; token chia sẻ chỉ là cơ chế xác thực dịch vụ, không thay thế RBAC hoặc xác minh danh tính pháp lý.

## Cơ sở dữ liệu & nghiệm thu

- Migration: `core/db/init/13-citizen-case-actions-delivery-routing.sql` được chạy trong `db-setup` (trước `12-workflow-secret.sh`). PostgreSQL lưu lựa chọn và yêu cầu riêng của công dân theo FORCE RLS.
- Đã thêm trạng thái `withdrawn` vào `applications` để hiển thị đúng hồ sơ được phép rút.
- `npm --prefix apps/citizen test` chạy kiểm thử Node.js.
- `make COMPOSE="docker compose -f docker-compose.yml" repair-db` để chạy lại migration trên volume hiện tại (sao lưu trước khi nâng cấp).
- `make COMPOSE="docker compose -f docker-compose.yml" case-actions-test` chạy kiểm thử SQL **có ROLLBACK**: quyền truy cập, cán bộ sai xã, chuyển tiếp cần xác nhận, giao nhận.
- Nên chạy thêm `npm --prefix apps/citizen run build`, `npm --prefix apps/citizen run typecheck`, Playwright và một môi trường PostgreSQL mới trước khi merge.
- Không chạy `docker compose down -v` nếu muốn giữ dữ liệu.

## Giới hạn triển khai

Các API cán bộ đã được chuẩn bị nhưng chưa gắn với giao diện `apps/commune`, workflow liên cơ quan thật, kho văn bản ký số và bên chuyển phát. Không tự tạo quy định trả kết quả, không tự cấp thẩm quyền cho địa phương, không tự hoàn tất xử lý hồ sơ chỉ vì nhận yêu cầu. Bộ quét cảnh báo cần scheduler ngoài ứng dụng để phát thông báo ngay cả khi công dân không mở trang.
