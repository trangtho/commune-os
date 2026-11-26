-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
--
-- Quản lý nhân viên trong xã (dữ liệu nghiệp vụ; tài khoản đăng nhập vẫn nằm ở Keycloak, xem core/accounts).
--   * Hồ sơ cá nhân của cán bộ: thông tin công vụ + giấy tờ. Cán bộ đề nghị thay đổi, lãnh đạo phê duyệt.
--     Mã cán bộ, ngày vào làm chỉ lãnh đạo sửa; lãnh đạo tự sửa hồ sơ của mình không cần duyệt.
--   * Yêu cầu gửi lãnh đạo: sửa hồ sơ, thêm/bỏ giấy tờ, trình duyệt kết quả hồ sơ của dân, yêu cầu khác.
--   * Giao việc: lãnh đạo giao việc cho cán bộ, cán bộ cập nhật tiến độ.
--   * Phân công hồ sơ và giám sát khối lượng công việc.
--   * Hai cấp duyệt: cán bộ xử lý (officer) muốn hoàn thành hoặc từ chối hồ sơ của dân thì phải có
--     đề nghị đã được lãnh đạo duyệt. Lãnh đạo (leader) tự hoàn thành được.
-- Mọi thao tác đi qua hàm SECURITY DEFINER, kiểm tra xã và vai trò từ token. Không bảng nào lộ trực tiếp.
-- Cán bộ được nhận diện bằng `sub` của token Keycloak. Chạy lại nhiều lần không sao. Chạy sau 11-workflow.sql.

-- Hàm đọc token (jwt_claims, current_staff_id, has_role, require_staff, require_leader...) thuộc lõi
-- (core/db/init/02-don-vi.sql).

-- ===== 1. Bảng =====
CREATE TABLE IF NOT EXISTS staff_profiles (
  staff_id     text PRIMARY KEY,                 -- sub của Keycloak
  tenant_code  text NOT NULL,
  full_name    text NOT NULL CHECK (length(btrim(full_name)) BETWEEN 2 AND 120),
  position     text,                             -- chức vụ
  department   text,                             -- bộ phận
  phone        text CHECK (phone IS NULL OR phone ~ '^[0-9+ .-]{8,20}$'),
  work_email   text CHECK (work_email IS NULL OR work_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  address      text CHECK (address IS NULL OR length(address) <= 300),
  birth_date   date,
  active       boolean NOT NULL DEFAULT true,     -- false = đã nghỉ việc (giữ lại để tra cứu)
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   text
);

CREATE TABLE IF NOT EXISTS staff_documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id     text NOT NULL,
  tenant_code  text NOT NULL,
  doc_type     text NOT NULL CHECK (doc_type IN ('so-yeu-ly-lich', 'bang-cap', 'chung-chi', 'quyet-dinh', 'khac')),
  title        text NOT NULL CHECK (length(btrim(title)) BETWEEN 2 AND 160),
  storage_key  text NOT NULL UNIQUE CHECK (storage_key ~ '^[0-9a-f-]{36}\.(pdf|png|jpg)$'),
  mime_type    text NOT NULL CHECK (mime_type IN ('application/pdf', 'image/png', 'image/jpeg')),
  size_bytes   integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 5242880),
  sha256       text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected', 'removed')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staff_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_code   text NOT NULL,
  staff_id      text NOT NULL,
  staff_name    text NOT NULL,
  kind          text NOT NULL CHECK (kind IN ('profile_update', 'document_add', 'document_remove', 'dossier_approval', 'other')),
  payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  document_id   uuid REFERENCES staff_documents(id),
  dossier_id    text REFERENCES applications(id),
  note          text CHECK (note IS NULL OR length(note) <= 1000),
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'used')),
  decided_by    text,
  decided_note  text CHECK (decided_note IS NULL OR length(decided_note) <= 1000),
  created_at    timestamptz NOT NULL DEFAULT now(),
  decided_at    timestamptz
);
CREATE INDEX IF NOT EXISTS staff_requests_tenant_status ON staff_requests (tenant_code, status);

CREATE TABLE IF NOT EXISTS staff_tasks (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_code    text NOT NULL,
  assignee_id    text NOT NULL,
  assignee_name  text NOT NULL,
  title          text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 160),
  description    text CHECK (description IS NULL OR length(description) <= 2000),
  dossier_id     text REFERENCES applications(id),
  due_date       date,
  status         text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'done', 'cancelled')),
  result_note    text CHECK (result_note IS NULL OR length(result_note) <= 1000),
  created_by     text NOT NULL,
  created_by_name text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS staff_tasks_tenant_assignee ON staff_tasks (tenant_code, assignee_id);

-- Phân công hồ sơ của dân cho một cán bộ.
ALTER TABLE applications ADD COLUMN IF NOT EXISTS assigned_staff_id text;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS assigned_staff_name text;

-- Thông tin công vụ thêm (chạy lại an toàn trên cơ sở dữ liệu đã có bảng).
-- Cố ý KHÔNG lưu số CCCD, dân tộc, tôn giáo...: chỉ giữ thông tin cần cho công việc (tối thiểu hóa dữ liệu cá nhân).
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS gender text CHECK (gender IS NULL OR gender IN ('nam', 'nu', 'khac'));
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS staff_code text CHECK (staff_code IS NULL OR length(staff_code) <= 30);
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS education text CHECK (education IS NULL OR length(education) <= 200);
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS duties text CHECK (duties IS NULL OR length(duties) <= 500);

REVOKE ALL ON staff_profiles, staff_documents, staff_requests, staff_tasks FROM PUBLIC;

-- ===== 2. Hai cấp duyệt khi trả kết quả hồ sơ của dân =====
-- Khi một cán bộ (có token, không phải lãnh đạo) đổi hồ sơ sang completed/rejected, phải có
-- đề nghị dossier_approval đã duyệt, đúng kết quả đề nghị, chưa dùng. Dùng xong thì đánh dấu 'used'.
CREATE OR REPLACE FUNCTION public.check_dossier_approval() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_req uuid;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.status NOT IN ('completed', 'rejected')
     OR public.current_tenant_code() IS NULL OR public.has_role('leader') THEN
    RETURN NEW;
  END IF;
  SELECT r.id INTO v_req FROM staff_requests r
   WHERE r.dossier_id = NEW.id AND r.kind = 'dossier_approval' AND r.status = 'approved'
     AND r.payload ->> 'proposal' = NEW.status
   ORDER BY r.decided_at DESC LIMIT 1;
  IF v_req IS NULL THEN
    RAISE EXCEPTION 'Hồ sơ cần lãnh đạo duyệt trước khi trả kết quả. Vui lòng gửi đề nghị duyệt.'
      USING ERRCODE = '23514';
  END IF;
  UPDATE staff_requests SET status = 'used' WHERE id = v_req;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS check_dossier_approval ON applications;
CREATE TRIGGER check_dossier_approval BEFORE UPDATE OF status ON applications
  FOR EACH ROW EXECUTE FUNCTION public.check_dossier_approval();

-- ===== 3. View (đã lọc theo người gọi) =====
-- Của tôi: mọi cán bộ.
DROP VIEW IF EXISTS api.my_profile;
CREATE VIEW api.my_profile AS
SELECT staff_id, tenant_code, full_name, gender, birth_date, staff_code, position, department, duties, start_date,
       education, phone, work_email, address, active, updated_at
FROM staff_profiles WHERE staff_id = public.current_staff_id() AND tenant_code = public.current_tenant_code();

DROP VIEW IF EXISTS api.my_documents;
CREATE VIEW api.my_documents AS
SELECT id, doc_type, title, mime_type, size_bytes, sha256, status, created_at
FROM staff_documents WHERE staff_id = public.current_staff_id() AND tenant_code = public.current_tenant_code()
  AND status <> 'removed';

DROP VIEW IF EXISTS api.my_requests;
CREATE VIEW api.my_requests AS
SELECT id, kind, payload, document_id, dossier_id, note, status, decided_by, decided_note, created_at, decided_at
FROM staff_requests WHERE staff_id = public.current_staff_id() AND tenant_code = public.current_tenant_code();

DROP VIEW IF EXISTS api.my_tasks;
CREATE VIEW api.my_tasks AS
SELECT id, title, description, dossier_id, due_date, status, result_note, created_by_name, created_at, updated_at,
       (status IN ('todo', 'doing') AND due_date < CURRENT_DATE) AS overdue
FROM staff_tasks WHERE assignee_id = public.current_staff_id() AND tenant_code = public.current_tenant_code()
  AND status <> 'cancelled';

-- Của cả xã: chỉ lãnh đạo (view trả rỗng với người khác).
DROP VIEW IF EXISTS api.staff_profiles;
CREATE VIEW api.staff_profiles AS
SELECT staff_id, full_name, gender, birth_date, staff_code, position, department, duties, start_date,
       education, phone, work_email, address, active, updated_at
FROM staff_profiles WHERE public.has_role('leader') AND tenant_code = public.current_tenant_code();

DROP VIEW IF EXISTS api.staff_documents;
CREATE VIEW api.staff_documents AS
SELECT d.id, d.staff_id, p.full_name, d.doc_type, d.title, d.mime_type, d.size_bytes, d.sha256, d.status, d.created_at
FROM staff_documents d LEFT JOIN staff_profiles p ON p.staff_id = d.staff_id
WHERE public.has_role('leader') AND d.tenant_code = public.current_tenant_code() AND d.status <> 'removed';

DROP VIEW IF EXISTS api.staff_requests;
CREATE VIEW api.staff_requests AS
SELECT r.id, r.staff_id, r.staff_name, r.kind, r.payload, r.document_id, r.dossier_id, r.note, r.status,
       r.decided_by, r.decided_note, r.created_at, r.decided_at,
       d.title AS document_title, a.procedure_id AS dossier_procedure
FROM staff_requests r
LEFT JOIN staff_documents d ON d.id = r.document_id
LEFT JOIN applications a ON a.id = r.dossier_id
WHERE public.has_role('leader') AND r.tenant_code = public.current_tenant_code();

DROP VIEW IF EXISTS api.staff_tasks;
CREATE VIEW api.staff_tasks AS
SELECT id, assignee_id, assignee_name, title, description, dossier_id, due_date, status, result_note,
       created_by_name, created_at, updated_at,
       (status IN ('todo', 'doing') AND due_date < CURRENT_DATE) AS overdue
FROM staff_tasks WHERE public.has_role('leader') AND tenant_code = public.current_tenant_code();

-- Giám sát: mỗi cán bộ có bao nhiêu việc và hồ sơ đang mở, bao nhiêu quá hạn.
DROP VIEW IF EXISTS api.staff_workload;
CREATE VIEW api.staff_workload AS
WITH t AS (SELECT id FROM tenants WHERE code = public.current_tenant_code()),
people AS (
  SELECT assignee_id AS staff_id, assignee_name AS staff_name FROM staff_tasks WHERE tenant_code = public.current_tenant_code()
  UNION SELECT a.assigned_staff_id, a.assigned_staff_name FROM applications a, t
   WHERE coalesce(a.receiving_tenant_id, a.tenant_id) = t.id AND a.assigned_staff_id IS NOT NULL
  UNION SELECT staff_id, full_name FROM staff_profiles WHERE tenant_code = public.current_tenant_code() AND active
)
SELECT p.staff_id, max(p.staff_name) AS staff_name,
  (SELECT count(*) FROM staff_tasks s WHERE s.assignee_id = p.staff_id AND s.tenant_code = public.current_tenant_code()
     AND s.status IN ('todo', 'doing')) AS open_tasks,
  (SELECT count(*) FROM staff_tasks s WHERE s.assignee_id = p.staff_id AND s.tenant_code = public.current_tenant_code()
     AND s.status IN ('todo', 'doing') AND s.due_date < CURRENT_DATE) AS overdue_tasks,
  (SELECT count(*) FROM applications a, t WHERE a.assigned_staff_id = p.staff_id
     AND coalesce(a.receiving_tenant_id, a.tenant_id) = t.id
     AND a.status IN ('submitted', 'processing', 'supplement')) AS open_dossiers,
  (SELECT count(*) FROM applications a, t WHERE a.assigned_staff_id = p.staff_id
     AND coalesce(a.receiving_tenant_id, a.tenant_id) = t.id
     AND a.status IN ('submitted', 'processing', 'supplement') AND a.due_at < CURRENT_DATE) AS overdue_dossiers,
  (SELECT count(*) FROM staff_requests r WHERE r.staff_id = p.staff_id AND r.tenant_code = public.current_tenant_code()
     AND r.status = 'pending') AS pending_requests
FROM people p
WHERE public.has_role('leader') AND p.staff_id IS NOT NULL
GROUP BY p.staff_id;

-- Hồ sơ của dân kèm người được phân công (cho cả cán bộ, theo RLS hiện có của applications).
DROP VIEW IF EXISTS api.dossier_assignments;
CREATE VIEW api.dossier_assignments WITH (security_invoker = true) AS
SELECT a.id AS dossier_id, a.assigned_staff_id, a.assigned_staff_name
FROM applications a WHERE a.status <> 'draft';

-- ===== 4. Hàm cho cán bộ =====
-- Đề nghị sửa hồ sơ cá nhân. Chỉ nhận các trường cho phép; trường để trống là không đổi.
CREATE OR REPLACE FUNCTION api.request_profile_update(changes jsonb, note text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text := public.require_staff(); v_clean jsonb; v_id uuid;
BEGIN
  SELECT coalesce(jsonb_object_agg(key, value), '{}'::jsonb) INTO v_clean
    FROM jsonb_each(coalesce(changes, '{}'::jsonb))
   WHERE key IN ('full_name', 'gender', 'birth_date', 'position', 'department', 'duties', 'education',
                   'phone', 'work_email', 'address')
     AND jsonb_typeof(value) = 'string';
  IF v_clean = '{}'::jsonb THEN
    RAISE EXCEPTION 'Không có thông tin nào cần thay đổi' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM staff_requests WHERE staff_id = public.current_staff_id()
              AND kind = 'profile_update' AND status = 'pending') THEN
    RAISE EXCEPTION 'Bạn đã có một đề nghị sửa hồ sơ đang chờ duyệt' USING ERRCODE = 'PT409';
  END IF;
  INSERT INTO staff_requests (tenant_code, staff_id, staff_name, kind, payload, note)
  VALUES (v_code, public.current_staff_id(), public.current_staff_name(), 'profile_update', v_clean, left(note, 1000))
  RETURNING id INTO v_id;
  RETURN json_build_object('id', v_id, 'status', 'pending');
END $$;

-- Thêm giấy tờ (tệp đã lưu ở kho đối tượng của lõi). Giấy tờ ở trạng thái chờ duyệt.
CREATE OR REPLACE FUNCTION api.request_document_add(doc_type text, title text, storage_key text,
  mime_type text, size_bytes integer, sha256 text, note text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text := public.require_staff(); v_doc uuid; v_id uuid;
BEGIN
  INSERT INTO staff_documents (staff_id, tenant_code, doc_type, title, storage_key, mime_type, size_bytes, sha256)
  VALUES (public.current_staff_id(), v_code, doc_type, btrim(title), storage_key, mime_type, size_bytes, sha256)
  RETURNING id INTO v_doc;
  INSERT INTO staff_requests (tenant_code, staff_id, staff_name, kind, document_id, note)
  VALUES (v_code, public.current_staff_id(), public.current_staff_name(), 'document_add', v_doc, left(note, 1000))
  RETURNING id INTO v_id;
  RETURN json_build_object('id', v_id, 'document_id', v_doc, 'status', 'pending');
END $$;

CREATE OR REPLACE FUNCTION api.request_document_remove(document_id uuid, note text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text := public.require_staff(); v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM staff_documents d WHERE d.id = request_document_remove.document_id
                  AND d.staff_id = public.current_staff_id() AND d.status = 'active') THEN
    RAISE EXCEPTION 'Không tìm thấy giấy tờ đang dùng của bạn' USING ERRCODE = 'PT404';
  END IF;
  INSERT INTO staff_requests (tenant_code, staff_id, staff_name, kind, document_id, note)
  VALUES (v_code, public.current_staff_id(), public.current_staff_name(), 'document_remove',
          request_document_remove.document_id, left(note, 1000))
  RETURNING id INTO v_id;
  RETURN json_build_object('id', v_id, 'status', 'pending');
END $$;

-- Trình lãnh đạo duyệt kết quả một hồ sơ của dân (hoàn thành hoặc từ chối).
CREATE OR REPLACE FUNCTION api.request_dossier_approval(dossier_id text, proposal text, note text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text := public.require_staff(); v_id uuid;
BEGIN
  IF proposal NOT IN ('completed', 'rejected') THEN
    RAISE EXCEPTION 'Đề nghị phải là hoàn thành hoặc từ chối' USING ERRCODE = '22023';
  END IF;
  IF length(btrim(coalesce(note, ''))) < 5 THEN
    RAISE EXCEPTION 'Vui lòng ghi tóm tắt kết quả xử lý (ít nhất 5 ký tự)' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM applications a JOIN tenants t ON t.id = coalesce(a.receiving_tenant_id, a.tenant_id)
                  WHERE a.id = request_dossier_approval.dossier_id AND t.code = v_code
                    AND a.status IN ('processing', 'supplement')) THEN
    RAISE EXCEPTION 'Hồ sơ không tồn tại hoặc chưa ở bước xử lý' USING ERRCODE = 'PT404';
  END IF;
  IF EXISTS (SELECT 1 FROM staff_requests r WHERE r.dossier_id = request_dossier_approval.dossier_id
              AND r.kind = 'dossier_approval' AND r.status = 'pending') THEN
    RAISE EXCEPTION 'Hồ sơ này đã có đề nghị đang chờ lãnh đạo duyệt' USING ERRCODE = 'PT409';
  END IF;
  INSERT INTO staff_requests (tenant_code, staff_id, staff_name, kind, payload, dossier_id, note)
  VALUES (v_code, public.current_staff_id(), public.current_staff_name(), 'dossier_approval',
          jsonb_build_object('proposal', proposal), request_dossier_approval.dossier_id, left(note, 1000))
  RETURNING id INTO v_id;
  RETURN json_build_object('id', v_id, 'status', 'pending');
END $$;

CREATE OR REPLACE FUNCTION api.request_other(note text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text := public.require_staff(); v_id uuid;
BEGIN
  IF length(btrim(coalesce(note, ''))) < 5 THEN
    RAISE EXCEPTION 'Vui lòng ghi nội dung yêu cầu (ít nhất 5 ký tự)' USING ERRCODE = '22023';
  END IF;
  INSERT INTO staff_requests (tenant_code, staff_id, staff_name, kind, note)
  VALUES (v_code, public.current_staff_id(), public.current_staff_name(), 'other', left(note, 1000))
  RETURNING id INTO v_id;
  RETURN json_build_object('id', v_id, 'status', 'pending');
END $$;

CREATE OR REPLACE FUNCTION api.cancel_my_request(request_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_doc uuid;
BEGIN
  PERFORM public.require_staff();
  UPDATE staff_requests SET status = 'cancelled', decided_at = now()
   WHERE id = request_id AND staff_id = public.current_staff_id() AND status = 'pending'
  RETURNING CASE WHEN kind = 'document_add' THEN document_id END INTO v_doc;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy yêu cầu đang chờ của bạn' USING ERRCODE = 'PT404';
  END IF;
  IF v_doc IS NOT NULL THEN UPDATE staff_documents SET status = 'removed' WHERE id = v_doc; END IF;
  RETURN json_build_object('id', request_id, 'status', 'cancelled');
END $$;

-- Cán bộ cập nhật tiến độ việc được giao.
CREATE OR REPLACE FUNCTION api.update_my_task(task_id uuid, status text, result_note text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.require_staff();
  IF update_my_task.status NOT IN ('todo', 'doing', 'done') THEN
    RAISE EXCEPTION 'Trạng thái không hợp lệ' USING ERRCODE = '22023';
  END IF;
  UPDATE staff_tasks t SET status = update_my_task.status, updated_at = now(),
         result_note = coalesce(left(update_my_task.result_note, 1000), t.result_note)
   WHERE t.id = task_id AND t.assignee_id = public.current_staff_id() AND t.status <> 'cancelled';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy việc được giao cho bạn' USING ERRCODE = 'PT404';
  END IF;
  RETURN json_build_object('id', task_id, 'status', update_my_task.status);
END $$;

-- ===== 5. Hàm cho lãnh đạo =====
CREATE OR REPLACE FUNCTION api.decide_staff_request(request_id uuid, approve boolean, note text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text := public.require_leader(); r staff_requests%ROWTYPE; p jsonb;
BEGIN
  SELECT * INTO r FROM staff_requests WHERE id = request_id AND tenant_code = v_code FOR UPDATE;
  IF r.id IS NULL OR r.status <> 'pending' THEN
    RAISE EXCEPTION 'Không tìm thấy yêu cầu đang chờ duyệt' USING ERRCODE = 'PT404';
  END IF;
  IF r.staff_id = public.current_staff_id() THEN
    RAISE EXCEPTION 'Không tự duyệt yêu cầu của chính mình' USING ERRCODE = '42501';
  END IF;
  IF NOT approve AND length(btrim(coalesce(decide_staff_request.note, ''))) < 5 THEN
    RAISE EXCEPTION 'Vui lòng ghi lý do không duyệt' USING ERRCODE = '22023';
  END IF;

  IF approve THEN
    IF r.kind = 'profile_update' THEN
      p := r.payload;
      INSERT INTO staff_profiles (staff_id, tenant_code, full_name, updated_by)
      VALUES (r.staff_id, v_code, coalesce(p ->> 'full_name', r.staff_name), public.current_staff_name())
      ON CONFLICT ON CONSTRAINT staff_profiles_pkey DO NOTHING;
      UPDATE staff_profiles SET
        full_name  = coalesce(nullif(p ->> 'full_name', ''), full_name),
        position   = CASE WHEN p ? 'position'   THEN nullif(p ->> 'position', '')   ELSE position END,
        department = CASE WHEN p ? 'department' THEN nullif(p ->> 'department', '') ELSE department END,
        phone      = CASE WHEN p ? 'phone'      THEN nullif(p ->> 'phone', '')      ELSE phone END,
        work_email = CASE WHEN p ? 'work_email' THEN nullif(p ->> 'work_email', '') ELSE work_email END,
        address    = CASE WHEN p ? 'address'    THEN nullif(p ->> 'address', '')    ELSE address END,
        birth_date = CASE WHEN p ? 'birth_date' THEN nullif(p ->> 'birth_date', '')::date ELSE birth_date END,
        gender     = CASE WHEN p ? 'gender'     THEN nullif(p ->> 'gender', '')     ELSE gender END,
        duties     = CASE WHEN p ? 'duties'     THEN nullif(p ->> 'duties', '')     ELSE duties END,
        education  = CASE WHEN p ? 'education'  THEN nullif(p ->> 'education', '')  ELSE education END,
        updated_at = now(), updated_by = public.current_staff_name()
      WHERE staff_id = r.staff_id;
    ELSIF r.kind = 'document_add' THEN
      UPDATE staff_documents SET status = 'active' WHERE id = r.document_id;
    ELSIF r.kind = 'document_remove' THEN
      UPDATE staff_documents SET status = 'removed' WHERE id = r.document_id;
    END IF;
  ELSIF r.kind = 'document_add' THEN
    UPDATE staff_documents SET status = 'rejected' WHERE id = r.document_id;
  END IF;

  UPDATE staff_requests SET status = CASE WHEN approve THEN 'approved' ELSE 'rejected' END,
         decided_by = public.current_staff_name(), decided_note = left(decide_staff_request.note, 1000), decided_at = now()
   WHERE id = r.id;
  IF r.kind = 'dossier_approval' THEN
    INSERT INTO application_events (application_id, event_type, note, actor_name)
    VALUES (r.dossier_id, 'leader_decision',
            format('Lãnh đạo %s đề nghị %s%s', CASE WHEN approve THEN 'đồng ý' ELSE 'không đồng ý' END,
                   CASE r.payload ->> 'proposal' WHEN 'completed' THEN 'hoàn thành' ELSE 'từ chối' END,
                   CASE WHEN decide_staff_request.note IS NOT NULL THEN ': ' || decide_staff_request.note ELSE '' END),
            public.current_staff_name());
  END IF;
  RETURN json_build_object('id', r.id, 'status', CASE WHEN approve THEN 'approved' ELSE 'rejected' END);
END $$;

-- Lãnh đạo sửa thẳng hồ sơ của một cán bộ (không cần duyệt), hoặc đánh dấu đã nghỉ việc.
CREATE OR REPLACE FUNCTION api.leader_save_staff_profile(staff_id text, data jsonb)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text := public.require_leader(); v_owner text;
BEGIN
  SELECT tenant_code INTO v_owner FROM staff_profiles s WHERE s.staff_id = leader_save_staff_profile.staff_id;
  IF v_owner IS NOT NULL AND v_owner <> v_code THEN
    RAISE EXCEPTION 'Không tìm thấy cán bộ' USING ERRCODE = 'PT404';
  END IF;
  INSERT INTO staff_profiles (staff_id, tenant_code, full_name, position, department, phone, work_email,
                              address, birth_date, gender, staff_code, start_date, education, duties, active, updated_by)
  VALUES (leader_save_staff_profile.staff_id, v_code, coalesce(nullif(data ->> 'full_name', ''), 'Chưa có tên'),
          nullif(data ->> 'position', ''), nullif(data ->> 'department', ''), nullif(data ->> 'phone', ''),
          nullif(data ->> 'work_email', ''), nullif(data ->> 'address', ''),
          nullif(data ->> 'birth_date', '')::date, nullif(data ->> 'gender', ''), nullif(data ->> 'staff_code', ''),
          nullif(data ->> 'start_date', '')::date, nullif(data ->> 'education', ''), nullif(data ->> 'duties', ''),
          coalesce((data ->> 'active')::boolean, true),
          public.current_staff_name())
  ON CONFLICT ON CONSTRAINT staff_profiles_pkey DO UPDATE SET
    full_name = EXCLUDED.full_name, position = EXCLUDED.position, department = EXCLUDED.department,
    phone = EXCLUDED.phone, work_email = EXCLUDED.work_email, address = EXCLUDED.address,
    birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender, staff_code = EXCLUDED.staff_code,
    start_date = EXCLUDED.start_date, education = EXCLUDED.education, duties = EXCLUDED.duties, active = EXCLUDED.active, updated_at = now(), updated_by = EXCLUDED.updated_by;
  RETURN json_build_object('staff_id', leader_save_staff_profile.staff_id, 'saved', true);
END $$;

CREATE OR REPLACE FUNCTION api.create_staff_task(assignee_id text, assignee_name text, title text,
  description text DEFAULT NULL, due_date date DEFAULT NULL, dossier_id text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text := public.require_leader(); v_id uuid;
BEGIN
  IF create_staff_task.dossier_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM applications a JOIN tenants t ON t.id = coalesce(a.receiving_tenant_id, a.tenant_id)
        WHERE a.id = create_staff_task.dossier_id AND t.code = v_code) THEN
    RAISE EXCEPTION 'Hồ sơ không thuộc xã của bạn' USING ERRCODE = 'PT404';
  END IF;
  INSERT INTO staff_tasks (tenant_code, assignee_id, assignee_name, title, description, dossier_id, due_date,
                           created_by, created_by_name)
  VALUES (v_code, create_staff_task.assignee_id, btrim(create_staff_task.assignee_name), btrim(create_staff_task.title),
          create_staff_task.description, create_staff_task.dossier_id, create_staff_task.due_date,
          public.current_staff_id(), public.current_staff_name())
  RETURNING id INTO v_id;
  RETURN json_build_object('id', v_id, 'status', 'todo');
END $$;

CREATE OR REPLACE FUNCTION api.cancel_staff_task(task_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text := public.require_leader();
BEGIN
  UPDATE staff_tasks SET status = 'cancelled', updated_at = now()
   WHERE id = task_id AND tenant_code = v_code AND status IN ('todo', 'doing');
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy việc đang mở' USING ERRCODE = 'PT404'; END IF;
  RETURN json_build_object('id', task_id, 'status', 'cancelled');
END $$;

-- Phân công hồ sơ của dân cho một cán bộ; ghi vào nhật ký hồ sơ (và sổ ghi nhận).
CREATE OR REPLACE FUNCTION api.assign_dossier(dossier_id text, staff_id text, staff_name text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text := public.require_leader();
BEGIN
  UPDATE applications a SET assigned_staff_id = assign_dossier.staff_id,
         assigned_staff_name = btrim(assign_dossier.staff_name), updated_at = now()
    FROM tenants t
   WHERE a.id = assign_dossier.dossier_id AND t.id = coalesce(a.receiving_tenant_id, a.tenant_id)
     AND t.code = v_code AND a.status IN ('submitted', 'processing', 'supplement');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hồ sơ không thuộc xã của bạn hoặc đã kết thúc' USING ERRCODE = 'PT404';
  END IF;
  INSERT INTO application_events (application_id, event_type, note, actor_name)
  VALUES (assign_dossier.dossier_id, 'assigned', 'Phân công cho ' || btrim(assign_dossier.staff_name),
          public.current_staff_name());
  RETURN json_build_object('dossier_id', assign_dossier.dossier_id, 'assigned_to', assign_dossier.staff_name);
END $$;

-- Tệp giấy tờ: trả khóa đối tượng nếu người gọi là chủ giấy tờ hoặc lãnh đạo cùng xã.
CREATE OR REPLACE FUNCTION api.staff_document_object(document_id uuid)
RETURNS TABLE (storage_key text, title text, mime_type text, sha256 text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text := public.require_staff();
BEGIN
  RETURN QUERY SELECT d.storage_key, d.title, d.mime_type, d.sha256 FROM staff_documents d
   WHERE d.id = document_id AND d.tenant_code = v_code AND d.status <> 'removed'
     AND (d.staff_id = public.current_staff_id() OR public.has_role('leader'));
END $$;

-- ===== 6. Quyền =====
REVOKE ALL ON FUNCTION api.request_profile_update(jsonb, text), api.request_document_add(text, text, text, text, integer, text, text),
  api.request_document_remove(uuid, text), api.request_dossier_approval(text, text, text), api.request_other(text),
  api.cancel_my_request(uuid), api.update_my_task(uuid, text, text), api.decide_staff_request(uuid, boolean, text),
  api.leader_save_staff_profile(text, jsonb), api.create_staff_task(text, text, text, text, date, text),
  api.cancel_staff_task(uuid), api.assign_dossier(text, text, text), api.staff_document_object(uuid) FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'commune-app') THEN
    GRANT SELECT ON api.my_profile, api.my_documents, api.my_requests, api.my_tasks, api.staff_profiles,
      api.staff_documents, api.staff_requests, api.staff_tasks, api.staff_workload, api.dossier_assignments
      TO "commune-app";
    GRANT EXECUTE ON FUNCTION api.request_profile_update(jsonb, text),
      api.request_document_add(text, text, text, text, integer, text, text), api.request_document_remove(uuid, text),
      api.request_dossier_approval(text, text, text), api.request_other(text), api.cancel_my_request(uuid),
      api.update_my_task(uuid, text, text), api.decide_staff_request(uuid, boolean, text),
      api.leader_save_staff_profile(text, jsonb), api.create_staff_task(text, text, text, text, date, text),
      api.cancel_staff_task(uuid), api.assign_dossier(text, text, text), api.staff_document_object(uuid)
      TO "commune-app";
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
