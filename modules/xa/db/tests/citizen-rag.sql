-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
-- Transactional integration test: NO permanent data changes.
\set ON_ERROR_STOP on
BEGIN;
DO $$ DECLARE before_fee text; after_fee text; BEGIN
  SELECT content INTO before_fee FROM citizen_knowledge_chunks
    WHERE id='procedure:khai-sinh:fee';
  IF before_fee IS NULL THEN RAISE EXCEPTION 'index not initialized'; END IF;
  UPDATE procedures SET fee_note='RAG_SYNC_TEST_' || clock_timestamp()::text WHERE id='khai-sinh';
  SELECT content INTO after_fee FROM citizen_knowledge_chunks
    WHERE id='procedure:khai-sinh:fee';
  IF after_fee = before_fee OR after_fee NOT LIKE 'RAG_SYNC_TEST_%' THEN
    RAISE EXCEPTION 'fee change was not indexed transactionally';
  END IF;
  UPDATE procedures SET published=false WHERE id='khai-sinh';
  IF EXISTS (SELECT 1 FROM citizen_knowledge_chunks WHERE procedure_id='khai-sinh') THEN
    RAISE EXCEPTION 'unpublished procedure still indexed';
  END IF;
  UPDATE procedures SET published=true WHERE id='khai-sinh';
  IF NOT EXISTS (SELECT 1 FROM citizen_knowledge_chunks WHERE procedure_id='khai-sinh') THEN
    RAISE EXCEPTION 're-published procedure not indexed';
  END IF;
  INSERT INTO procedure_documents(procedure_id,document_code,document_name,is_required)
    VALUES ('khai-sinh','rag-test-document','RAG document test',true);
  IF NOT EXISTS (SELECT 1 FROM citizen_knowledge_chunks WHERE id='procedure:khai-sinh:document:rag-test-document') THEN
    RAISE EXCEPTION 'document insert missing from index';
  END IF;
  DELETE FROM procedure_documents WHERE procedure_id='khai-sinh' AND document_code='rag-test-document';
  IF EXISTS (SELECT 1 FROM citizen_knowledge_chunks WHERE id='procedure:khai-sinh:document:rag-test-document') THEN
    RAISE EXCEPTION 'deleted document remains in index';
  END IF;
  UPDATE citizen_faq SET answer='RAG FAQ test' WHERE id=1;
  IF NOT EXISTS (SELECT 1 FROM citizen_knowledge_chunks WHERE id='faq:1' AND content LIKE '%RAG FAQ test%') THEN
    RAISE EXCEPTION 'FAQ change not indexed';
  END IF;
END $$;
ROLLBACK;
SELECT 'RAG trigger tests passed (all changes rolled back)' AS result;
