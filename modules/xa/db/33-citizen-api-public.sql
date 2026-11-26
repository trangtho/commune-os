-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
--
-- API công khai của lõi cho Kênh người dân: kho tri thức thủ tục của trợ lý, phiên bản và nguồn văn bản của thủ tục,
-- hướng dẫn biểu mẫu, kênh thực hiện, câu hỏi gợi ý thủ tục, danh mục cho gợi ý và lộ trình, địa phương, phiên chuẩn bị
-- tại quầy (không đăng nhập), tra cứu mã kiểm chứng kết quả.
--
-- Khách gọi qua cổng APISIX tại /public/rpc/<tên hàm> (không token, có giới hạn số lần gọi, vai trò web_anon); công dân
-- đã đăng nhập gọi cùng hàm qua /rest/rpc/<tên hàm> bằng token. Các hàm public_* chạy bằng quyền chủ sở hữu
-- (SECURITY DEFINER) và chỉ trả dữ liệu đã công bố. Khi người gọi là công dân (rest_pre_request đã đặt app.tenant_id
-- từ token đã kiểm chữ ký), kết quả lọc theo thủ tục xã của công dân đang mở; khách không có biến này.
-- Phần riêng của công dân (lịch sử hồ sơ, tùy chọn, tuyến tiếp nhận từ xã mình) là các hàm citizen_* chạy bằng quyền
-- công dân, RLS áp dụng. Chạy lại nhiều lần được.

-- Xã của công dân đang gọi (NULL với khách và cán bộ).
CREATE OR REPLACE FUNCTION public.request_citizen_tenant() RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.tenant_id', true), '')::uuid $$;

-- ===== 1. Kho tri thức của trợ lý =====
CREATE OR REPLACE FUNCTION api.public_knowledge() RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object(
    'catalog', coalesce((SELECT json_agg(x ORDER BY x.title) FROM (
      SELECT p.id, p.title, p.category, p.summary, p.instructions, p.fee_note, p.sla_days,
        coalesce(json_agg(json_build_object('document_code', d.document_code, 'document_name', d.document_name, 'is_required', d.is_required)
          ORDER BY d.document_code) FILTER (WHERE d.document_code IS NOT NULL), '[]'::json) AS documents
      FROM procedures p LEFT JOIN procedure_documents d ON d.procedure_id = p.id
      WHERE p.published = true GROUP BY p.id) x), '[]'::json),
    'faq', coalesce((SELECT json_agg(f ORDER BY f.id) FROM (SELECT id, question, answer, keywords FROM citizen_faq) f), '[]'::json))
$$;

-- p_query: biểu thức to_tsquery đã được Kênh người dân chuẩn hóa (shared/rag-evidence.ts, safeTsQuery).
CREATE OR REPLACE FUNCTION api.public_knowledge_search(p_query text DEFAULT '', p_procedure_id text DEFAULT '') RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_query text := coalesce(p_query, ''); v_procedure text := coalesce(p_procedure_id, '');
BEGIN
  IF length(v_query) > 2000 OR length(v_procedure) > 80 THEN PERFORM public.citizen_fail(400, 'Câu hỏi quá dài'); END IF;
  IF v_query = '' AND v_procedure = '' THEN RETURN '[]'::json; END IF;
  RETURN coalesce((SELECT json_agg(c ORDER BY c.rank DESC, c.id) FROM (
    SELECT id, source_type, procedure_id, field, source_title, content,
      CASE WHEN v_query = '' THEN 0 ELSE ts_rank_cd(search_vector, to_tsquery('simple', v_query)) END AS score,
      (CASE WHEN procedure_id = v_procedure AND v_procedure <> '' THEN 10 ELSE 0 END)
        + (CASE WHEN v_query = '' THEN 0 ELSE ts_rank_cd(search_vector, to_tsquery('simple', v_query)) END) AS rank
    FROM citizen_knowledge_chunks
    WHERE (v_query <> '' AND search_vector @@ to_tsquery('simple', v_query)) OR (v_procedure <> '' AND procedure_id = v_procedure)
    ORDER BY rank DESC, id LIMIT 42) c), '[]'::json);
EXCEPTION WHEN syntax_error THEN
  PERFORM public.citizen_fail(400, 'Câu hỏi không hợp lệ');
END $$;

CREATE OR REPLACE FUNCTION api.public_knowledge_status() RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object('ready', true, 'chunks', count(*),
    'procedures', count(DISTINCT procedure_id) FILTER (WHERE source_type = 'procedure'),
    'faqs', count(*) FILTER (WHERE source_type = 'faq'), 'lastIndexedAt', max(updated_at))
  FROM citizen_knowledge_chunks
$$;

-- Nguồn văn bản của phiên bản mới nhất cho các thủ tục được trợ lý trích dẫn.
CREATE OR REPLACE FUNCTION api.public_provenance(p_procedure_ids text[]) RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(json_agg(v), '[]'::json) FROM (
    SELECT DISTINCT ON (v.procedure_id) v.procedure_id, v.source_url, v.source_title, v.source_reference, v.scope_note,
      v.effective_from, v.provenance_status
    FROM citizen_procedure_versions v JOIN procedures p ON p.id = v.procedure_id AND p.published
    WHERE v.procedure_id = ANY ((coalesce(p_procedure_ids, '{}'::text[]))[1:20])
    ORDER BY v.procedure_id, v.version_no DESC) v
$$;

-- ===== 2. Thông tin thủ tục =====
CREATE OR REPLACE FUNCTION api.public_procedure_versions(p_procedure_id text) RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v json;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM procedures WHERE id = p_procedure_id AND published) THEN
    PERFORM public.citizen_fail(404, 'Không tìm thấy thủ tục được công bố');
  END IF;
  SELECT coalesce(json_agg(x ORDER BY x.version_no DESC), '[]'::json) INTO v FROM (
    SELECT id, version_no, effective_from, source_url, source_title, source_reference, issuing_authority, scope_note,
      provenance_status, change_sections, change_note, published_at, snapshot
    FROM citizen_procedure_versions WHERE procedure_id = p_procedure_id ORDER BY version_no DESC LIMIT 30) x;
  RETURN json_build_object('procedureId', p_procedure_id, 'current', v -> 0, 'versions', v);
END $$;

CREATE OR REPLACE FUNCTION api.public_procedure_guide_source(p_procedure_id text) RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v json;
BEGIN
  SELECT json_build_object('id', p.id, 'title', p.title, 'source_url', v.source_url, 'provenance_status', v.provenance_status) INTO v
  FROM procedures p LEFT JOIN LATERAL (SELECT source_url, provenance_status FROM citizen_procedure_versions
                                       WHERE procedure_id = p.id ORDER BY version_no DESC LIMIT 1) v ON true
  WHERE p.id = p_procedure_id AND p.published;
  IF v IS NULL THEN PERFORM public.citizen_fail(404, 'Không tìm thấy thủ tục được công bố'); END IF;
  RETURN v;
END $$;

-- Kênh thực hiện: trực tuyến khi xã của công dân mở thủ tục; tại quầy khi xã có khung giờ đã công bố.
CREATE OR REPLACE FUNCTION api.public_procedure_channels(p_procedure_id text) RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_fee text; v_tenant uuid := public.request_citizen_tenant();
BEGIN
  SELECT fee_note INTO v_fee FROM procedures WHERE id = p_procedure_id AND published;
  IF NOT FOUND THEN PERFORM public.citizen_fail(404, 'Không tìm thấy thủ tục đang công bố'); END IF;
  RETURN json_build_object('id', p_procedure_id, 'fee_note', v_fee, 'published', true,
    'online', v_tenant IS NOT NULL AND public.procedure_enabled_for(v_tenant, p_procedure_id),
    'counterSlots', CASE WHEN v_tenant IS NULL THEN 0 ELSE (SELECT count(*)::int FROM citizen_counter_slots
      WHERE tenant_id = v_tenant AND procedure_id = p_procedure_id AND published = true AND starts_at > now()) END);
END $$;

-- Thủ tục và quy tắc gợi ý đã được biên soạn (không đoán điều kiện pháp lý).
CREATE OR REPLACE FUNCTION api.public_guidance_rules() RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object(
    'procedures', coalesce((SELECT json_agg(p) FROM (SELECT id, title, summary, category, published FROM procedures WHERE published = true) p), '[]'::json),
    'rules', coalesce((SELECT json_agg(r) FROM (
      SELECT r.procedure_id, r.purpose, r.audiences, r.situations, r.explanation, r.distinction, r.verified_at, r.source_reference, r.enabled
      FROM citizen_procedure_guidance_rules r JOIN procedures p ON p.id = r.procedure_id WHERE r.enabled AND p.published) r), '[]'::json))
$$;

CREATE OR REPLACE FUNCTION api.public_recommendation_catalog() RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(json_agg(x ORDER BY x.title), '[]'::json) FROM (
    SELECT p.id, p.title, p.category, p.summary, p.icon, p.sla_days, p.fee_note, p.instructions,
      coalesce(m.audience_groups, '{}'::text[]) AS audience_groups, coalesce(m.available_tenant_ids, '{}'::uuid[]) AS available_tenant_ids,
      (m.verified_at IS NOT NULL AND length(btrim(coalesce(m.source_reference, ''))) > 0) AS metadata_verified
    FROM procedures p LEFT JOIN procedure_recommendation_metadata m ON m.procedure_id = p.id
    WHERE p.published = true AND (public.request_citizen_tenant() IS NULL OR public.procedure_enabled_for(public.request_citizen_tenant(), p.id))) x
$$;

-- Danh mục cho lộ trình sự kiện cuộc sống; công dân chỉ thấy thủ tục xã mình mở.
CREATE OR REPLACE FUNCTION api.public_journey_catalog() RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(json_agg(x ORDER BY x.title), '[]'::json) FROM (
    SELECT p.id, p.title, p.summary, p.category, p.fee_note, p.sla_days,
      coalesce((SELECT jsonb_agg(jsonb_build_object('document_code', d.document_code, 'document_name', d.document_name, 'is_required', d.is_required))
        FROM procedure_documents d WHERE d.procedure_id = p.id), '[]'::jsonb) AS documents,
      v.source_url, v.provenance_status
    FROM procedures p LEFT JOIN LATERAL (SELECT source_url, provenance_status FROM citizen_procedure_versions
                                         WHERE procedure_id = p.id ORDER BY version_no DESC LIMIT 1) v ON true
    WHERE p.published = true AND (public.request_citizen_tenant() IS NULL OR public.procedure_enabled_for(public.request_citizen_tenant(), p.id))
    ORDER BY p.title LIMIT 300) x
$$;

-- Danh sách địa phương; có p_procedure_id thì kèm xã nào đang mở thủ tục.
CREATE OR REPLACE FUNCTION api.public_localities(p_procedure_id text DEFAULT '') RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(json_agg(x ORDER BY x.name), '[]'::json) FROM (
    SELECT t.id, t.code, t.name,
      CASE WHEN coalesce(p_procedure_id, '') ~ '^[a-z0-9-]{2,80}$' THEN public.procedure_enabled_for(t.id, p_procedure_id) END AS procedure_open
    FROM tenants t ORDER BY t.name LIMIT 200) x
$$;

-- ===== 3. Phiên chuẩn bị tại quầy (không đăng nhập; mã chỉ để tham khảo, không chứng minh danh tính) =====
-- p_code_hash: SHA-256 (hex) của mã ngẫu nhiên Kênh người dân giữ trong cookie; lõi không thấy mã gốc.
CREATE OR REPLACE FUNCTION api.public_counter_session(p_code_hash text) RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object('procedure_id', s.procedure_id, 'title', p.title, 'expires_at', s.expires_at)
  FROM citizen_counter_sessions s JOIN procedures p ON p.id = s.procedure_id
  WHERE s.code_hash = p_code_hash AND s.expires_at > now() AND s.ended_at IS NULL AND p.published = true
$$;

CREATE OR REPLACE FUNCTION api.public_counter_session_start(p_code_hash text, p_procedure_id text) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_expires timestamptz;
BEGIN
  IF coalesce(p_code_hash, '') !~ '^[0-9a-f]{64}$' THEN PERFORM public.citizen_fail(400, 'Mã phiên không hợp lệ'); END IF;
  IF NOT EXISTS (SELECT 1 FROM procedures WHERE id = p_procedure_id AND published = true) THEN
    PERFORM public.citizen_fail(404, 'Thủ tục không được công bố');
  END IF;
  INSERT INTO citizen_counter_sessions(code_hash, procedure_id, expires_at) VALUES (p_code_hash, p_procedure_id, now() + interval '15 minutes')
  RETURNING expires_at INTO v_expires;
  RETURN json_build_object('expires_at', v_expires);
END $$;

CREATE OR REPLACE FUNCTION api.public_counter_session_end(p_code_hash text) RETURNS json
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH x AS (UPDATE citizen_counter_sessions SET ended_at = now() WHERE code_hash = p_code_hash AND ended_at IS NULL RETURNING 1)
  SELECT json_build_object('ended', true)
$$;

-- ===== 4. Tra cứu mã kiểm chứng kết quả (người có mã trên giấy kết quả) =====
CREATE OR REPLACE FUNCTION api.public_result_verification(p_token_hash text) RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(p_token_hash, '') !~ '^[0-9a-f]{64}$' THEN RETURN NULL; END IF;
  RETURN (SELECT row_to_json(r) FROM public.citizen_verify_result_public(p_token_hash) r LIMIT 1);
END $$;

-- ===== 5. Phần riêng của công dân (quyền công dân, RLS) =====
-- Tùy chọn và số lần đã nộp từng thủ tục (chỉ khi công dân bật cá nhân hóa) để sắp xếp gợi ý.
CREATE OR REPLACE FUNCTION api.citizen_recommendation_context() RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); v_prefs json := public.citizen_preferences_json(a.citizen_id);
BEGIN
  RETURN json_build_object('preferences', v_prefs, 'history', CASE WHEN (v_prefs ->> 'personalization_enabled')::boolean
    THEN coalesce((SELECT json_agg(h) FROM (SELECT procedure_id, count(*)::int AS uses FROM applications
         WHERE citizen_id = a.citizen_id AND status <> 'draft' GROUP BY procedure_id) h), '[]'::json) ELSE '[]'::json END);
END $$;

-- Xã có tuyến tiếp nhận được phê duyệt từ xã của công dân cho một thủ tục.
CREATE OR REPLACE FUNCTION api.citizen_receivers(p_procedure_id text) RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE a record := public.citizen_actor();
BEGIN
  RETURN coalesce((SELECT json_agg(receiving_tenant_id) FROM citizen_procedure_receivers
    WHERE procedure_id = p_procedure_id AND source_tenant_id = a.tenant_id AND enabled = true
      AND btrim(approval_reference) <> '' AND valid_until > now()), '[]'::json);
END $$;

-- Kiểm tra địa phương gợi ý (Kênh người dân tính từ tùy chọn, shared/personalization.ts) có tuyến tiếp nhận không.
CREATE OR REPLACE FUNCTION api.citizen_locality_route(p_procedure_id text, p_candidate_tenant_id uuid) RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); v_can boolean; v_reference text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM procedures WHERE id = p_procedure_id AND published = true) THEN
    PERFORM public.citizen_fail(404, 'Thủ tục không được công bố');
  END IF;
  v_can := public.citizen_receiver_permitted(p_procedure_id, a.tenant_id, coalesce(p_candidate_tenant_id, a.tenant_id));
  IF v_can AND p_candidate_tenant_id IS DISTINCT FROM a.tenant_id THEN
    SELECT approval_reference INTO v_reference FROM citizen_procedure_receivers
    WHERE procedure_id = p_procedure_id AND source_tenant_id = a.tenant_id AND receiving_tenant_id = p_candidate_tenant_id
      AND enabled AND valid_until > now() AND btrim(approval_reference) <> '';
  END IF;
  RETURN json_build_object('accountTenantId', a.tenant_id, 'canReceive', v_can, 'approvalReference', v_reference,
    'accountTenantName', (SELECT name FROM tenants WHERE id = a.tenant_id),
    'candidateTenantName', (SELECT name FROM tenants WHERE id = p_candidate_tenant_id));
END $$;

-- ===== 6. Quyền gọi =====
DO $$
DECLARE f text;
BEGIN
  GRANT EXECUTE ON FUNCTION public.request_citizen_tenant() TO web_anon, "citizen-app";
  FOREACH f IN ARRAY ARRAY['api.public_knowledge()', 'api.public_knowledge_search(text, text)', 'api.public_knowledge_status()',
    'api.public_provenance(text[])', 'api.public_procedure_versions(text)', 'api.public_procedure_guide_source(text)',
    'api.public_procedure_channels(text)', 'api.public_guidance_rules()', 'api.public_recommendation_catalog()',
    'api.public_journey_catalog()', 'api.public_localities(text)', 'api.public_counter_session(text)',
    'api.public_counter_session_start(text, text)', 'api.public_counter_session_end(text)', 'api.public_result_verification(text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO web_anon, "citizen-app"', f);
  END LOOP;
  FOREACH f IN ARRAY ARRAY['api.citizen_recommendation_context()', 'api.citizen_receivers(text)', 'api.citizen_locality_route(text, uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO "citizen-app"', f);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
