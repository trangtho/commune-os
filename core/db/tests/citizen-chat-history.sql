-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
-- Integration test with RLS enforced as the application role. All changes rollback.
BEGIN;
SET LOCAL ROLE communeos_app;
DO $$
DECLARE
  a uuid := '20000000-0000-4000-8000-000000000001';
  b uuid := '20000000-0000-4000-8000-000000000002';
  tenant_a uuid := '10000000-0000-4000-8000-000000000001';
  tenant_b uuid := '10000000-0000-4000-8000-000000000002';
  thread uuid := '30000000-0000-4000-8000-000000000123';
BEGIN
  PERFORM set_config('app.citizen_id',a::text,true);
  PERFORM set_config('app.tenant_id',tenant_a::text,true);
  INSERT INTO citizen_ai_conversations(id,citizen_id,tenant_id,title)
    VALUES(thread,a,tenant_a,'Kiểm tra phân quyền hội thoại');
  INSERT INTO citizen_ai_messages(conversation_id,citizen_id,tenant_id,role,content)
    VALUES(thread,a,tenant_a,'citizen','Đăng ký khai sinh cần giấy tờ gì?');
  INSERT INTO citizen_ai_messages(conversation_id,citizen_id,tenant_id,role,content,mode)
    VALUES(thread,a,tenant_a,'assistant','Cần đối chiếu giấy tờ được công bố.','DATA');
  IF (SELECT count(*) FROM citizen_ai_messages WHERE conversation_id=thread) != 2 THEN
    RAISE EXCEPTION 'Không thể đọc 2 tin nhắn của chủ tài khoản';
  END IF;

  -- Changing just the tenant must not expose the citizen's messages.
  PERFORM set_config('app.tenant_id',tenant_b::text,true);
  IF EXISTS (SELECT 1 FROM citizen_ai_conversations WHERE id=thread) THEN
    RAISE EXCEPTION 'RLS: cùng citizen_id nhưng khác tenant vẫn thấy hội thoại';
  END IF;
  PERFORM set_config('app.citizen_id',b::text,true);
  IF EXISTS (SELECT 1 FROM citizen_ai_conversations WHERE id=thread) OR
     EXISTS (SELECT 1 FROM citizen_ai_messages WHERE conversation_id=thread) THEN
    RAISE EXCEPTION 'RLS: tài khoản khác nhìn thấy lịch sử của công dân A';
  END IF;
  DELETE FROM citizen_ai_conversations WHERE id=thread;
  IF FOUND THEN RAISE EXCEPTION 'RLS: tài khoản B xóa được hội thoại của A'; END IF;

  -- An attacker cannot insert a message into someone else's conversation.
  BEGIN
    INSERT INTO citizen_ai_messages(conversation_id,citizen_id,tenant_id,role,content)
      VALUES(thread,b,tenant_b,'citizen','Tin nhắn không có quyền');
    RAISE EXCEPTION 'RLS: chèn tin nhắn vào hội thoại của A thành công';
  EXCEPTION WHEN foreign_key_violation OR insufficient_privilege OR check_violation THEN
    NULL;
  END;

  PERFORM set_config('app.citizen_id',a::text,true);
  PERFORM set_config('app.tenant_id',tenant_a::text,true);
  DELETE FROM citizen_ai_conversations WHERE id=thread;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chủ tài khoản không thể xóa hội thoại'; END IF;
  IF EXISTS (SELECT 1 FROM citizen_ai_messages WHERE conversation_id=thread) THEN
    RAISE EXCEPTION 'Xóa hội thoại không cascade xóa các tin nhắn';
  END IF;
END $$;
ROLLBACK;
SELECT 'Citizen chat history RLS test passed (all changes rolled back)' AS result;
