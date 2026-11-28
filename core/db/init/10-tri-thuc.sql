-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
--
-- Kho tri thức dùng chung cho trợ lý AI của lõi (core/ai): tài liệu nội bộ của các gói nghiệp vụ và của từng đơn vị.
--   * Tài liệu của gói: tệp Markdown khai báo ở mục "knowledge" của module.json, core/db/migrate.sh nạp khi cài gói
--     (public.knowledge_load_module_doc). Dùng chung cho mọi đơn vị bật gói.
--   * Tài liệu của đơn vị: lãnh đạo đơn vị nạp qua API (api.knowledge_add), chỉ đơn vị đó thấy.
--   * Mỗi mục "## ..." của tài liệu là một đoạn tri thức; ai-gateway tạo vector (bge-m3) cho đoạn mới hoặc đã sửa.
--   * Tìm kiếm lai toàn văn + ngữ nghĩa (api.core_knowledge_search), chỉ ai-gateway gọi (X-Workflow-Token). Phạm vi lấy
--     từ token người hỏi: chỉ gói đơn vị đã bật, tài liệu chung của gói và tài liệu riêng của đơn vị; "staff" chỉ cho
--     người của đơn vị, khách và công dân chỉ thấy "public".
-- Gói có nguồn tri thức riêng (gói xã: thủ tục, câu hỏi thường gặp) khai báo "knowledgeProvider" trong module.json;
-- ai-gateway gộp kết quả của lõi và các gói. Chạy lại nhiều lần không lỗi.

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS core_knowledge (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_key        text NOT NULL UNIQUE,                    -- gói: "<gói>:<tệp>#<mục>", đơn vị: "<id>#<mục>"
  module         text NOT NULL CHECK (module ~ '^[a-z][a-z0-9-]{0,62}$'),
  tenant_id      uuid REFERENCES tenants(id) ON DELETE CASCADE,   -- NULL: tài liệu chung của gói
  audience       text NOT NULL DEFAULT 'staff' CHECK (audience IN ('public', 'staff')),
  source         text NOT NULL,                           -- tên tệp của gói, hoặc "đơn vị"
  title          text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 300),
  content        text NOT NULL CHECK (length(btrim(content)) BETWEEN 1 AND 8000),
  search_vector  tsvector,
  embedding      vector(1024),
  embedding_model text,
  embedding_hash text,
  embedded_at    timestamptz,
  created_by     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS core_knowledge_search_idx ON core_knowledge USING gin (search_vector);
CREATE INDEX IF NOT EXISTS core_knowledge_embedding_idx ON core_knowledge USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS core_knowledge_scope_idx ON core_knowledge (module, tenant_id);
REVOKE ALL ON core_knowledge FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.core_knowledge_vector() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  NEW.search_vector := to_tsvector('simple', public.unaccent(lower(NEW.title || ' ' || NEW.content)));
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS core_knowledge_vector ON core_knowledge;
CREATE TRIGGER core_knowledge_vector BEFORE INSERT OR UPDATE OF title, content ON core_knowledge
  FOR EACH ROW EXECUTE FUNCTION public.core_knowledge_vector();

-- Chia một tài liệu Markdown thành các mục: dòng "# ..." đầu tiên là tên tài liệu, mỗi "## ..." là một mục.
-- Trả (n, title, content); tài liệu không có mục "##" thì cả tài liệu là một mục.
CREATE OR REPLACE FUNCTION public.knowledge_sections(p_markdown text) RETURNS TABLE (n int, title text, content text)
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_doc   text := coalesce(substring(p_markdown FROM '(?m)^# +([^\n]+)'), 'Tài liệu');
  v_parts text[] := regexp_split_to_array(p_markdown, '\n(?=## )');
  v_part  text;
  v_head  text;
  v_body  text;
BEGIN
  n := 0;
  FOREACH v_part IN ARRAY v_parts LOOP
    v_head := substring(v_part FROM '^## +([^\n]+)');
    v_body := regexp_replace(regexp_replace(v_part, '^## +[^\n]*\n?', ''), '(?m)^# +[^\n]*\n?', '');
    -- Bỏ chú thích HTML (tiêu đề giấy phép SPDX của tệp Markdown) và mọi khoảng trắng, xuống dòng ở hai đầu.
    v_body := regexp_replace(regexp_replace(v_body, '<!--.*?-->', '', 'g'), '^\s+|\s+$', '', 'g');
    -- Nối dòng bị ngắt giữa đoạn văn (Markdown ngắt dòng theo độ rộng), giữ dòng trống, gạch đầu dòng, tiêu đề.
    v_body := regexp_replace(v_body, '(?<!\n)\n(?![\n#*-]|\d+\. )', ' ', 'g');
    CONTINUE WHEN v_body = '';
    n := n + 1;
    title := CASE WHEN v_head IS NULL THEN v_doc ELSE v_doc || ': ' || btrim(v_head) END;
    content := left(v_body, 8000);
    RETURN NEXT;
  END LOOP;
END $$;

-- Nạp (hoặc cập nhật) một tài liệu của gói; core/db/migrate.sh gọi. Mục không đổi giữ nguyên vector.
CREATE OR REPLACE FUNCTION public.knowledge_load_module_doc(p_module text, p_source text, p_audience text, p_markdown text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  WITH s AS (SELECT * FROM public.knowledge_sections(p_markdown)),
  up AS (
    INSERT INTO core_knowledge (doc_key, module, tenant_id, audience, source, title, content)
    SELECT p_module || ':' || p_source || '#' || s.n, p_module, NULL, p_audience, p_source, s.title, s.content FROM s
    ON CONFLICT (doc_key) DO UPDATE SET audience = EXCLUDED.audience, title = EXCLUDED.title, content = EXCLUDED.content
    WHERE (core_knowledge.audience, core_knowledge.title, core_knowledge.content)
          IS DISTINCT FROM (EXCLUDED.audience, EXCLUDED.title, EXCLUDED.content)
    RETURNING 1)
  DELETE FROM core_knowledge k
  WHERE k.module = p_module AND k.tenant_id IS NULL AND k.source = p_source
    AND k.doc_key NOT IN (SELECT p_module || ':' || p_source || '#' || n FROM s);
  SELECT count(*) INTO v_count FROM core_knowledge WHERE module = p_module AND tenant_id IS NULL AND source = p_source;
  RETURN v_count;
END $$;

-- Gỡ tài liệu chung của gói không còn khai báo trong module.json.
CREATE OR REPLACE FUNCTION public.knowledge_prune_module(p_module text, p_sources text[]) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM core_knowledge WHERE module = p_module AND tenant_id IS NULL AND NOT (source = ANY (coalesce(p_sources, '{}')))
$$;
REVOKE ALL ON FUNCTION public.knowledge_load_module_doc(text, text, text, text),
  public.knowledge_prune_module(text, text[]) FROM PUBLIC;

-- ===== API cho người của đơn vị =====
-- Tài liệu đơn vị thấy: tài liệu chung của các gói đơn vị đã bật và tài liệu riêng của đơn vị (theo mục).
DROP VIEW IF EXISTS api.knowledge_documents;
CREATE VIEW api.knowledge_documents AS
SELECT k.id, k.module, CASE WHEN k.tenant_id IS NULL THEN 'goi' ELSE 'don-vi' END AS scope,
       k.audience, k.source, k.title, k.content, k.created_by, k.updated_at,
       (k.embedding IS NOT NULL AND k.embedding_hash = md5(k.content)) AS embedded
FROM core_knowledge k
JOIN tenants t ON t.code = public.current_tenant_code() AND t.status = 'active'
WHERE public.tenant_has_module(t.id, k.module) AND (k.tenant_id IS NULL OR k.tenant_id = t.id)
  AND (k.audience = 'public' OR public.require_staff() IS NOT NULL)
ORDER BY k.module, k.tenant_id NULLS FIRST, k.doc_key;

-- Lãnh đạo đơn vị nạp một tài liệu riêng (Markdown, mỗi "## ..." là một mục) cho một gói đơn vị đã bật.
CREATE OR REPLACE FUNCTION api.knowledge_add(module text, title text, content text, audience text DEFAULT 'staff')
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code   text := public.require_module(module);
  v_tenant uuid := (SELECT id FROM tenants WHERE code = v_code);
  v_doc    uuid := gen_random_uuid();
  v_n      int;
BEGIN
  PERFORM public.require_leader();
  IF audience NOT IN ('public', 'staff') THEN
    RAISE EXCEPTION 'audience chỉ nhận public hoặc staff' USING ERRCODE = '22023';
  END IF;
  IF length(btrim(coalesce(title, ''))) NOT BETWEEN 3 AND 200 OR length(btrim(coalesce(content, ''))) NOT BETWEEN 10 AND 50000 THEN
    RAISE EXCEPTION 'Tên tài liệu 3–200 ký tự, nội dung 10–50000 ký tự' USING ERRCODE = '22023';
  END IF;
  INSERT INTO core_knowledge (doc_key, module, tenant_id, audience, source, title, content, created_by)
  SELECT v_doc || '#' || s.n, module, v_tenant, audience, 'đơn vị', s.title, s.content, public.current_staff_name()
  FROM public.knowledge_sections('# ' || btrim(title) || E'\n' || content) s;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN json_build_object('document', v_doc, 'sections', v_n);
END $$;

-- Lãnh đạo gỡ một tài liệu riêng của đơn vị (mọi mục của tài liệu đó). Không gỡ được tài liệu chung của gói.
CREATE OR REPLACE FUNCTION api.knowledge_remove(document uuid) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text := public.require_leader(); v_n int;
BEGIN
  DELETE FROM core_knowledge k USING tenants t
   WHERE t.id = k.tenant_id AND t.code = v_code AND k.doc_key LIKE document::text || '#%';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'Không tìm thấy tài liệu của đơn vị' USING ERRCODE = 'P0002';
  END IF;
  RETURN json_build_object('document', document, 'removed', v_n);
END $$;

-- ===== Cho ai-gateway (kèm X-Workflow-Token) =====
-- Cùng chữ ký, cùng dạng kết quả với nguồn tri thức của gói (knowledgeProvider), để ai-gateway gộp kết quả.
-- p_ref_id: mã đối tượng người hỏi đang xem (gói tự hiểu, ví dụ mã thủ tục), nguồn có thể ưu tiên; kho của lõi bỏ qua.
-- Kết quả: id, source_type, field, source_title, content, score, similarity, matched; gói có thể thêm cột riêng.
DROP FUNCTION IF EXISTS api.core_knowledge_search(text, text, text, int, real, text, text);
CREATE FUNCTION api.core_knowledge_search(p_query text, p_embedding text DEFAULT NULL,
  p_ref_id text DEFAULT '', p_limit int DEFAULT 8, p_min_similarity real DEFAULT 0.5,
  p_tenant_code text DEFAULT '', p_audience text DEFAULT 'public') RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ts tsquery;
  v_vec vector(1024);
  v_limit int := least(greatest(coalesce(p_limit, 8), 1), 30);
  v_tenant uuid;
BEGIN
  IF NOT public.is_workflow_call() THEN
    RAISE EXCEPTION 'Chỉ dịch vụ AI của lõi được gọi hàm này' USING ERRCODE = '42501';
  END IF;
  IF coalesce(p_tenant_code, '') <> '' THEN
    SELECT id INTO v_tenant FROM tenants WHERE code = p_tenant_code AND status = 'active';
    IF v_tenant IS NULL THEN v_tenant := '00000000-0000-0000-0000-000000000000'; END IF;
  END IF;
  SELECT to_tsquery('simple', string_agg(quote_literal(lexeme), ' | '))
  INTO v_ts
  FROM unnest(to_tsvector('simple', public.unaccent(lower(left(coalesce(p_query, ''), 500)))))
  WHERE length(lexeme) >= 2;
  IF p_embedding IS NOT NULL THEN v_vec := p_embedding::vector(1024); END IF;
  RETURN (
    WITH scope AS (
      SELECT k.* FROM core_knowledge k JOIN core_modules m ON m.name = k.module
      WHERE (k.audience = 'public' OR p_audience = 'staff')
        AND CASE WHEN v_tenant IS NULL THEN k.tenant_id IS NULL
                 ELSE public.tenant_has_module(v_tenant, k.module) AND (k.tenant_id IS NULL OR k.tenant_id = v_tenant) END),
    fts AS (
      SELECT id, row_number() OVER (ORDER BY ts_rank_cd(search_vector, v_ts) DESC, id) AS r
      FROM scope WHERE v_ts IS NOT NULL AND search_vector @@ v_ts
      ORDER BY ts_rank_cd(search_vector, v_ts) DESC, id LIMIT 40),
    vec AS (
      SELECT id, sim, row_number() OVER (ORDER BY sim DESC, id) AS r FROM (
        SELECT id, 1 - (embedding <=> v_vec) AS sim FROM scope
        WHERE v_vec IS NOT NULL AND embedding IS NOT NULL
        ORDER BY embedding <=> v_vec LIMIT 40) n
      WHERE sim >= coalesce(p_min_similarity, 0.5)),
    ranked AS (
      SELECT c.id::text AS id, CASE WHEN c.tenant_id IS NULL THEN 'module_doc' ELSE 'tenant_doc' END AS source_type,
        c.module AS field, c.title AS source_title, c.content,
        coalesce(1.0 / (60 + fts.r), 0) + coalesce(1.0 / (60 + vec.r), 0) AS score,
        round(vec.sim::numeric, 4) AS similarity,
        CASE WHEN fts.id IS NOT NULL AND vec.id IS NOT NULL THEN 'both' WHEN vec.id IS NOT NULL THEN 'vector' ELSE 'text' END AS matched
      FROM scope c LEFT JOIN fts ON fts.id = c.id LEFT JOIN vec ON vec.id = c.id
      WHERE fts.id IS NOT NULL OR vec.id IS NOT NULL)
    SELECT coalesce(json_agg(x ORDER BY x.score DESC, x.id), '[]'::json)
    FROM (SELECT * FROM ranked ORDER BY score DESC, id LIMIT v_limit) x);
END $$;

CREATE OR REPLACE FUNCTION api.core_knowledge_pending(p_model text, p_limit int DEFAULT 16) RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_workflow_call() THEN
    RAISE EXCEPTION 'Chỉ dịch vụ AI của lõi được gọi hàm này' USING ERRCODE = '42501';
  END IF;
  RETURN (SELECT coalesce(json_agg(json_build_object('id', id, 'hash', md5(content), 'text', title || '. ' || content)), '[]'::json)
          FROM (SELECT id, title, content FROM core_knowledge
                WHERE embedding IS NULL OR embedding_hash IS DISTINCT FROM md5(content)
                   OR embedding_model IS DISTINCT FROM p_model
                ORDER BY id LIMIT least(greatest(coalesce(p_limit, 16), 1), 64)) p);
END $$;

CREATE OR REPLACE FUNCTION api.core_knowledge_store(p_model text, p_items jsonb) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  IF NOT public.is_workflow_call() THEN
    RAISE EXCEPTION 'Chỉ dịch vụ AI của lõi được gọi hàm này' USING ERRCODE = '42501';
  END IF;
  UPDATE core_knowledge c
  SET embedding = (i ->> 'embedding')::vector(1024), embedding_model = p_model,
      embedding_hash = i ->> 'hash', embedded_at = now()
  FROM jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) i
  WHERE c.id::text = i ->> 'id' AND md5(c.content) = i ->> 'hash';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN json_build_object('stored', v_count);
END $$;

CREATE OR REPLACE FUNCTION api.core_knowledge_status(p_model text) RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_workflow_call() THEN
    RAISE EXCEPTION 'Chỉ dịch vụ AI của lõi được gọi hàm này' USING ERRCODE = '42501';
  END IF;
  RETURN (SELECT json_build_object('chunks', count(*),
    'embedded', count(*) FILTER (WHERE embedding IS NOT NULL AND embedding_hash = md5(content) AND embedding_model = p_model),
    'lastEmbeddedAt', max(embedded_at)) FROM core_knowledge);
END $$;

REVOKE ALL ON FUNCTION api.knowledge_add(text, text, text, text), api.knowledge_remove(uuid),
  api.core_knowledge_search(text, text, text, int, real, text, text), api.core_knowledge_pending(text, int),
  api.core_knowledge_store(text, jsonb), api.core_knowledge_status(text) FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'commune-app') THEN
    GRANT SELECT ON api.knowledge_documents TO "commune-app";
    GRANT EXECUTE ON FUNCTION api.knowledge_add(text, text, text, text), api.knowledge_remove(uuid) TO "commune-app";
  END IF;
  -- ai-gateway gọi không kèm token người dùng (vai trò web_anon), nhưng phải kèm X-Workflow-Token.
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'web_anon') THEN
    GRANT EXECUTE ON FUNCTION api.core_knowledge_search(text, text, text, int, real, text, text),
      api.core_knowledge_pending(text, int), api.core_knowledge_store(text, jsonb),
      api.core_knowledge_status(text) TO web_anon;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
