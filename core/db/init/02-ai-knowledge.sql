-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
-- Citizen procedure RAG index. This is an additive, rerunnable migration.
-- Source of truth remains procedures, procedure_documents and citizen_faq.
-- No personal data or private applications are indexed.
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TABLE IF NOT EXISTS public.citizen_knowledge_chunks (
  id text PRIMARY KEY,
  source_type text NOT NULL CHECK (source_type IN ('procedure','faq')),
  procedure_id text REFERENCES public.procedures(id) ON DELETE CASCADE,
  source_id text NOT NULL,
  field text NOT NULL,
  source_title text NOT NULL,
  content text NOT NULL,
  search_vector tsvector NOT NULL DEFAULT ''::tsvector,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT citizen_knowledge_chunk_source_check CHECK (
    (source_type = 'procedure' AND procedure_id IS NOT NULL) OR
    (source_type = 'faq' AND procedure_id IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS citizen_knowledge_search_idx
  ON public.citizen_knowledge_chunks USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS citizen_knowledge_procedure_idx
  ON public.citizen_knowledge_chunks (procedure_id);

-- Match both accented and unaccented Vietnamese search phrases. Index is
-- maintained in the same transaction as the catalog update.
CREATE OR REPLACE FUNCTION public.communeos_rag_chunk_vector()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  NEW.search_vector := to_tsvector('simple', public.unaccent(NEW.source_title || ' ' || NEW.field || ' ' || NEW.content));
  NEW.updated_at := now();
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS citizen_knowledge_vector_trigger ON public.citizen_knowledge_chunks;
CREATE TRIGGER citizen_knowledge_vector_trigger
  BEFORE INSERT OR UPDATE ON public.citizen_knowledge_chunks
  FOR EACH ROW EXECUTE FUNCTION public.communeos_rag_chunk_vector();

CREATE OR REPLACE FUNCTION public.communeos_rag_refresh_procedure(p_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  DELETE FROM public.citizen_knowledge_chunks WHERE procedure_id = p_id;
  INSERT INTO public.citizen_knowledge_chunks
    (id,source_type,procedure_id,source_id,field,source_title,content)
  SELECT 'procedure:' || p.id || ':' || field_data.field,
    'procedure', p.id, p.id, field_data.field, p.title, field_data.content
  FROM public.procedures p
  CROSS JOIN LATERAL (VALUES
    ('title', p.title),
    ('category', p.category),
    ('summary', p.summary),
    ('instructions', p.instructions),
    ('fee', p.fee_note),
    ('duration', p.sla_days::text || ' ngày (thời hạn minh họa)')
  ) AS field_data(field,content)
  WHERE p.id=p_id AND p.published=true AND nullif(btrim(field_data.content),'') IS NOT NULL;

  INSERT INTO public.citizen_knowledge_chunks
    (id,source_type,procedure_id,source_id,field,source_title,content)
  SELECT 'procedure:' || d.procedure_id || ':document:' || d.document_code,
    'procedure', p.id, p.id, 'documents', p.title,
    d.document_name || CASE WHEN d.is_required THEN ' (bắt buộc theo dữ liệu hệ thống)' ELSE ' (không bắt buộc)' END
  FROM public.procedure_documents d
  JOIN public.procedures p ON p.id=d.procedure_id
  WHERE p.id=p_id AND p.published=true;
END; $$;

CREATE OR REPLACE FUNCTION public.communeos_rag_procedure_changed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.communeos_rag_refresh_procedure(OLD.id);
    RETURN OLD;
  END IF;
  PERFORM public.communeos_rag_refresh_procedure(NEW.id);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS citizen_rag_procedure_changed ON public.procedures;
CREATE TRIGGER citizen_rag_procedure_changed
  AFTER INSERT OR UPDATE OR DELETE ON public.procedures
  FOR EACH ROW EXECUTE FUNCTION public.communeos_rag_procedure_changed();

CREATE OR REPLACE FUNCTION public.communeos_rag_document_changed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    PERFORM public.communeos_rag_refresh_procedure(OLD.procedure_id);
  END IF;
  IF TG_OP IN ('UPDATE','INSERT') AND (TG_OP = 'INSERT' OR NEW.procedure_id IS DISTINCT FROM OLD.procedure_id) THEN
    PERFORM public.communeos_rag_refresh_procedure(NEW.procedure_id);
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS citizen_rag_document_changed ON public.procedure_documents;
CREATE TRIGGER citizen_rag_document_changed
  AFTER INSERT OR UPDATE OR DELETE ON public.procedure_documents
  FOR EACH ROW EXECUTE FUNCTION public.communeos_rag_document_changed();

CREATE OR REPLACE FUNCTION public.communeos_rag_faq_changed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    DELETE FROM public.citizen_knowledge_chunks WHERE id='faq:' || OLD.id::text;
  END IF;
  IF TG_OP IN ('UPDATE','INSERT') THEN
    INSERT INTO public.citizen_knowledge_chunks
      (id,source_type,procedure_id,source_id,field,source_title,content)
    VALUES ('faq:' || NEW.id::text,'faq',NULL,NEW.id::text,'faq',NEW.question,
      NEW.question || ' ' || NEW.keywords || ': ' || NEW.answer)
    ON CONFLICT (id) DO UPDATE SET source_title=EXCLUDED.source_title,content=EXCLUDED.content;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS citizen_rag_faq_changed ON public.citizen_faq;
CREATE TRIGGER citizen_rag_faq_changed
  AFTER INSERT OR UPDATE OR DELETE ON public.citizen_faq
  FOR EACH ROW EXECUTE FUNCTION public.communeos_rag_faq_changed();

-- Backfill on first install and repair; no persistent copies can remain stale.
DO $$ DECLARE procedure_row record; faq_row record;
BEGIN
  FOR procedure_row IN SELECT id FROM public.procedures LOOP
    PERFORM public.communeos_rag_refresh_procedure(procedure_row.id);
  END LOOP;
  FOR faq_row IN SELECT id,question,keywords,answer FROM public.citizen_faq LOOP
    INSERT INTO public.citizen_knowledge_chunks
      (id,source_type,source_id,field,source_title,content)
    VALUES ('faq:' || faq_row.id::text,'faq',faq_row.id::text,'faq',faq_row.question,
      faq_row.question || ' ' || faq_row.keywords || ': ' || faq_row.answer)
    ON CONFLICT (id) DO UPDATE SET source_title=EXCLUDED.source_title,content=EXCLUDED.content;
  END LOOP;
  DELETE FROM public.citizen_knowledge_chunks c
    WHERE c.source_type='faq' AND NOT EXISTS
      (SELECT 1 FROM public.citizen_faq f WHERE f.id::text=c.source_id);
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='communeos_app') THEN
    -- Never grant INSERT, UPDATE or DELETE on the knowledge index to the web app.
    GRANT SELECT ON TABLE public.citizen_knowledge_chunks TO communeos_app;
    GRANT USAGE ON SCHEMA public TO communeos_app;
  END IF;
END $$;

-- SECURITY DEFINER maintenance functions are private to DBA-owned triggers.
REVOKE EXECUTE ON FUNCTION public.communeos_rag_refresh_procedure(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.communeos_rag_procedure_changed() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.communeos_rag_document_changed() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.communeos_rag_faq_changed() FROM PUBLIC;
