-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
--
-- Gói nghiệp vụ xã: mô tả tiếng Việt cho từng hàm, bảng ảo của gói trong schema api. PostgREST đưa các mô tả này vào tài liệu
-- OpenAPI tự sinh (GET /rest/), trang tài liệu API (/docs/ ở cổng APISIX) hiển thị lại.
-- Dòng đầu là tóm tắt, phần sau dòng trống là mô tả chi tiết.
-- Chạy cuối cùng trong gói (các tệp trước có thể tạo lại bảng ảo làm mất mô tả). Chạy lại nhiều lần được;
-- hàm, bảng ảo chưa có thì bỏ qua.

-- Mô tả chung của schema api và của các API thuộc lõi: core/db/init/90-mo-ta-api.sql (chạy sau mọi gói).

DO $$
DECLARE
  item record;
  fn oid;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    -- ===== Bảng ảo: cán bộ, lãnh đạo, quản trị =====
    ('procedures', 'Danh mục thủ tục kèm trạng thái bật theo xã',
     'Cán bộ thấy thủ tục xã mình đang mở; quản trị hệ thống thấy toàn bộ danh mục.'),
    ('dossiers', 'Hồ sơ của dân gửi tới xã',
     'Chỉ hồ sơ của xã người gọi (RLS). Trạng thái: submitted (mới nộp), processing (đang xử lý), supplement (chờ bổ sung), completed (hoàn thành), rejected (từ chối). Quản trị hệ thống không đọc được nội dung hồ sơ.'),
    ('dossier_events', 'Nhật ký thao tác trên hồ sơ',
     'Mỗi lần chuyển bước, phân công, ghi chú đều có một dòng; lọc theo dossier_id.'),
    ('dossier_documents', 'Giấy tờ đính kèm của hồ sơ',
     'Siêu dữ liệu (tên, loại, kích thước, SHA-256). Tải nội dung tệp bằng GET /files/documents/{id}.'),
    ('dossier_assignments', 'Phân công hồ sơ cho cán bộ', 'Hồ sơ nào đang giao cho ai, ai giao, lúc nào.'),
    ('dossier_transitions', 'Các bước chuyển trạng thái hồ sơ được phép',
     'Cặp from_status → to_status. Chuyển bước thực tế đi qua dịch vụ điều phối (/workflow), không gọi thẳng set_dossier_status.'),
    ('procedure_documents', 'Giấy tờ yêu cầu của từng thủ tục', 'Bảng kiểm giấy tờ: mã loại, tên, bắt buộc hay không.'),
    ('staff_profiles', 'Hồ sơ cán bộ của xã', 'Lãnh đạo xem toàn bộ cán bộ xã mình; cán bộ xem hồ sơ của chính mình qua my_profile.'),
    ('staff_tasks', 'Việc lãnh đạo giao cho cán bộ', 'Lãnh đạo thấy mọi việc của xã; tạo bằng rpc/create_staff_task.'),
    ('staff_requests', 'Đề nghị của cán bộ chờ lãnh đạo duyệt',
     'Sửa hồ sơ cá nhân, thêm/xóa giấy tờ, trình duyệt kết quả hồ sơ, đề nghị khác. Duyệt bằng rpc/decide_staff_request.'),
    ('staff_documents', 'Giấy tờ cá nhân của cán bộ', 'Tải nội dung bằng GET /files/staff-documents/{id}.'),
    ('staff_workload', 'Khối lượng việc của từng cán bộ', 'Số hồ sơ đang xử lý, việc được giao còn mở, quá hạn; dùng cho trang báo cáo của lãnh đạo.'),
    ('staff_notifications', 'Thông báo cho cán bộ đang đăng nhập', 'Đánh dấu đã đọc bằng rpc/read_staff_notification.'),
    ('my_profile', 'Hồ sơ cá nhân của cán bộ đang đăng nhập', NULL),
    ('my_tasks', 'Việc được giao cho cán bộ đang đăng nhập', 'Cập nhật tiến độ bằng rpc/update_my_task.'),
    ('my_requests', 'Đề nghị cán bộ đang đăng nhập đã gửi', 'Rút đề nghị chưa duyệt bằng rpc/cancel_my_request.'),
    ('my_documents', 'Giấy tờ cá nhân của cán bộ đang đăng nhập', NULL),
    -- ===== Bảng ảo: công dân =====
    ('my_citizen_profile', 'Thông tin công dân đang đăng nhập (token citizen-app)', 'RLS chỉ trả đúng một dòng.'),

    -- ===== Hàm: khách và công dân =====
    ('procedure_catalog', 'Danh mục thủ tục đã công bố',
     'Khách gọi qua /public/rpc/procedure_catalog; công dân thấy thủ tục xã mình đang mở. Lọc theo p_q (từ khóa), p_category.'),
    ('procedure_detail', 'Chi tiết một thủ tục', 'Thành phần hồ sơ, lệ phí, thời hạn, biểu mẫu. Khách gọi qua /public/rpc/procedure_detail.'),
    ('citizen_profile', 'Hồ sơ cá nhân của công dân đang đăng nhập', NULL),
    ('citizen_profile_update', 'Công dân sửa tên hiển thị, email, số điện thoại, địa chỉ', NULL),
    ('citizen_applications', 'Hồ sơ của tôi (công dân)',
     'Lọc theo p_status, tìm theo p_term; p_paged = true thì trả theo trang (p_page).'),
    ('citizen_application', 'Chi tiết một hồ sơ của công dân', 'Gồm tiến độ, giấy tờ, yêu cầu bổ sung.'),
    ('citizen_application_create', 'Tạo bản nháp hồ sơ',
     'Lõi kiểm tra thủ tục đang mở ở xã tiếp nhận. Trả mã hồ sơ và revision để tự lưu.'),
    ('citizen_application_update', 'Sửa bản nháp hồ sơ', NULL),
    ('citizen_application_autosave', 'Tự lưu biểu mẫu của bản nháp',
     'p_expected_revision chống ghi đè khi mở cùng bản nháp ở hai nơi: sai revision thì báo xung đột.'),
    ('citizen_application_draft', 'Dữ liệu bản nháp để kiểm tra biểu mẫu trước khi lưu hoặc nộp', NULL),
    ('citizen_application_submit', 'Nộp hồ sơ',
     'p_expected_updated_at: thời điểm sửa bản nháp đã được kiểm tra; bản nháp đổi sau đó thì từ chối. Lõi kiểm tra lại đủ giấy tờ bắt buộc.'),
    ('citizen_document_add', 'Ghi giấy tờ của bản nháp hoặc hồ sơ đang bổ sung',
     'Tệp đã lưu vào kho đối tượng của lõi; hàm chỉ ghi siêu dữ liệu. Khóa tệp không bao giờ trả cho trình duyệt.'),
    ('citizen_document_file', 'Siêu dữ liệu để tải một giấy tờ của công dân', 'Có ghi nhật ký sử dụng dữ liệu cá nhân.'),
    ('citizen_document_remove', 'Xóa giấy tờ của bản nháp hoặc hồ sơ đang bổ sung', 'Trả khóa tệp để xóa trong kho đối tượng.'),
    ('citizen_notifications', 'Thông báo của công dân', 'Lọc theo p_q, p_category, p_unread; p_paged = true thì trả theo trang.'),
    ('citizen_notification_read', 'Đánh dấu một thông báo đã đọc', NULL),
    ('citizen_notifications_read_all', 'Đánh dấu mọi thông báo đã đọc', NULL),

    -- ===== Hàm: cán bộ xử lý hồ sơ =====
    ('set_dossier_status', 'Ghi trạng thái mới của hồ sơ (chỉ dịch vụ điều phối gọi)',
     'Cần khóa nội bộ X-Workflow-Token. Ứng dụng chuyển bước qua POST /workflow/dossiers/{id}/actions để quy trình BPMN kiểm tra bước được phép.'),
    ('register_document', 'Ghi giấy tờ cán bộ vừa tải lên hồ sơ (chỉ dịch vụ tệp gọi)', 'Ứng dụng tải tệp qua POST /files/dossiers/{id}/documents.'),
    ('document_object', 'Khóa đối tượng của một giấy tờ hồ sơ (chỉ dịch vụ tệp gọi)', 'Ứng dụng tải tệp qua GET /files/documents/{id}.'),
    ('read_dossier_supplement', 'Yêu cầu bổ sung và phần công dân đã bổ sung của một hồ sơ', 'Chỉ hồ sơ của xã tiếp nhận.'),
    ('request_citizen_case_supplement', 'Yêu cầu công dân bổ sung hồ sơ',
     'p_items: danh sách giấy tờ, thông tin cần bổ sung; p_note: lời nhắn cho công dân.'),
    ('record_citizen_case_stage', 'Ghi một mốc tiến độ hồ sơ hiển thị cho công dân', NULL),
    ('request_dossier_approval', 'Trình lãnh đạo duyệt kết quả hồ sơ', 'proposal: completed (hoàn thành) hoặc rejected (từ chối, cần lý do).'),
    ('publish_counter_slot', 'Mở một khung giờ hẹn tại bộ phận một cửa', NULL),
    ('list_counter_tickets', 'Danh sách lượt hẹn của một khung giờ', 'Không chứa thông tin định danh của công dân.'),
    ('set_counter_ticket_status', 'Cập nhật trạng thái lượt hẹn',
     'booked → checked_in (đã đến) hoặc no_show (vắng); checked_in → serving (đang phục vụ) hoặc no_show; serving → done.'),

    -- ===== Hàm: cán bộ (hồ sơ cá nhân, việc được giao, đề nghị) =====
    ('request_profile_update', 'Đề nghị sửa hồ sơ cá nhân', 'Chỉ nhận các trường cho phép; trường để trống là không đổi. Chờ lãnh đạo duyệt.'),
    ('request_document_add', 'Đề nghị thêm giấy tờ cá nhân (chỉ dịch vụ tệp gọi)', 'Ứng dụng tải tệp qua POST /files/staff-documents.'),
    ('request_document_remove', 'Đề nghị xóa một giấy tờ cá nhân', NULL),
    ('request_other', 'Gửi đề nghị khác tới lãnh đạo', NULL),
    ('cancel_my_request', 'Rút một đề nghị chưa được duyệt', NULL),
    ('update_my_task', 'Cập nhật tiến độ việc được giao', 'status: todo, doing, done; result_note: kết quả khi xong.'),
    ('read_staff_notification', 'Đánh dấu một thông báo cán bộ đã đọc', NULL),
    ('read_all_staff_notifications', 'Đánh dấu mọi thông báo cán bộ đã đọc', NULL),
    ('staff_document_object', 'Khóa đối tượng của giấy tờ cán bộ (chỉ dịch vụ tệp gọi)', 'Ứng dụng tải tệp qua GET /files/staff-documents/{id}.'),

    -- ===== Hàm: lãnh đạo xã =====
    ('assign_dossier', 'Phân công hồ sơ cho một cán bộ', 'Ghi vào nhật ký hồ sơ và sổ ghi nhận.'),
    ('create_staff_task', 'Giao việc cho cán bộ', 'Có thể gắn với một hồ sơ (dossier_id) và hạn hoàn thành (due_date).'),
    ('cancel_staff_task', 'Hủy việc đã giao', NULL),
    ('decide_staff_request', 'Duyệt hoặc từ chối đề nghị của cán bộ', 'approve = true thì áp dụng thay đổi; note: lý do khi từ chối.'),
    ('leader_save_staff_profile', 'Lãnh đạo sửa thẳng hồ sơ cán bộ', 'Không cần duyệt; có thể đánh dấu cán bộ đã nghỉ việc.'),
    ('broadcast_citizen_notice', 'Gửi thông báo tới mọi công dân của xã', NULL),

    -- ===== Hàm: quản trị hệ thống =====
    ('import_procedure', 'Nạp hoặc cập nhật một thủ tục từ gói thủ tục',
     'pack: nội dung pack.yaml đã đọc thành JSON. Thủ tục mới chưa bật cho xã nào. Chỉ sys_admin.'),
    ('set_tenant_procedure', 'Bật hoặc tắt một thủ tục cho một xã', 'Ví dụ {"tenant_code":"xa-b","procedure_id":"khai-sinh","enabled":false}. Chỉ sys_admin.'),
    ('set_tenant_procedures', 'Bật hoặc tắt nhiều thủ tục cho một xã', 'Ví dụ {"tenant_code":"xa-b","procedure_ids":["khai-sinh","ket-hon"],"enabled":true}. Chỉ sys_admin.'),
    ('set_procedure_tenants', 'Bật hoặc tắt một thủ tục cho nhiều xã', 'Ví dụ {"procedure_id":"khai-sinh","tenant_codes":["xa-a","xa-b"],"enabled":true}. Chỉ sys_admin.'),

    -- ===== Hàm: cán bộ xử lý phần việc từ Kênh người dân (core/db/init/26-citizen-staff-api.sql) =====
    ('citizen_support_tickets', 'Yêu cầu hỗ trợ công dân gửi tới xã', 'p_limit: số yêu cầu tối đa (1–200, mặc định 50).'),
    ('citizen_support_ticket', 'Chi tiết một yêu cầu hỗ trợ kèm lịch sử trao đổi', NULL),
    ('update_citizen_support_ticket', 'Trả lời, cập nhật trạng thái yêu cầu hỗ trợ',
     'p_status: processing, waiting_citizen, answered, resolved, closed; p_message: nội dung gửi công dân; p_resolution: kết quả.'),
    ('redeem_citizen_handoff', 'Dùng mã chuyển hồ sơ tại quầy công dân đưa',
     'p_code: mã 32 ký tự. Mã dùng một lần, có hạn, chỉ xã tiếp nhận đọc được; trả bản nháp và danh sách giấy tờ để cán bộ đối chiếu.'),
    ('citizen_handoff_document', 'Khóa tệp của giấy tờ trong mã chuyển đã dùng (chỉ dịch vụ tệp gọi)',
     'Ứng dụng tải tệp qua GET /files/handoffs/{id}/documents/{id}.'),
    ('citizen_case_requests', 'Đề nghị điều chỉnh hồ sơ công dân gửi tới xã', NULL),
    ('decide_citizen_case_request', 'Chấp thuận hoặc từ chối đề nghị điều chỉnh hồ sơ', 'p_response: phản hồi gửi công dân (5–1000 ký tự).'),
    ('citizen_case_transfers', 'Đề nghị chuyển hồ sơ sang xã khác đang chờ xã nhận quyết định', NULL),
    ('start_citizen_case_transfer', 'Bắt đầu chuyển hồ sơ sang cơ quan khác theo đề nghị của công dân', NULL),
    ('decide_citizen_case_transfer', 'Xã nhận chấp thuận hoặc từ chối hồ sơ chuyển đến', NULL),
    ('scan_citizen_deadlines', 'Quét hồ sơ sắp đến hạn, tạo nhắc việc cho xã', 'Trả số nhắc việc mới tạo.'),
    ('update_citizen_delivery', 'Cập nhật giao nhận kết quả hồ sơ', 'p_status: ready, in_transit, delivered, failed.'),
    ('publish_citizen_result_channel', 'Công bố phương thức nhận kết quả của một thủ tục tại xã',
     'p_method: online, counter, postal; p_approval_reference: căn cứ phê duyệt; p_valid_until: hạn hiệu lực.'),
    ('citizen_privacy_requests', 'Yêu cầu của công dân về dữ liệu cá nhân (chỉ lãnh đạo xã)', NULL),
    ('review_citizen_privacy_request', 'Xử lý yêu cầu về dữ liệu cá nhân (chỉ lãnh đạo xã)', 'p_state: reviewing, resolved, declined.'),
    ('citizen_retention_reviews', 'Dữ liệu đến hạn rà soát lưu trữ (chỉ lãnh đạo xã)', NULL),
    ('decide_citizen_retention', 'Quyết định lưu trữ dữ liệu đến hạn (chỉ lãnh đạo xã)', 'p_state: restricted, archived, keep.'),
    ('scan_citizen_retention', 'Quét dữ liệu đến hạn rà soát lưu trữ (chỉ lãnh đạo xã)', 'Chỉ tạo mục chờ xem xét, không tự xóa dữ liệu.'),
    ('citizen_sync_queue', 'Thông tin công dân tự khai chờ xem xét đồng bộ (chỉ lãnh đạo xã)', NULL),
    ('decide_citizen_sync', 'Ghi quyết định xem xét đồng bộ (chỉ lãnh đạo xã)', 'p_decision: reviewed, rejected. Không tự cập nhật hồ sơ gốc.'),
    ('citizen_friction_summary', 'Tổng hợp điểm vướng của công dân theo bước (chỉ lãnh đạo xã)', 'Không có danh tính; nhóm dưới 5 lượt bị ẩn.'),
    ('citizen_unanswered_summary', 'Chủ đề công dân hỏi mà trợ lý chưa trả lời được (chỉ lãnh đạo xã)', 'Không lưu văn bản gốc hay danh tính.'),
    ('publish_procedure_version', 'Công bố phiên bản mới của một thủ tục (chỉ sys_admin)',
     'p_data: procedureId, title, summary, instructions, feeNote, slaDays, formRevision, documents, sourceUrl (trang HTTPS gov.vn, chinhphu.vn, vbpl.vn), sourceTitle, sourceReference, issuingAuthority, scopeNote, effectiveFrom, changeNote, confirmed: true. Các bản nháp chịu ảnh hưởng được thông báo.'),
    ('dispatch_citizen_reminders', 'Gửi nhắc việc đến hạn vào hộp thông báo của công dân (chỉ sys_admin)', 'Chỉ trong ứng dụng, không SMS hay email.'),

    -- ===== Hàm: kho giấy tờ, tự điền biểu mẫu của công dân (27-citizen-api-vault.sql) =====
    ('citizen_vault', 'Kho giấy tờ của công dân', 'Các giấy tờ kèm mọi phiên bản, và 100 lần chia sẻ gần nhất vào hồ sơ.'),
    ('citizen_vault_add', 'Thêm giấy tờ hoặc phiên bản mới vào kho',
     'p_document_id rỗng thì tạo giấy tờ mới (cần p_title, p_category). Tệp đã được Kênh người dân lưu vào kho đối tượng; hàm chỉ ghi siêu dữ liệu. Tối đa 100 giấy tờ, mỗi giấy tờ 100 phiên bản.'),
    ('citizen_vault_update', 'Sửa tên, loại hoặc lưu trữ một giấy tờ trong kho', 'Tham số để NULL là giữ nguyên.'),
    ('citizen_vault_version_update', 'Đặt hoặc bỏ ngày hết hạn của một phiên bản giấy tờ', NULL),
    ('citizen_vault_file', 'Thông tin để tải tệp một phiên bản giấy tờ',
     'Từ chối khi giấy tờ đang bị hạn chế theo quyết định lưu trữ; ghi nhật ký sử dụng dữ liệu cá nhân.'),
    ('citizen_vault_source', 'Kiểm tra giấy tờ trong kho trước khi dùng cho hồ sơ',
     'Cần quyền tái sử dụng (vault_case_reuse) còn hiệu lực, giấy tờ chưa lưu trữ, chưa hết hạn, không bị hạn chế.'),
    ('citizen_vault_attach', 'Gắn bản sao giấy tờ trong kho vào hồ sơ đang soạn hoặc đang bổ sung',
     'Kiểm tra lại quyền tái sử dụng, hạn dùng, loại giấy tờ của thủ tục trong cùng giao dịch; ghi lần chia sẻ và nhật ký sử dụng dữ liệu.'),
    ('citizen_autofill_sources', 'Dữ liệu của chính công dân để đề xuất tự điền biểu mẫu',
     'Hồ sơ cá nhân, thông tin tự khai và thông tin đã xác minh; ghi nhật ký sử dụng dữ liệu cá nhân.'),
    ('citizen_self_facts_update', 'Lưu ngày sinh, số định danh công dân tự khai', 'Dữ liệu tự khai, chưa xác minh qua cơ quan định danh.'),

    -- ===== Hàm: trang chi tiết hồ sơ của công dân (28-citizen-api-case.sql) =====
    ('citizen_case_facts', 'Trạng thái và 6 sự kiện gần nhất của hồ sơ cho trợ lý hồ sơ', 'Ghi nhật ký sử dụng dữ liệu cá nhân.'),
    ('citizen_case_insight_facts', 'Dữ kiện để gợi ý bước tiếp và cảnh báo hồ sơ', 'Thống kê thời gian xử lý (citizen_forecast_days), thông tin công dân xác nhận từ giấy tờ; ghi nhật ký sử dụng dữ liệu.'),
    ('citizen_case_roadmap', 'Sự kiện, công đoạn, phiên bản thủ tục, mục bổ sung còn mở của hồ sơ', NULL),
    ('citizen_case_stages', 'Công đoạn xử lý do cán bộ cập nhật', 'Tối đa 200 công đoạn gần nhất, xếp theo thời gian.'),
    ('citizen_case_deadline', 'Hạn giải quyết và cảnh báo gần / quá hạn', 'Tạo thông báo một lần cho mỗi mức cảnh báo; kèm lý do do cán bộ nhập nếu có.'),
    ('citizen_supplement_items', 'Các mục bổ sung của lần yêu cầu gần nhất', NULL),
    ('citizen_supplement_answer', 'Trả lời một mục bổ sung', 'p_response: giải trình (2–1000 ký tự) hoặc p_document_id: giấy tờ đã tải lên đúng loại yêu cầu.'),
    ('citizen_complete_supplement', 'Gửi bổ sung hồ sơ', 'Mọi mục yêu cầu phải được đáp ứng (giấy tờ tải sau thời điểm yêu cầu, đúng loại); hồ sơ chuyển về đang xử lý.'),
    ('citizen_case_delivery', 'Phương thức nhận kết quả được công bố và lựa chọn hiện tại', NULL),
    ('citizen_case_delivery_select', 'Chọn phương thức nhận kết quả', 'p_method: online, counter, postal (bưu chính cần địa chỉ, số điện thoại). Không đổi được sau khi cơ quan xác nhận.'),
    ('citizen_case_handoffs', 'Các mã chuyển hồ sơ tại quầy gần nhất', NULL),
    ('citizen_case_handoff_create', 'Tạo mã chuyển hồ sơ tại quầy cho bản nháp', 'p_code_hash: SHA-256 của mã do Kênh người dân sinh; mã có hạn 15 phút, tối đa 5 mã mỗi giờ, mã cũ chưa dùng bị thu hồi.'),
    ('citizen_case_handoff_revoke', 'Thu hồi mã chuyển hồ sơ chưa dùng', NULL),
    ('citizen_my_case_requests', 'Đề nghị công dân đã gửi cho một hồ sơ', NULL),
    ('citizen_case_request_create', 'Gửi đề nghị xem xét hạn, điều chỉnh, rút hoặc chuyển cơ quan', 'p_kind: deadline_review, amendment, withdrawal, transfer (cần p_destination_tenant_id có tuyến được phê duyệt). Tối đa 8 đề nghị mỗi 24 giờ.'),
    ('citizen_case_routing', 'Cơ quan tiếp nhận, tuyến chuyển tiếp được công bố và gợi ý theo địa phương khai báo', NULL),
    ('citizen_stage_reviews', 'Đánh giá từng giai đoạn của hồ sơ', NULL),
    ('citizen_stage_review_create', 'Đánh giá một giai đoạn hồ sơ đã trải qua', 'p_stage: guidance, reception, supplement, result; p_rating 1–5. Mỗi giai đoạn đánh giá một lần.'),
    ('citizen_draft_preflight', 'Dữ kiện kiểm tra bản nháp trước khi nộp', 'Thủ tục còn công bố, xã tiếp nhận còn hợp lệ, người kê khai / đại diện, giấy tờ bắt buộc còn thiếu. Không phải kết luận pháp lý.'),
    ('citizen_case_observation_save', 'Lưu thông tin công dân xác nhận đọc từ giấy tờ để rà soát mâu thuẫn', NULL),
    ('citizen_packet_sources', 'Dữ liệu để xem trước bộ hồ sơ của bản nháp', 'Từ chối khi bản nháp làm thay người khác; ghi nhật ký sử dụng dữ liệu cá nhân.'),
    ('citizen_procedure_change', 'Phiên bản thủ tục đã thay đổi so với lúc soạn bản nháp', 'changedSections: documents, fees, deadline, forms, conditions, description, source, scope.'),
    ('citizen_procedure_change_ack', 'Xác nhận đã rà soát phiên bản thủ tục mới cho bản nháp', 'p_current_version_id phải là phiên bản mới nhất.'),
    ('citizen_application_reapply_source', 'Thủ tục và biểu mẫu của hồ sơ đã kết thúc để tạo lại', 'Chỉ hồ sơ đã hoàn thành, bị từ chối hoặc đã rút, thủ tục còn công bố.'),
    ('citizen_application_reapply', 'Tạo bản nháp mới từ hồ sơ đã kết thúc', 'Dùng cùng quy tắc với citizen_application_create; giấy tờ không được sao chép.'),
    ('citizen_result_check', 'Kiểm tra hồ sơ đã hoàn thành trước khi cấp mã kiểm chứng kết quả', NULL),
    ('citizen_result_verification_issue', 'Cấp mã kiểm chứng kết quả', 'p_token_hash: SHA-256 của mã tra cứu; mã cũ bị thu hồi; hiệu lực 180 ngày.'),

    -- ===== Hàm: đại diện, gia đình, nhóm thủ tục của công dân (29-citizen-api-representation.sql) =====
    ('citizen_representations', 'Đăng ký đại diện nộp thay của công dân', NULL),
    ('citizen_representation_create', 'Đăng ký đại diện nộp thay cho người thân', 'p_relationship: parent, child, spouse, guardian, other; p_legal_basis: authorization, legal_representative. Chờ cán bộ xác minh minh chứng.'),
    ('citizen_representation_audit', 'Nhật ký sử dụng một quyền đại diện', NULL),
    ('citizen_representation_evidence', 'Khóa tệp minh chứng đại diện để Kênh người dân tải', NULL),
    ('citizen_representation_evidence_set', 'Gắn tệp minh chứng cho yêu cầu đại diện đang chờ xác minh', 'Trả khóa tệp cũ để xóa khỏi kho.'),
    ('citizen_representation_revoke', 'Thu hồi quyền đại diện của chính mình', NULL),
    ('citizen_family', 'Người thân có quyền đại diện đã xác minh và hồ sơ đã nộp thay', 'Chỉ hồ sơ do chính tài khoản nộp; không mở hồ sơ riêng của người thân.'),
    ('citizen_service_batches', 'Các nhóm thủ tục nộp cùng lúc của công dân', NULL),
    ('citizen_service_batch_create', 'Tạo nhóm 2–4 thủ tục chuẩn bị nộp cùng lúc', 'Chỉ là nhóm chuẩn bị, không tự nộp; dùng chung họ tên, số điện thoại khi công dân đồng ý.'),
    ('citizen_service_batch', 'Chi tiết một nhóm thủ tục và hồ sơ đã tạo cho từng thủ tục', NULL),

    -- ===== Hàm: lịch hẹn một cửa, tư vấn của công dân (30-citizen-api-appointment.sql) =====
    ('citizen_counter_slots', 'Khung giờ một cửa do cán bộ công bố, còn chỗ', 'Trong 31 ngày tới, bắt đầu sau ít nhất 1 giờ; p_procedure_id lọc theo thủ tục.'),
    ('citizen_counter_bookings', 'Lượt công dân đã đặt tại bộ phận một cửa', NULL),
    ('citizen_counter_book', 'Đặt một lượt tại bộ phận một cửa', 'Số thứ tự cấp nguyên tử trong lõi; chỉ khung giờ còn chỗ.'),
    ('citizen_counter_booking_cancel', 'Hủy lượt đã đặt', NULL),
    ('citizen_consultations', 'Lịch tư vấn của công dân', NULL),
    ('citizen_consultation_slots', 'Khung giờ tư vấn do cán bộ công bố, còn chỗ', 'p_category lọc theo lĩnh vực.'),
    ('citizen_consultation_create', 'Đặt lịch tư vấn', 'p_channel: phone, online; thời gian từ 1 giờ đến 31 ngày tới; tối đa 3 lịch chưa kết thúc. Lịch chờ cán bộ xác nhận.'),
    ('citizen_consultation_cancel', 'Hủy lịch tư vấn', NULL),

    -- ===== Hàm: hỗ trợ, góp ý, trò chuyện của công dân (31-citizen-api-support.sql) =====
    ('citizen_tickets', 'Yêu cầu hỗ trợ của công dân', 'Lọc p_status, tìm p_q theo tiêu đề hoặc mã YC-…; 10 yêu cầu mỗi trang.'),
    ('citizen_ticket', 'Chi tiết một yêu cầu hỗ trợ kèm lịch sử trao đổi', NULL),
    ('citizen_ticket_create', 'Gửi yêu cầu hỗ trợ', 'p_category: huong-dan, loi-ky-thuat, gop-y, phan-anh, khac; có thể gắn với một hồ sơ của mình. Tối đa 20 yêu cầu mỗi 24 giờ.'),
    ('citizen_ticket_reply', 'Công dân trả lời trong yêu cầu hỗ trợ', 'Tối đa 40 lần mỗi 24 giờ.'),
    ('citizen_feedback', 'Góp ý công dân đã gửi', NULL),
    ('citizen_feedback_create', 'Gửi góp ý', 'Lưu góp ý và mở yêu cầu hỗ trợ để cán bộ trả lời.'),
    ('citizen_support_messages', 'Tin nhắn hỗ trợ theo hồ sơ', NULL),
    ('citizen_support_message_create', 'Gửi tin nhắn hỗ trợ, có thể gắn với một hồ sơ', NULL),
    ('citizen_chat_conversations', 'Danh sách cuộc trò chuyện với trợ lý', '20 cuộc mỗi trang.'),
    ('citizen_chat_conversation', 'Một cuộc trò chuyện với trợ lý', '60 tin nhắn mỗi trang; p_before: mã tin nhắn để tải trang cũ hơn.'),
    ('citizen_chat_conversation_delete', 'Xóa một cuộc trò chuyện', NULL),
    ('citizen_chat_conversation_check', 'Kiểm tra cuộc trò chuyện thuộc tài khoản', NULL),
    ('citizen_chat_save', 'Lưu câu hỏi và câu trả lời đã kiểm tra nguồn của trợ lý', 'Một giao dịch; không đưa vào kho tri thức. Câu không trả lời được chỉ ghi nhóm chủ đề để thống kê.'),
    ('citizen_enabled_procedures', 'Mã các thủ tục xã của công dân đang mở', 'Trợ lý chỉ trả lời trong phạm vi này.'),

    -- ===== Hàm: cá nhân hóa của công dân (32-citizen-api-personal.sql) =====
    ('citizen_consents', 'Mục đích xử lý dữ liệu, quyết định đồng ý hiện tại và lịch sử', NULL),
    ('citizen_consent_decide', 'Đồng ý hoặc rút đồng ý cho một mục đích xử lý dữ liệu', 'Chỉ mục đích có căn cứ pháp lý là sự đồng ý; ghi nhật ký sử dụng dữ liệu.'),
    ('citizen_data_access', 'Nhật ký sử dụng dữ liệu cá nhân', '200 sự kiện gần nhất; kiểm tra toàn bộ chuỗi mã băm.'),
    ('citizen_retention', 'Chính sách lưu trữ, dữ liệu đến hạn rà soát, đề nghị về dữ liệu đã gửi', NULL),
    ('citizen_privacy_request_create', 'Gửi đề nghị về dữ liệu cá nhân', 'p_request_type: access, correct, restrict, erase, retention_review. Lãnh đạo xã xử lý.'),
    ('citizen_sync', 'Địa phương nhận và yêu cầu đồng bộ thông tin tự khai đã gửi', NULL),
    ('citizen_sync_create', 'Yêu cầu chuyển thông tin tự khai sang địa phương khác', 'p_categories: display_name, phone, address. Lãnh đạo xã nhận xem xét, không tự ghi đè.'),
    ('citizen_sync_cancel', 'Hủy yêu cầu đồng bộ còn chờ', NULL),
    ('citizen_preferences', 'Tùy chọn cá nhân hóa', NULL),
    ('citizen_preferences_save', 'Lưu tùy chọn cá nhân hóa', 'Địa phương phải có trong danh mục, lĩnh vực quan tâm phải có thủ tục công bố; đổi địa phương thì mất nhãn đã xác minh.'),
    ('citizen_preferences_delete', 'Xóa tùy chọn cá nhân hóa', NULL),
    ('citizen_journeys', 'Lộ trình sự kiện cuộc sống công dân đã lưu', NULL),
    ('citizen_journey_create', 'Lưu lộ trình chuẩn bị theo sự kiện cuộc sống', '1–6 thủ tục xã đang mở; không tạo hay nộp hồ sơ.'),
    ('citizen_journey', 'Chi tiết lộ trình kèm từng bước và giấy tờ', NULL),
    ('citizen_journey_status', 'Đổi trạng thái lộ trình', 'active, completed, archived.'),
    ('citizen_journey_item_update', 'Cập nhật một bước của lộ trình', 'p_link = true thì gắn (hoặc bỏ) hồ sơ đúng thủ tục của chính mình.'),
    ('citizen_life_suggestion_sources', 'Lộ trình đã lưu và danh mục thủ tục để gợi ý theo tình huống', 'Chỉ dựa trên tình huống công dân tự nhập.'),
    ('citizen_reminders', 'Cài đặt nhắc việc, công việc tự đặt, hạn hồ sơ, lượt hẹn sắp tới', NULL),
    ('citizen_reminder_create', 'Thêm công việc cần nhắc', NULL),
    ('citizen_reminder_complete', 'Đánh dấu công việc đã xong hoặc chưa xong', NULL),
    ('citizen_reminder_settings_save', 'Bật / tắt nhắc việc trong ứng dụng', 'p_days_before: 0–14.'),
    ('citizen_transactions', 'Sổ giao dịch hành chính: hồ sơ và sự kiện', 'Lọc p_status, tìm p_q; ghi nhật ký sử dụng dữ liệu.'),
    ('citizen_workspace', 'Không gian quản lý hành chính cá nhân', 'Hồ sơ, lộ trình, kho giấy tờ, thông báo chưa đọc, công việc, lượt hẹn; ghi nhật ký sử dụng dữ liệu.'),
    ('citizen_draft_cursor', 'Bước đang soạn của bản nháp', NULL),
    ('citizen_draft_cursor_save', 'Lưu bước đang soạn của bản nháp', 'p_step: 1–3.'),
    ('citizen_friction_signal', 'Ghi tín hiệu khó khăn ẩn danh', 'Chỉ mã loại khó khăn và bước; không lưu nội dung, danh tính, địa chỉ IP.'),

    -- ===== Hàm: công khai và gợi ý cho Kênh người dân (33-citizen-api-public.sql) =====
    ('public_knowledge', 'Kho tri thức của trợ lý: thủ tục đã công bố kèm giấy tờ, câu hỏi thường gặp', 'Khách gọi qua /public/rpc/public_knowledge.'),
    ('public_knowledge_search', 'Tìm kiếm toàn văn trên chỉ mục tri thức thủ tục đã công bố', 'p_query: biểu thức to_tsquery đã chuẩn hóa; p_procedure_id ưu tiên một thủ tục. Tối đa 42 đoạn.'),
    ('public_knowledge_status', 'Tình trạng chỉ mục tri thức của trợ lý', NULL),
    ('public_provenance', 'Nguồn văn bản phiên bản mới nhất của các thủ tục được trích dẫn', 'Tối đa 20 thủ tục.'),
    ('public_procedure_versions', 'Các phiên bản và nguồn văn bản của một thủ tục đã công bố', NULL),
    ('public_procedure_guide_source', 'Nguồn văn bản để hướng dẫn biểu mẫu của một thủ tục', NULL),
    ('public_procedure_channels', 'Kênh thực hiện của một thủ tục', 'Gọi bằng token công dân thì cho biết xã của công dân có mở trực tuyến, có khung giờ tại quầy; khách chỉ thấy thông tin chung.'),
    ('public_guidance_rules', 'Thủ tục và quy tắc gợi ý đã biên soạn', 'Không đoán điều kiện pháp lý.'),
    ('public_recommendation_catalog', 'Danh mục thủ tục kèm thông tin dùng để gợi ý', NULL),
    ('public_journey_catalog', 'Danh mục thủ tục cho lộ trình sự kiện cuộc sống', 'Gọi bằng token công dân thì chỉ thủ tục xã của công dân đang mở.'),
    ('public_localities', 'Danh sách địa phương', 'Có p_procedure_id thì kèm xã nào đang mở thủ tục.'),
    ('public_counter_session', 'Phiên chuẩn bị tại quầy theo mã băm', 'Mã chỉ để tham khảo thủ tục, không chứng minh danh tính.'),
    ('public_counter_session_start', 'Mở phiên chuẩn bị tại quầy (không đăng nhập)', 'p_code_hash: SHA-256 của mã ngẫu nhiên; hạn 15 phút.'),
    ('public_counter_session_end', 'Kết thúc phiên chuẩn bị tại quầy', NULL),
    ('public_result_verification', 'Tra cứu mã kiểm chứng kết quả', 'p_token_hash: SHA-256 của mã in trên giấy kết quả.'),
    ('citizen_recommendation_context', 'Tùy chọn và lịch sử nộp hồ sơ để sắp xếp thủ tục gợi ý', 'Lịch sử chỉ dùng khi công dân bật cá nhân hóa.'),
    ('citizen_receivers', 'Xã nhận được hồ sơ từ xã của công dân cho một thủ tục', 'Theo tuyến tiếp nhận được phê duyệt, còn hiệu lực.'),
    ('citizen_locality_route', 'Kiểm tra địa phương gợi ý có tuyến tiếp nhận được phê duyệt không', NULL),

    -- ===== Hàm: dịch vụ và việc định kỳ cho Kênh người dân (34-citizen-direct-access.sql) =====
    ('citizen_service_oidc_link', 'Liên kết đăng nhập OIDC bên ngoài với tài khoản công dân (chỉ tài khoản dịch vụ của Kênh người dân)', 'Ghi địa phương cư trú và thông tin đã xác minh khi công dân đồng ý lúc đăng nhập; không lưu ID token.'),
    ('public_registration_tenants', 'Các xã đang hoạt động để người dân chọn khi đăng ký', 'Gọi công khai qua /public/rpc/public_registration_tenants.'),
    ('system_register_citizen', 'Tạo hồ sơ công dân khi người dân tự đăng ký (chỉ dịch vụ tài khoản của lõi gọi, cần X-Workflow-Token)',
     'Ghi thời điểm đồng ý xử lý dữ liệu cá nhân. Ứng dụng đăng ký qua POST /public/accounts/register.'),
    ('system_unregister_citizen', 'Hủy hồ sơ công dân vừa tạo khi tạo tài khoản lỗi (chỉ dịch vụ tài khoản của lõi gọi, cần X-Workflow-Token)', NULL),
    ('system_dispatch_citizen_reminders', 'Gửi nhắc việc đến hạn (chỉ dịch vụ điều phối của lõi gọi, cần X-Workflow-Token)', NULL),
    ('system_scan_citizen_retention', 'Quét dữ liệu đến hạn rà soát lưu trữ của mọi xã (chỉ dịch vụ điều phối của lõi gọi, cần X-Workflow-Token)', 'Chỉ tạo mục chờ lãnh đạo xã xem xét.'),

    -- ===== Hàm: trợ lý AI (chỉ dịch vụ ai-gateway gọi) =====
    ('knowledge_search', 'Tìm kiếm lai toàn văn và ngữ nghĩa trên tri thức thủ tục (chỉ ai-gateway gọi)',
     'Ứng dụng hỏi trợ lý qua POST /ai/ask hoặc /public/ai/ask.'),
    ('ai_pending_chunks', 'Đoạn tri thức chưa có vector (chỉ ai-gateway gọi, cần X-Workflow-Token)', NULL),
    ('ai_store_embeddings', 'Lưu vector cho đoạn tri thức (chỉ ai-gateway gọi, cần X-Workflow-Token)', NULL),
    ('ai_index_status', 'Tình trạng chỉ mục vector (chỉ ai-gateway gọi, cần X-Workflow-Token)', NULL)
  ) AS t(name, summary, detail)
  LOOP
    IF to_regclass('api.' || quote_ident(item.name)) IS NOT NULL THEN
      EXECUTE format('COMMENT ON %s api.%I IS %L',
        CASE (SELECT relkind FROM pg_class WHERE oid = to_regclass('api.' || quote_ident(item.name)))
          WHEN 'v' THEN 'VIEW' WHEN 'm' THEN 'MATERIALIZED VIEW' ELSE 'TABLE' END,
        item.name, concat_ws(E'\n\n', item.summary, item.detail));
    END IF;
    FOR fn IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'api' AND p.proname = item.name LOOP
      EXECUTE format('COMMENT ON FUNCTION %s IS %L', fn::regprocedure, concat_ws(E'\n\n', item.summary, item.detail));
    END LOOP;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
