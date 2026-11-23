-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
--
-- Mô tả tiếng Việt cho từng hàm, bảng ảo của schema api. PostgREST đưa các mô tả này vào tài liệu
-- OpenAPI tự sinh (GET /rest/), trang tài liệu API (/docs/ ở cổng APISIX) hiển thị lại.
-- Dòng đầu là tóm tắt, phần sau dòng trống là mô tả chi tiết.
-- Chạy cuối cùng trong db-setup (các tệp trước có thể tạo lại bảng ảo làm mất mô tả). Chạy lại nhiều lần được;
-- hàm, bảng ảo chưa có thì bỏ qua.

COMMENT ON SCHEMA api IS $$CommuneOS – API dữ liệu của lõi

API tự sinh bởi PostgREST trên schema `api` của PostgreSQL, gọi qua cổng APISIX tại `/rest/`.
Mọi lời gọi cần token Keycloak (`Authorization: Bearer <token>`); token của client `commune-app` dùng cho cán bộ,
lãnh đạo, quản trị hệ thống; token của client `citizen-app` dùng cho công dân. Row Level Security tự lọc theo xã
(và theo công dân), nên cùng một đường dẫn mỗi người thấy dữ liệu khác nhau.

Bảng ảo: `GET /rest/<tên>` với bộ lọc PostgREST, ví dụ `?status=eq.processing&order=submitted_at.desc&limit=20`.
Hàm: `POST /rest/rpc/<tên>` với thân JSON gồm các tham số.
Khách chưa đăng nhập chỉ gọi được `procedure_catalog`, `procedure_detail` qua `/public/rpc/`.

Trang này liệt kê mọi phương thức PostgREST hỗ trợ cho mỗi bảng ảo; quyền thật do vai trò trong token quyết định.
Bảng ảo chỉ cho đọc (GET); mọi thao tác ghi đi qua hàm `rpc/*`, nơi lõi kiểm tra xã, vai trò và dữ liệu.$$;

DO $$
DECLARE
  item record;
  fn oid;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    -- ===== Bảng ảo: cán bộ, lãnh đạo, quản trị =====
    ('tenants', 'Danh sách xã',
     'Quản trị hệ thống thấy mọi xã; cán bộ chỉ thấy xã mình. Cột status: active (đang hoạt động) hoặc locked (đã khóa).'),
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
    ('ledger', 'Sổ ghi nhận chống sửa',
     'Mỗi thao tác trên hồ sơ nối với thao tác trước bằng mã băm. Kiểm tra toàn chuỗi bằng rpc/verify_ledger.'),
    ('staff_profiles', 'Hồ sơ cán bộ của xã', 'Lãnh đạo xem toàn bộ cán bộ xã mình; cán bộ xem hồ sơ của chính mình qua my_profile.'),
    ('staff_tasks', 'Việc lãnh đạo giao cho cán bộ', 'Lãnh đạo thấy mọi việc của xã; tạo bằng rpc/create_staff_task.'),
    ('staff_requests', 'Đề nghị của cán bộ chờ lãnh đạo duyệt',
     'Sửa hồ sơ cá nhân, thêm/xóa giấy tờ, trình duyệt kết quả hồ sơ, đề nghị khác. Duyệt bằng rpc/decide_staff_request.'),
    ('staff_documents', 'Giấy tờ cá nhân của cán bộ', 'Tải nội dung bằng GET /files/staff-documents/{id}.'),
    ('staff_workload', 'Khối lượng việc của từng cán bộ', 'Số hồ sơ đang xử lý, việc được giao còn mở, quá hạn; dùng cho trang báo cáo của lãnh đạo.'),
    ('staff_notifications', 'Thông báo cho cán bộ đang đăng nhập', 'Đánh dấu đã đọc bằng rpc/read_staff_notification.'),
    ('staff_audit', 'Nhật ký quản lý tài khoản cán bộ', 'Tạo, khóa, mở, cấp lại mật khẩu, sửa, xóa; không chứa mật khẩu.'),
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
    ('log_staff_action', 'Ghi nhật ký quản lý tài khoản (chỉ dịch vụ tài khoản gọi)', 'Cần khóa nội bộ X-Workflow-Token.'),

    -- ===== Hàm: quản trị hệ thống =====
    ('add_tenant', 'Thêm xã mới', 'Chỉ sys_admin.'),
    ('set_tenant_status', 'Khóa hoặc mở một xã', 'status: active hoặc locked. Chỉ sys_admin.'),
    ('import_procedure', 'Nạp hoặc cập nhật một thủ tục từ gói thủ tục',
     'pack: nội dung pack.yaml đã đọc thành JSON. Thủ tục mới chưa bật cho xã nào. Chỉ sys_admin.'),
    ('set_tenant_procedure', 'Bật hoặc tắt một thủ tục cho một xã', 'Ví dụ {"tenant_code":"xa-b","procedure_id":"khai-sinh","enabled":false}. Chỉ sys_admin.'),
    ('set_tenant_procedures', 'Bật hoặc tắt nhiều thủ tục cho một xã', 'Ví dụ {"tenant_code":"xa-b","procedure_ids":["khai-sinh","ket-hon"],"enabled":true}. Chỉ sys_admin.'),
    ('set_procedure_tenants', 'Bật hoặc tắt một thủ tục cho nhiều xã', 'Ví dụ {"procedure_id":"khai-sinh","tenant_codes":["xa-a","xa-b"],"enabled":true}. Chỉ sys_admin.'),
    ('verify_ledger', 'Kiểm tra toàn vẹn sổ ghi nhận',
     'Tính lại từng mã băm và so với sổ. Thân {} kiểm tra mọi xã, hoặc {"only_tenant":"xa-a"}. broken_seq: vị trí đầu tiên bị sửa.'),

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
