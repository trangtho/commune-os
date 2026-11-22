-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
--
-- Kiểm thử API luồng chính của công dân (core/db/init/21-citizen-api-core-flow.sql) dưới vai trò
-- "citizen-app", như khi gọi qua cổng /rest. Mọi thay đổi bị ROLLBACK. Chạy: make citizen-api-test
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL ROLE "citizen-app";
SELECT set_config('app.citizen_id', '20000000-0000-4000-8000-000000000001', true),
       set_config('app.tenant_id', '10000000-0000-4000-8000-000000000001', true) \gset

DO $$
DECLARE v json; v_id text; v_upd timestamptz; v_err text;
  v_proc text := (SELECT p.id FROM procedures p
    WHERE p.published AND public.procedure_enabled_for('10000000-0000-4000-8000-000000000001', p.id)
      AND EXISTS (SELECT 1 FROM procedure_documents d WHERE d.procedure_id = p.id AND d.is_required)
    ORDER BY p.id LIMIT 1);
BEGIN
  -- Tạo bản nháp đúng người kê khai.
  v := api.citizen_application_create(v_proc, 'Nguyễn Văn An (mẫu)', '0900000000', 'kiểm thử', '{}'::jsonb);
  v_id := v ->> 'id';
  IF v ->> 'status' <> 'draft' THEN RAISE EXCEPTION 'LỖI: tạo bản nháp trả %', v; END IF;
  RAISE NOTICE 'ĐẠT  Tạo bản nháp % cho thủ tục %', v_id, v_proc;

  -- Sai họ tên người kê khai: 422.
  BEGIN
    PERFORM api.citizen_application_create(v_proc, 'Người Khác', '', '', '{}'::jsonb);
    RAISE EXCEPTION 'LỖI: tạo hồ sơ cho người khác không bị chặn';
  EXCEPTION WHEN SQLSTATE 'PT422' THEN RAISE NOTICE 'ĐẠT  Kê khai thay người khác khi chưa có đại diện bị chặn (422)';
  END;

  -- Thời điểm sửa không khớp (bản nháp đã đổi sau khi kiểm tra): 409.
  v_upd := (api.citizen_application_draft(v_id) ->> 'updated_at')::timestamptz;
  BEGIN
    PERFORM api.citizen_application_submit(v_id, v_upd - interval '1 second');
    RAISE EXCEPTION 'LỖI: nộp bản nháp đã thay đổi không bị chặn';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN RAISE NOTICE 'ĐẠT  Nộp bản nháp đã thay đổi sau khi kiểm tra bị chặn (409)';
  END;

  -- Poka-yoke: thiếu giấy tờ bắt buộc thì không nộp được.
  BEGIN
    PERFORM api.citizen_application_submit(v_id, v_upd);
    RAISE EXCEPTION 'LỖI: nộp hồ sơ thiếu giấy tờ không bị chặn';
  EXCEPTION WHEN SQLSTATE 'PT422' THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    RAISE NOTICE 'ĐẠT  Thiếu giấy tờ bắt buộc thì không nộp được (422: %)', v_err;
  END;

  -- Đủ giấy tờ bắt buộc thì nộp được, trạng thái chuyển sang submitted, có sự kiện và thông báo.
  PERFORM api.citizen_document_add(v_id, d.document_code, 'kiem-thu.pdf',
    gen_random_uuid()::text || '.pdf', 'application/pdf', 100, repeat('a', 64))
  FROM procedure_documents d WHERE d.procedure_id = v_proc AND d.is_required;
  v_upd := (api.citizen_application_draft(v_id) ->> 'updated_at')::timestamptz;
  v := api.citizen_application_submit(v_id, v_upd);
  IF v ->> 'status' <> 'submitted'
     OR NOT EXISTS (SELECT 1 FROM application_events WHERE application_id = v_id AND event_type = 'submitted')
     OR NOT EXISTS (SELECT 1 FROM citizen_notifications WHERE application_id = v_id) THEN
    RAISE EXCEPTION 'LỖI: nộp hồ sơ đủ giấy tờ trả %', v;
  END IF;
  RAISE NOTICE 'ĐẠT  Đủ giấy tờ thì nộp được, có sự kiện và thông báo';

  -- Hồ sơ đã nộp: không sửa, không xóa giấy tờ.
  BEGIN
    PERFORM api.citizen_application_autosave(v_id, '{}'::jsonb, 0);
    RAISE EXCEPTION 'LỖI: sửa hồ sơ đã nộp không bị chặn';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN RAISE NOTICE 'ĐẠT  Không sửa được hồ sơ đã nộp (409)';
  END;
  BEGIN
    PERFORM api.citizen_document_remove(v_id, (SELECT id FROM application_documents WHERE application_id = v_id LIMIT 1));
    RAISE EXCEPTION 'LỖI: xóa giấy tờ của hồ sơ đã nộp không bị chặn';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN RAISE NOTICE 'ĐẠT  Không xóa được giấy tờ của hồ sơ đã nộp (409)';
  END;

  -- Công dân khác không thấy hồ sơ này.
  PERFORM set_config('app.citizen_id', '20000000-0000-4000-8000-000000000002', true),
          set_config('app.tenant_id', '10000000-0000-4000-8000-000000000002', true);
  BEGIN
    PERFORM api.citizen_application(v_id);
    RAISE EXCEPTION 'LỖI: công dân khác đọc được hồ sơ';
  EXCEPTION WHEN SQLSTATE 'PT404' THEN RAISE NOTICE 'ĐẠT  Công dân khác không đọc được hồ sơ (404)';
  END;
END $$;

ROLLBACK;
\echo 'KẾT QUẢ: ĐẠT (đã ROLLBACK, không thay đổi dữ liệu)'
