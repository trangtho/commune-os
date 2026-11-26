-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
--
-- Ví dụ gói nghiệp vụ doanh nghiệp chạy trên cùng lõi CommuneOS: đơn nghỉ phép.
-- Không sửa bảng nào của lõi hay của gói nghiệp vụ xã; chỉ dùng phần dùng chung của lõi:
--   * đơn vị (tenants) và token Keycloak: tenant_id = mã đơn vị, vai trò leader (giám đốc), officer (nhân viên);
--   * public.require_staff(), public.require_leader(), public.current_staff_id(), public.current_staff_name();
--   * public.is_workflow_call(): chỉ dịch vụ điều phối (/workflow) được đổi trạng thái đơn;
--   * public.ledger_record(): ghi sổ ghi nhận không sửa được, chuỗi riêng của từng đơn vị.
-- Dữ liệu nằm trong schema riêng "nghi_phep"; API (PostgREST) là các bảng ảo, hàm trong schema "api".
-- Nạp: make example-enterprise (chạy lại nhiều lần không lỗi).

SET client_min_messages = warning;

CREATE SCHEMA IF NOT EXISTS nghi_phep;
REVOKE ALL ON SCHEMA nghi_phep FROM PUBLIC;

CREATE TABLE IF NOT EXISTS nghi_phep.don (
  id           text PRIMARY KEY CHECK (id ~ '^NP-[0-9]{8}-[0-9A-F]{6}$'),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id),
  staff_id     text NOT NULL,                       -- sub của Keycloak
  staff_name   text NOT NULL,
  from_date    date NOT NULL,
  to_date      date NOT NULL,
  reason       text NOT NULL CHECK (length(btrim(reason)) BETWEEN 3 AND 500),
  status       text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved', 'rejected')),
  decided_by   text,
  decided_note text CHECK (decided_note IS NULL OR length(decided_note) <= 500),
  created_at   timestamptz NOT NULL DEFAULT now(),
  decided_at   timestamptz,
  CHECK (to_date >= from_date AND to_date - from_date < 60)
);
CREATE INDEX IF NOT EXISTS don_tenant_status ON nghi_phep.don (tenant_id, status);

-- Cách ly ở cơ sở dữ liệu: chỉ thấy đơn của đơn vị mình (đơn vị đang hoạt động);
-- nhân viên chỉ thấy đơn của chính mình, giám đốc thấy mọi đơn của đơn vị.
ALTER TABLE nghi_phep.don ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS don_doc ON nghi_phep.don;
CREATE POLICY don_doc ON nghi_phep.don FOR SELECT
  USING (tenant_id = (SELECT t.id FROM public.tenants t
                      WHERE t.code = public.current_tenant_code() AND t.status = 'active')
         AND (public.has_role('leader') OR staff_id = public.current_staff_id()));

DROP VIEW IF EXISTS api.leave_requests;
CREATE VIEW api.leave_requests WITH (security_invoker = true) AS
SELECT d.id, t.code AS tenant_code, d.staff_name, d.from_date, d.to_date,
       (d.to_date - d.from_date + 1) AS days, d.reason, d.status, d.decided_by, d.decided_note,
       d.created_at, d.decided_at
FROM nghi_phep.don d JOIN public.tenants t ON t.id = d.tenant_id;

-- Nhân viên (hoặc giám đốc) nộp đơn. Trả về đơn vừa tạo.
CREATE OR REPLACE FUNCTION api.leave_request_create(from_date date, to_date date, reason text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code   text := public.require_staff();
  v_tenant uuid := (SELECT id FROM tenants WHERE code = v_code);
  v_id     text := 'NP-' || to_char(now(), 'YYYYMMDD') || '-' || upper(encode(gen_random_bytes(3), 'hex'));
  v_row    nghi_phep.don;
BEGIN
  IF from_date IS NULL OR to_date IS NULL OR to_date < from_date OR to_date - from_date >= 60 THEN
    RAISE EXCEPTION 'Ngày nghỉ không hợp lệ (đến ngày phải sau từ ngày, tối đa 60 ngày)' USING ERRCODE = '22023';
  END IF;
  IF length(btrim(coalesce(reason, ''))) NOT BETWEEN 3 AND 500 THEN
    RAISE EXCEPTION 'Lý do nghỉ từ 3 đến 500 ký tự' USING ERRCODE = '22023';
  END IF;
  INSERT INTO nghi_phep.don (id, tenant_id, staff_id, staff_name, from_date, to_date, reason)
  VALUES (v_id, v_tenant, public.current_staff_id(), public.current_staff_name(), from_date, to_date, btrim(reason))
  RETURNING * INTO v_row;
  PERFORM public.ledger_record(v_tenant, v_id, 'submitted', v_row.staff_name, v_row.reason, v_row.created_at);
  RETURN json_build_object('id', v_row.id, 'status', v_row.status, 'from_date', v_row.from_date, 'to_date', v_row.to_date);
END $$;

-- Giám đốc duyệt hoặc không duyệt. Chỉ dịch vụ điều phối gọi được (POST /workflow/leave-requests/<mã>/actions),
-- nên mọi bước đều đi qua sơ đồ BPMN duyet-nghi-phep.
CREATE OR REPLACE FUNCTION api.set_leave_request_status(request_id text, status text, note text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code     text;
  v_row      nghi_phep.don;
  v_note     text := nullif(btrim(coalesce(note, '')), '');
  v_expected text := nullif(current_setting('request.headers', true), '')::json ->> 'x-workflow-expected-status';
  v_actor    text := public.current_staff_name();
BEGIN
  IF NOT public.is_workflow_call() THEN
    RAISE EXCEPTION 'Duyệt đơn phải đi qua động cơ quy trình (/workflow)' USING ERRCODE = '42501';
  END IF;
  v_code := public.require_leader();
  SELECT d.* INTO v_row FROM nghi_phep.don d JOIN tenants t ON t.id = d.tenant_id
   WHERE d.id = request_id AND t.code = v_code FOR UPDATE OF d;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy đơn %', request_id USING ERRCODE = 'P0002';
  END IF;
  IF v_expected IS NOT NULL AND v_expected <> v_row.status THEN
    RAISE EXCEPTION 'Trạng thái đơn đã thay đổi; vui lòng tải lại' USING ERRCODE = 'PT409';
  END IF;
  IF v_row.status <> 'submitted' THEN
    RAISE EXCEPTION 'Đơn đã được xử lý' USING ERRCODE = 'PT409';
  END IF;
  IF status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Trạng thái không hợp lệ: %', status USING ERRCODE = '22023';
  END IF;
  IF status = 'rejected' AND v_note IS NULL THEN
    RAISE EXCEPTION 'Không đồng ý thì phải ghi lý do' USING ERRCODE = '22023';
  END IF;
  IF v_row.staff_id = public.current_staff_id() THEN
    RAISE EXCEPTION 'Không tự duyệt đơn của chính mình' USING ERRCODE = '42501';
  END IF;
  UPDATE nghi_phep.don d SET status = set_leave_request_status.status, decided_by = v_actor,
         decided_note = v_note, decided_at = now()
   WHERE d.id = v_row.id RETURNING * INTO v_row;
  PERFORM public.ledger_record(v_row.tenant_id, v_row.id, v_row.status, v_actor, v_note, v_row.decided_at);
  RETURN json_build_object('id', v_row.id, 'status', v_row.status, 'decided_by', v_row.decided_by);
END $$;

COMMENT ON VIEW api.leave_requests IS
  'Ví dụ doanh nghiệp: đơn nghỉ phép. Nhân viên thấy đơn của mình, giám đốc thấy mọi đơn của đơn vị (RLS).';
COMMENT ON FUNCTION api.leave_request_create(date, date, text) IS
  'Ví dụ doanh nghiệp: nộp đơn nghỉ phép (from_date, to_date, reason). Duyệt qua POST /workflow/leave-requests/<mã>/actions.';
COMMENT ON FUNCTION api.set_leave_request_status(text, text, text) IS
  'Ví dụ doanh nghiệp: đổi trạng thái đơn; chỉ dịch vụ điều phối gọi được, người gọi phải là giám đốc (leader).';

REVOKE ALL ON FUNCTION api.leave_request_create(date, date, text),
  api.set_leave_request_status(text, text, text) FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'commune-app') THEN
    GRANT USAGE ON SCHEMA nghi_phep TO "commune-app";
    GRANT SELECT ON nghi_phep.don TO "commune-app";
    GRANT SELECT ON api.leave_requests TO "commune-app";
    GRANT EXECUTE ON FUNCTION api.leave_request_create(date, date, text),
      api.set_leave_request_status(text, text, text) TO "commune-app";
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
