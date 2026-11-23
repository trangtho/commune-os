-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
--
-- Tìm kiếm ngữ nghĩa cho trợ lý AI chạy cục bộ (core/ai).
-- Chỉ mục tri thức citizen_knowledge_chunks (chỉ thủ tục đã công bố và câu hỏi thường gặp, không có
-- dữ liệu cá nhân) được thêm vector do dịch vụ ai-gateway tạo bằng mô hình nhúng chạy trên máy chủ.
-- Đoạn mới hoặc đoạn đổi nội dung (mã băm khác) được tạo vector lại. Chạy lại nhiều lần được.

CREATE EXTENSION IF NOT EXISTS vector;

-- Mô hình nhúng mặc định bge-m3 cho vector 1024 chiều.
ALTER TABLE citizen_knowledge_chunks
  ADD COLUMN IF NOT EXISTS embedding vector(1024),
  ADD COLUMN IF NOT EXISTS embedding_model text,
  ADD COLUMN IF NOT EXISTS embedding_hash text,
  ADD COLUMN IF NOT EXISTS embedded_at timestamptz;
CREATE INDEX IF NOT EXISTS citizen_knowledge_chunks_embedding_idx
  ON citizen_knowledge_chunks USING hnsw (embedding vector_cosine_ops);

-- ===== Tìm kiếm lai: toàn văn + vector, xếp hạng bằng Reciprocal Rank Fusion =====
-- p_embedding: vector của câu hỏi dạng '[0.1,0.2,...]'; NULL thì chỉ tìm toàn văn.
-- Kết quả vector chỉ được tính khi độ tương đồng cosine >= p_min_similarity.
-- Phạm vi do cổng AI đặt từ token đã ký, không do người hỏi tự khai:
--   p_tenant_code: chỉ trả thủ tục xã đó đang mở (rỗng: khách, mọi thủ tục đã công bố);
--   p_audience: 'citizen' không bao giờ thấy hướng dẫn nghiệp vụ nội bộ của cán bộ (staff_guide).
DROP FUNCTION IF EXISTS api.knowledge_search(text, text, text, int, real);
CREATE OR REPLACE FUNCTION api.knowledge_search(p_query text, p_embedding text DEFAULT NULL,
  p_procedure_id text DEFAULT '', p_limit int DEFAULT 8, p_min_similarity real DEFAULT 0.5,
  p_tenant_code text DEFAULT '', p_audience text DEFAULT 'citizen') RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ts tsquery;
  v_vec vector(1024);
  v_limit int := least(greatest(coalesce(p_limit, 8), 1), 30);
  v_tenant uuid;
BEGIN
  IF coalesce(p_tenant_code, '') <> '' THEN
    SELECT id INTO v_tenant FROM tenants WHERE code = p_tenant_code;
    -- Mã xã không tồn tại: không trả thủ tục nào (không rơi về toàn bộ danh mục).
    IF v_tenant IS NULL THEN v_tenant := '00000000-0000-0000-0000-000000000000'; END IF;
  END IF;
  -- Chỉ lấy các từ của câu hỏi (không nhận cú pháp tìm kiếm từ người dùng), nối bằng OR.
  SELECT to_tsquery('simple', string_agg(quote_literal(lexeme), ' | '))
  INTO v_ts
  FROM unnest(to_tsvector('simple', public.unaccent(lower(left(coalesce(p_query, ''), 500)))))
  WHERE length(lexeme) >= 2;
  IF p_embedding IS NOT NULL THEN v_vec := p_embedding::vector(1024); END IF;
  RETURN (
    WITH scope AS (
      SELECT c.* FROM citizen_knowledge_chunks c
      WHERE (c.source_type <> 'staff_guide' OR p_audience = 'staff')
        AND (c.procedure_id IS NULL OR v_tenant IS NULL OR public.procedure_enabled_for(v_tenant, c.procedure_id))),
    fts AS (
      SELECT id, row_number() OVER (ORDER BY ts_rank_cd(search_vector, v_ts) DESC, id) AS r
      FROM scope
      WHERE v_ts IS NOT NULL AND search_vector @@ v_ts
      ORDER BY ts_rank_cd(search_vector, v_ts) DESC, id LIMIT 40),
    vec AS (
      SELECT id, sim, row_number() OVER (ORDER BY sim DESC, id) AS r FROM (
        SELECT id, 1 - (embedding <=> v_vec) AS sim FROM scope
        WHERE v_vec IS NOT NULL AND embedding IS NOT NULL
        ORDER BY embedding <=> v_vec LIMIT 40) n
      WHERE sim >= coalesce(p_min_similarity, 0.5)),
    ranked AS (
      SELECT c.id, c.source_type, c.procedure_id, c.field, c.source_title, c.content,
        coalesce(1.0 / (60 + fts.r), 0) + coalesce(1.0 / (60 + vec.r), 0)
          + CASE WHEN coalesce(p_procedure_id, '') <> '' AND c.procedure_id = p_procedure_id THEN 0.05 ELSE 0 END AS score,
        round(vec.sim::numeric, 4) AS similarity,
        CASE WHEN fts.id IS NOT NULL AND vec.id IS NOT NULL THEN 'both' WHEN vec.id IS NOT NULL THEN 'vector' ELSE 'text' END AS matched
      FROM scope c
      LEFT JOIN fts ON fts.id = c.id
      LEFT JOIN vec ON vec.id = c.id
      WHERE fts.id IS NOT NULL OR vec.id IS NOT NULL
        OR (coalesce(p_procedure_id, '') <> '' AND c.procedure_id = p_procedure_id))
    SELECT coalesce(json_agg(x ORDER BY x.score DESC, x.id), '[]'::json)
    FROM (SELECT * FROM ranked ORDER BY score DESC, id LIMIT v_limit) x);
END $$;

-- ===== Tạo vector cho chỉ mục (chỉ dịch vụ ai-gateway gọi, kèm WORKFLOW_TOKEN) =====
CREATE OR REPLACE FUNCTION api.ai_pending_chunks(p_model text, p_limit int DEFAULT 16) RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_workflow_call() THEN
    RAISE EXCEPTION 'Chỉ dịch vụ AI của lõi được gọi hàm này' USING ERRCODE = 'PT403';
  END IF;
  RETURN (SELECT coalesce(json_agg(json_build_object('id', id, 'hash', md5(content),
            'text', source_title || '. ' || content)), '[]'::json)
          FROM (SELECT id, source_title, content FROM citizen_knowledge_chunks
                WHERE embedding IS NULL OR embedding_hash IS DISTINCT FROM md5(content)
                   OR embedding_model IS DISTINCT FROM p_model
                ORDER BY id LIMIT least(greatest(coalesce(p_limit, 16), 1), 64)) p);
END $$;

-- p_items: [{"id": ..., "hash": md5 nội dung lúc tạo vector, "embedding": [1024 số]}].
-- Nội dung đã đổi sau khi tạo vector (mã băm khác) thì bỏ qua, lần quét sau làm lại.
CREATE OR REPLACE FUNCTION api.ai_store_embeddings(p_model text, p_items jsonb) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  IF NOT public.is_workflow_call() THEN
    RAISE EXCEPTION 'Chỉ dịch vụ AI của lõi được gọi hàm này' USING ERRCODE = 'PT403';
  END IF;
  UPDATE citizen_knowledge_chunks c
  SET embedding = (i ->> 'embedding')::vector(1024), embedding_model = p_model,
      embedding_hash = i ->> 'hash', embedded_at = now()
  FROM jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) i
  WHERE c.id = i ->> 'id' AND md5(c.content) = i ->> 'hash';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN json_build_object('stored', v_count);
END $$;

CREATE OR REPLACE FUNCTION api.ai_index_status(p_model text) RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_workflow_call() THEN
    RAISE EXCEPTION 'Chỉ dịch vụ AI của lõi được gọi hàm này' USING ERRCODE = 'PT403';
  END IF;
  RETURN (SELECT json_build_object('chunks', count(*),
    'embedded', count(*) FILTER (WHERE embedding IS NOT NULL AND embedding_hash = md5(content) AND embedding_model = p_model),
    'lastEmbeddedAt', max(embedded_at)) FROM citizen_knowledge_chunks);
END $$;

REVOKE ALL ON FUNCTION api.knowledge_search(text, text, text, int, real, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION api.ai_pending_chunks(text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION api.ai_store_embeddings(text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION api.ai_index_status(text) FROM PUBLIC;
-- ai-gateway gọi PostgREST không kèm token người dùng (vai trò web_anon), có WORKFLOW_TOKEN cho hàm nội bộ.
-- Chỉ cổng AI (vai trò web_anon trong mạng nội bộ) gọi; phạm vi xã và đối tượng do cổng AI đặt từ token đã ký.
GRANT EXECUTE ON FUNCTION api.knowledge_search(text, text, text, int, real, text, text) TO web_anon;
GRANT EXECUTE ON FUNCTION api.ai_pending_chunks(text, int), api.ai_store_embeddings(text, jsonb),
  api.ai_index_status(text) TO web_anon;

NOTIFY pgrst, 'reload schema';
