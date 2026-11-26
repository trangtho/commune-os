-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
--
-- API của lõi cho cán bộ xã xử lý phần việc phát sinh từ Kênh người dân: yêu cầu hỗ trợ, mã chuyển
-- hồ sơ tại quầy, đề nghị điều chỉnh và chuyển cơ quan, giao nhận kết quả, yêu cầu về dữ liệu cá nhân,
-- rà soát lưu trữ, đồng bộ thông tin công dân tự khai, báo cáo tổng hợp, công bố phiên bản thủ tục.
--
-- Trước đây các chức năng này là /api/internal/* trong ứng dụng Kênh người dân, nhận xã và mã cán bộ
-- qua header kèm một khóa dùng chung. Nay gọi qua cổng APISIX: POST /rest/rpc/<tên hàm> bằng token
-- Keycloak của cán bộ; xã lấy từ claim tenant_id, mã cán bộ từ claim sub, vai trò từ realm_access.
--   - cán bộ xã (receptionist, officer, leader): hỗ trợ, chuyển hồ sơ tại quầy, đề nghị, giao nhận kết quả;
--   - lãnh đạo xã: dữ liệu cá nhân, lưu trữ, đồng bộ, báo cáo tổng hợp;
--   - quản trị hệ thống: công bố phiên bản thủ tục, gửi nhắc việc.
-- Mỗi hàm bọc một hàm public.citizen_staff_* đã có (kiểm tra nghiệp vụ nằm ở đó), chỉ thêm bước lấy danh tính
-- từ token và kiểm tra dữ liệu đầu vào như ứng dụng cũ đã làm. Lỗi nghiệp vụ dùng mã PTxyz (HTTP xyz).
-- Chạy lại nhiều lần được.

-- ===== 1. Danh tính cán bộ từ token =====
-- Mã (uuid) của xã người gọi; p_leader = true thì chỉ lãnh đạo xã.
CREATE OR REPLACE FUNCTION public.staff_tenant_id(p_leader boolean DEFAULT false) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text := CASE WHEN p_leader THEN public.require_leader() ELSE public.require_staff() END;
BEGIN
  RETURN (SELECT id FROM tenants WHERE code = v_code);
END $$;
REVOKE ALL ON FUNCTION public.staff_tenant_id(boolean) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.require_sys_admin() RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_sys_admin() OR public.current_staff_id() IS NULL THEN
    RAISE EXCEPTION 'Chỉ quản trị hệ thống được dùng chức năng này' USING ERRCODE = '42501';
  END IF;
  RETURN public.current_staff_id();
END $$;
REVOKE ALL ON FUNCTION public.require_sys_admin() FROM PUBLIC;

-- Kiểm tra độ dài một chuỗi đã cắt khoảng trắng; sai thì báo lỗi 400 với tên trường.
CREATE OR REPLACE FUNCTION public.check_text(p_value text, p_label text, p_min int, p_max int) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE v text := btrim(coalesce(p_value, ''));
BEGIN
  IF length(v) < p_min OR length(v) > p_max THEN
    RAISE EXCEPTION '% phải từ % đến % ký tự', p_label, p_min, p_max USING ERRCODE = 'PT400';
  END IF;
  RETURN v;
END $$;

-- ===== 2. Yêu cầu hỗ trợ của công dân =====
CREATE OR REPLACE FUNCTION api.citizen_support_tickets(p_limit integer DEFAULT 50) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN coalesce(public.citizen_staff_support_tickets(public.staff_tenant_id(), least(greatest(coalesce(p_limit, 50), 1), 200)), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION api.citizen_support_ticket(p_ticket_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb := public.citizen_staff_support_ticket_detail(p_ticket_id, public.staff_tenant_id());
BEGIN
  IF v IS NULL THEN
    RAISE EXCEPTION 'Không có yêu cầu trong địa phương được phân quyền' USING ERRCODE = 'PT404';
  END IF;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION api.update_citizen_support_ticket(p_ticket_id uuid, p_status text, p_message text DEFAULT '',
  p_resolution text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant uuid := public.staff_tenant_id();
BEGIN
  IF p_status NOT IN ('processing', 'waiting_citizen', 'answered', 'resolved', 'closed') THEN
    RAISE EXCEPTION 'Trạng thái không hợp lệ' USING ERRCODE = 'PT400';
  END IF;
  IF NOT coalesce(public.citizen_staff_update_support_ticket(p_ticket_id, v_tenant, public.current_staff_id(), p_status,
       public.check_text(p_message, 'Nội dung trả lời', 0, 3000), public.check_text(p_resolution, 'Kết quả xử lý', 0, 2000)), false) THEN
    RAISE EXCEPTION 'Không tìm thấy yêu cầu trong địa phương được phân quyền' USING ERRCODE = 'PT404';
  END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

-- ===== 3. Mã chuyển hồ sơ tại quầy =====
-- Công dân đưa mã 32 ký tự cho cán bộ một cửa; mã chỉ dùng một lần, có hạn, chỉ xã tiếp nhận đọc được.
CREATE OR REPLACE FUNCTION api.redeem_citizen_handoff(p_code text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  IF coalesce(p_code, '') !~ '^[A-Z0-9_-]{32}$' THEN
    RAISE EXCEPTION 'Mã không hợp lệ' USING ERRCODE = 'PT400';
  END IF;
  v := public.citizen_staff_redeem_handoff(encode(sha256(convert_to(p_code, 'UTF8')), 'hex'),
         public.staff_tenant_id(), public.current_staff_id());
  IF v IS NULL THEN
    RAISE EXCEPTION 'Mã không hợp lệ, đã hết hạn hoặc đã được sử dụng' USING ERRCODE = 'PT404';
  END IF;
  RETURN v || jsonb_build_object('notice',
    'Dữ liệu chuẩn bị tại quầy; cán bộ phải đối chiếu danh tính và hoàn tất bước tiếp nhận chính thức theo nghiệp vụ.');
END $$;

-- Khóa tệp của một giấy tờ trong mã chuyển đã dùng (dịch vụ tệp gọi: GET /files/handoffs/{id}/documents/{id}).
CREATE OR REPLACE FUNCTION api.citizen_handoff_document(p_handoff_id uuid, p_document_id uuid)
RETURNS TABLE(storage_key text, original_name text, mime_type text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.citizen_staff_handoff_document(p_handoff_id, p_document_id, public.staff_tenant_id(), public.current_staff_id())
$$;

-- ===== 4. Đề nghị điều chỉnh hồ sơ và chuyển cơ quan =====
CREATE OR REPLACE FUNCTION api.citizen_case_requests() RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(json_agg(r ORDER BY r.created_at DESC), '[]'::json)
  FROM public.citizen_staff_list_case_requests(public.staff_tenant_id()) r
$$;

CREATE OR REPLACE FUNCTION api.decide_citizen_case_request(p_request_id uuid, p_approved boolean, p_response text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_approved IS NULL THEN RAISE EXCEPTION 'Thiếu quyết định' USING ERRCODE = 'PT400'; END IF;
  IF NOT coalesce(public.citizen_staff_decide_case_request(p_request_id, public.staff_tenant_id(), public.current_staff_id(),
       p_approved, public.check_text(p_response, 'Phản hồi', 5, 1000)), false) THEN
    RAISE EXCEPTION 'Yêu cầu không tồn tại, không thuộc địa phương hoặc cần quy trình chuyển cơ quan riêng' USING ERRCODE = 'PT404';
  END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION api.citizen_case_transfers() RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(json_agg(t ORDER BY t.created_at DESC), '[]'::json)
  FROM public.citizen_staff_list_transfers(public.staff_tenant_id()) t
$$;

CREATE OR REPLACE FUNCTION api.start_citizen_case_transfer(p_request_id uuid, p_response text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v uuid;
BEGIN
  v := public.citizen_staff_start_case_transfer(p_request_id, public.staff_tenant_id(), public.current_staff_id(),
         public.check_text(p_response, 'Phản hồi', 5, 1000));
  IF v IS NULL THEN
    RAISE EXCEPTION 'Yêu cầu chuyển không hợp lệ hoặc không thuộc quyền xử lý' USING ERRCODE = 'PT404';
  END IF;
  RETURN jsonb_build_object('id', v, 'status', 'pending');
END $$;

CREATE OR REPLACE FUNCTION api.decide_citizen_case_transfer(p_transfer_id uuid, p_accepted boolean, p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_accepted IS NULL THEN RAISE EXCEPTION 'Thiếu quyết định' USING ERRCODE = 'PT400'; END IF;
  IF NOT coalesce(public.citizen_staff_accept_case_transfer(p_transfer_id, public.staff_tenant_id(), public.current_staff_id(),
       p_accepted, public.check_text(p_reason, 'Lý do', 5, 1000)), false) THEN
    RAISE EXCEPTION 'Chỉ đơn vị nhận được phép quyết định đề nghị đang chờ' USING ERRCODE = 'PT404';
  END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION api.scan_citizen_deadlines() RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('created', public.citizen_staff_scan_deadlines(public.staff_tenant_id()))
$$;

-- ===== 5. Giao nhận kết quả =====
CREATE OR REPLACE FUNCTION api.update_citizen_delivery(p_application_id text, p_status text, p_shipment_reference text DEFAULT '',
  p_note text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_status NOT IN ('ready', 'in_transit', 'delivered', 'failed') THEN
    RAISE EXCEPTION 'Trạng thái không hợp lệ' USING ERRCODE = 'PT400';
  END IF;
  IF NOT coalesce(public.citizen_staff_update_delivery(public.check_text(p_application_id, 'Mã hồ sơ', 5, 50), public.staff_tenant_id(),
       public.current_staff_id(), p_status, public.check_text(p_shipment_reference, 'Mã vận đơn', 0, 120),
       public.check_text(p_note, 'Ghi chú', 0, 1000)), false) THEN
    RAISE EXCEPTION 'Không tìm thấy hồ sơ hoặc phương thức nhận kết quả chưa đăng ký' USING ERRCODE = 'PT404';
  END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION api.publish_citizen_result_channel(p_procedure_id text, p_method text, p_approval_reference text,
  p_valid_until timestamptz, p_instructions text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(p_procedure_id, '') !~ '^[a-z0-9-]{2,80}$' THEN RAISE EXCEPTION 'Mã thủ tục không hợp lệ' USING ERRCODE = 'PT400'; END IF;
  IF p_method NOT IN ('online', 'counter', 'postal') THEN RAISE EXCEPTION 'Phương thức không hợp lệ' USING ERRCODE = 'PT400'; END IF;
  IF p_valid_until IS NULL THEN RAISE EXCEPTION 'Thiếu thời hạn hiệu lực' USING ERRCODE = 'PT400'; END IF;
  RETURN jsonb_build_object('ok', coalesce(public.citizen_staff_publish_result_channel(p_procedure_id, public.staff_tenant_id(),
    p_method, public.check_text(p_approval_reference, 'Căn cứ phê duyệt', 5, 200), p_valid_until,
    public.check_text(p_instructions, 'Hướng dẫn', 0, 1000)), false));
END $$;

-- ===== 6. Dữ liệu cá nhân và lưu trữ (lãnh đạo xã) =====
CREATE OR REPLACE FUNCTION api.citizen_privacy_requests() RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(json_agg(r ORDER BY r.created_at DESC), '[]'::json)
  FROM public.citizen_staff_privacy_queue(public.staff_tenant_id(true)) r
$$;

CREATE OR REPLACE FUNCTION api.review_citizen_privacy_request(p_request_id uuid, p_state text, p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant uuid := public.staff_tenant_id(true);
BEGIN
  IF p_state NOT IN ('reviewing', 'resolved', 'declined') THEN RAISE EXCEPTION 'Trạng thái không hợp lệ' USING ERRCODE = 'PT400'; END IF;
  IF NOT coalesce(public.citizen_staff_review_privacy_request(p_request_id, v_tenant, public.current_staff_id(), p_state,
       public.check_text(p_note, 'Ghi chú', 5, 1200)), false) THEN
    RAISE EXCEPTION 'Không có yêu cầu cần xử lý trong đơn vị' USING ERRCODE = 'PT404';
  END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION api.citizen_retention_reviews() RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(json_agg(r ORDER BY r.found_at DESC), '[]'::json)
  FROM public.citizen_staff_retention_queue(public.staff_tenant_id(true)) r
$$;

CREATE OR REPLACE FUNCTION api.decide_citizen_retention(p_review_id uuid, p_state text, p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant uuid := public.staff_tenant_id(true);
BEGIN
  IF p_state NOT IN ('restricted', 'archived', 'keep') THEN RAISE EXCEPTION 'Trạng thái không hợp lệ' USING ERRCODE = 'PT400'; END IF;
  IF NOT coalesce(public.citizen_staff_review_retention(p_review_id, v_tenant, public.current_staff_id(), p_state,
       public.check_text(p_note, 'Ghi chú', 5, 1200)), false) THEN
    RAISE EXCEPTION 'Không có dữ liệu cần xem xét trong đơn vị' USING ERRCODE = 'PT404';
  END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION api.scan_citizen_retention() RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('created', public.citizen_staff_scan_retention(public.staff_tenant_id(true)))
$$;

CREATE OR REPLACE FUNCTION api.citizen_sync_queue() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'items', coalesce((SELECT jsonb_agg(to_jsonb(q) ORDER BY q.created_at DESC)
                       FROM public.citizen_staff_sync_queue(public.staff_tenant_id(true)) q), '[]'::jsonb),
    'notice', 'Dữ liệu do công dân tự khai và cho phép chuyển. Cần kiểm tra nguồn và giải quyết xung đột ngoài hệ thống trước khi cập nhật.')
$$;

CREATE OR REPLACE FUNCTION api.decide_citizen_sync(p_request_id uuid, p_decision text, p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant uuid := public.staff_tenant_id(true);
BEGIN
  IF p_decision NOT IN ('reviewed', 'rejected') THEN RAISE EXCEPTION 'Quyết định không hợp lệ' USING ERRCODE = 'PT400'; END IF;
  IF NOT coalesce(public.citizen_staff_sync_decide(v_tenant, p_request_id, p_decision, public.check_text(p_note, 'Ghi chú', 8, 500)), false) THEN
    RAISE EXCEPTION 'Yêu cầu không thuộc địa phương hoặc đã được xử lý' USING ERRCODE = 'PT404';
  END IF;
  RETURN jsonb_build_object('ok', true, 'notice', 'Đã ghi nhận quyết định xem xét; không tự cập nhật hồ sơ gốc.');
END $$;

-- ===== 7. Báo cáo tổng hợp (lãnh đạo xã, không có danh tính, nhóm nhỏ bị ẩn) =====
CREATE OR REPLACE FUNCTION api.citizen_friction_summary() RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(json_agg(f ORDER BY f.events DESC), '[]'::json)
  FROM public.citizen_staff_friction_summary(public.staff_tenant_id(true)) f
$$;

CREATE OR REPLACE FUNCTION api.citizen_unanswered_summary() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'items', coalesce((SELECT jsonb_agg(to_jsonb(u) ORDER BY u.question_count DESC)
                       FROM public.citizen_staff_unanswered_summary(public.staff_tenant_id(true)) u), '[]'::jsonb),
    'notice', 'Chỉ nhóm chủ đề có ít nhất 5 lượt hỏi chưa trả lời trong 90 ngày. Không lưu văn bản gốc hoặc danh tính công dân trong báo cáo.')
$$;

-- ===== 8. Quản trị hệ thống =====
-- Công bố phiên bản mới của một thủ tục; các bản nháp chịu ảnh hưởng được thông báo (citizen_publish_procedure_version).
-- p_data: { procedureId, title, summary, instructions, feeNote, slaDays, formRevision, documents[{documentCode,
-- documentName, isRequired}], sourceUrl, sourceTitle, sourceReference, issuingAuthority, scopeNote, effectiveFrom,
-- changeNote, confirmed: true }. Nguồn phải là trang HTTPS của cơ quan nhà nước (gov.vn, chinhphu.vn, vbpl.vn).
CREATE OR REPLACE FUNCTION api.publish_procedure_version(p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_admin text := public.require_sys_admin();
  v_host text;
  v_docs jsonb;
  v_effective date;
  v_id uuid;
  k text;
BEGIN
  IF jsonb_typeof(p_data) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Dữ liệu phải là đối tượng JSON' USING ERRCODE = 'PT400'; END IF;
  FOR k IN SELECT jsonb_object_keys(p_data) LOOP
    IF k <> ALL (ARRAY['procedureId','title','summary','instructions','feeNote','slaDays','formRevision','documents','sourceUrl',
      'sourceTitle','sourceReference','issuingAuthority','scopeNote','effectiveFrom','changeNote','confirmed']) THEN
      RAISE EXCEPTION 'Trường không được hỗ trợ: %', k USING ERRCODE = 'PT400';
    END IF;
  END LOOP;
  IF p_data -> 'confirmed' IS DISTINCT FROM 'true'::jsonb THEN
    RAISE EXCEPTION 'Cần xác nhận đã đối chiếu văn bản gốc (confirmed: true)' USING ERRCODE = 'PT400';
  END IF;
  IF coalesce(p_data ->> 'procedureId', '') !~ '^[a-z0-9-]{2,80}$' THEN RAISE EXCEPTION 'Mã thủ tục không hợp lệ' USING ERRCODE = 'PT400'; END IF;
  PERFORM public.check_text(p_data ->> 'title', 'Tên thủ tục', 3, 200), public.check_text(p_data ->> 'summary', 'Tóm tắt', 5, 2000),
    public.check_text(p_data ->> 'instructions', 'Hướng dẫn', 5, 10000), public.check_text(p_data ->> 'feeNote', 'Lệ phí', 1, 500),
    public.check_text(p_data ->> 'formRevision', 'Phiên bản biểu mẫu', 1, 120), public.check_text(p_data ->> 'sourceTitle', 'Tên văn bản nguồn', 3, 250),
    public.check_text(p_data ->> 'sourceReference', 'Số hiệu văn bản', 3, 250), public.check_text(p_data ->> 'issuingAuthority', 'Cơ quan ban hành', 3, 250),
    public.check_text(p_data ->> 'scopeNote', 'Phạm vi áp dụng', 5, 500), public.check_text(p_data ->> 'changeNote', 'Ghi chú thay đổi', 0, 1500);
  IF jsonb_typeof(p_data -> 'slaDays') IS DISTINCT FROM 'number' OR (p_data ->> 'slaDays') !~ '^[0-9]+$'
     OR (p_data ->> 'slaDays')::int > 3650 THEN
    RAISE EXCEPTION 'Thời hạn giải quyết phải là số ngày từ 0 đến 3650' USING ERRCODE = 'PT400';
  END IF;
  v_host := lower(substring(coalesce(p_data ->> 'sourceUrl', '') FROM '^https://([A-Za-z0-9.-]+)(?::[0-9]+)?(?:[/?#]|$)'));
  IF v_host IS NULL OR length(p_data ->> 'sourceUrl') > 2000
     OR NOT (v_host IN ('gov.vn', 'chinhphu.vn', 'vbpl.vn') OR v_host LIKE '%.gov.vn' OR v_host LIKE '%.chinhphu.vn' OR v_host LIKE '%.vbpl.vn') THEN
    RAISE EXCEPTION 'Liên kết nguồn phải thuộc cổng chính thức của cơ quan nhà nước (HTTPS)' USING ERRCODE = 'PT422';
  END IF;
  BEGIN
    v_effective := (p_data ->> 'effectiveFrom')::date;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Ngày hiệu lực không hợp lệ (YYYY-MM-DD)' USING ERRCODE = 'PT400';
  END;
  IF (p_data ->> 'effectiveFrom') !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'Ngày hiệu lực không hợp lệ (YYYY-MM-DD)' USING ERRCODE = 'PT400'; END IF;
  IF v_effective > CURRENT_DATE THEN RAISE EXCEPTION 'Chưa hỗ trợ công bố trước thời điểm hiệu lực' USING ERRCODE = 'PT422'; END IF;
  IF jsonb_typeof(p_data -> 'documents') IS DISTINCT FROM 'array' OR jsonb_array_length(p_data -> 'documents') > 60 THEN
    RAISE EXCEPTION 'Danh sách giấy tờ không hợp lệ (tối đa 60)' USING ERRCODE = 'PT400';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_data -> 'documents') d
             WHERE jsonb_typeof(d) <> 'object'
                OR coalesce(d ->> 'documentCode', '') !~ '^[a-z0-9-]{1,100}$'
                OR length(btrim(coalesce(d ->> 'documentName', ''))) NOT BETWEEN 2 AND 250
                OR jsonb_typeof(d -> 'isRequired') IS DISTINCT FROM 'boolean'
                OR EXISTS (SELECT 1 FROM jsonb_object_keys(d) x WHERE x NOT IN ('documentCode', 'documentName', 'isRequired'))) THEN
    RAISE EXCEPTION 'Giấy tờ phải có documentCode, documentName, isRequired hợp lệ' USING ERRCODE = 'PT400';
  END IF;
  IF (SELECT count(DISTINCT d ->> 'documentCode') <> count(*) FROM jsonb_array_elements(p_data -> 'documents') d) THEN
    RAISE EXCEPTION 'Mã giấy tờ trùng nhau' USING ERRCODE = 'PT422';
  END IF;
  -- Sắp giấy tờ theo mã như ứng dụng cũ để so sánh phiên bản ổn định.
  SELECT coalesce(jsonb_agg(jsonb_build_object('documentCode', d ->> 'documentCode', 'documentName', btrim(d ->> 'documentName'),
           'isRequired', (d ->> 'isRequired')::boolean) ORDER BY (d ->> 'documentCode') COLLATE "C"), '[]'::jsonb)
    INTO v_docs FROM jsonb_array_elements(p_data -> 'documents') d;
  v_id := public.citizen_publish_procedure_version(p_data ->> 'procedureId',
            p_data || jsonb_build_object('documents', v_docs, 'changeNote', coalesce(p_data ->> 'changeNote', '')), v_admin);
  RETURN jsonb_build_object('id', v_id, 'notice',
    'Đã cập nhật phiên bản và thông báo các bản nháp chịu ảnh hưởng. Nguồn do cán bộ khai báo, cần được đối chiếu với văn bản gốc.');
END $$;

-- Gửi các nhắc việc đến hạn vào hộp thông báo của công dân (chỉ trong ứng dụng, không SMS hay email).
CREATE OR REPLACE FUNCTION api.dispatch_citizen_reminders() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.require_sys_admin();
  RETURN jsonb_build_object('sent', public.citizen_dispatch_reminders(300), 'channel', 'in_app_only');
END $$;

-- ===== 9. Quyền =====
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'api.citizen_support_tickets(integer)', 'api.citizen_support_ticket(uuid)', 'api.update_citizen_support_ticket(uuid, text, text, text)',
    'api.redeem_citizen_handoff(text)', 'api.citizen_handoff_document(uuid, uuid)',
    'api.citizen_case_requests()', 'api.decide_citizen_case_request(uuid, boolean, text)', 'api.citizen_case_transfers()',
    'api.start_citizen_case_transfer(uuid, text)', 'api.decide_citizen_case_transfer(uuid, boolean, text)', 'api.scan_citizen_deadlines()',
    'api.update_citizen_delivery(text, text, text, text)', 'api.publish_citizen_result_channel(text, text, text, timestamptz, text)',
    'api.citizen_privacy_requests()', 'api.review_citizen_privacy_request(uuid, text, text)', 'api.citizen_retention_reviews()',
    'api.decide_citizen_retention(uuid, text, text)', 'api.scan_citizen_retention()', 'api.citizen_sync_queue()',
    'api.decide_citizen_sync(uuid, text, text)', 'api.citizen_friction_summary()', 'api.citizen_unanswered_summary()',
    'api.publish_procedure_version(jsonb)', 'api.dispatch_citizen_reminders()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'commune-app') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO "commune-app"', f);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
