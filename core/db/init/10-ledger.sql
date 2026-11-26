-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
--
-- Sổ ghi nhận không sửa được (hash-chain), thành phần dùng chung của lõi.
-- Mỗi đơn vị (xã, công ty...) một chuỗi. Gói nghiệp vụ ghi sổ qua public.ledger_record; gói nghiệp vụ xã
-- tự ghi mỗi sự kiện của hồ sơ (nộp, chuyển xử lý, bổ sung, hoàn thành, từ chối...).
-- Mỗi dòng chứa mã băm của dòng liền trước trong cùng xã, nên sửa hoặc xóa
-- một dòng bất kỳ sẽ làm gãy chuỗi và bị phát hiện khi kiểm tra.
--
--   hash = sha256( prev_hash | seq | mã xã | mã hồ sơ | hành động | người làm | băm ghi chú | thời điểm )
--
-- Sổ chỉ lưu MÃ BĂM của ghi chú, không lưu nội dung, để không giữ dữ liệu cá nhân vĩnh viễn.
-- Chạy lại nhiều lần không lỗi.

CREATE TABLE IF NOT EXISTS ledger_entries (
  seq        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id  uuid NOT NULL REFERENCES tenants(id),
  event_id   bigint UNIQUE,              -- application_events.id; mỗi sự kiện ghi sổ đúng 1 lần
  dossier_id text NOT NULL,
  action     text NOT NULL,
  actor      text NOT NULL,
  note_hash  text NOT NULL,
  created_at timestamptz NOT NULL,
  prev_hash  text NOT NULL,
  hash       text NOT NULL
);
CREATE INDEX IF NOT EXISTS ledger_tenant_seq_idx ON ledger_entries (tenant_id, seq);

-- Công thức băm, dùng chung cho lúc ghi và lúc kiểm tra.
CREATE OR REPLACE FUNCTION public.ledger_hash(
  prev_hash text, seq bigint, tenant_id uuid, dossier_id text,
  action text, actor text, note_hash text, created_at timestamptz
) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT encode(sha256(convert_to(concat_ws('|',
    prev_hash, seq::text, tenant_id::text, dossier_id, action, actor, note_hash,
    to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
  ), 'UTF8')), 'hex')
$$;

-- Ghi 1 dòng sổ cho một đơn vị (hàm dùng chung của lõi, mọi gói nghiệp vụ gọi được từ hàm SECURITY DEFINER của mình).
-- p_ref: mã đối tượng (mã hồ sơ, mã đơn...), nên có tiền tố riêng cho từng gói để không trùng.
-- p_event_id: chỉ sự kiện hồ sơ dùng (mỗi sự kiện ghi sổ đúng 1 lần); gói khác để NULL.
CREATE OR REPLACE FUNCTION public.ledger_record(
  p_tenant uuid, p_ref text, p_action text, p_actor text,
  p_note text, p_created_at timestamptz, p_event_id bigint DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prev   text;
  v_seq    bigint;
  v_note   text := encode(sha256(convert_to(coalesce(p_note, ''), 'UTF8')), 'hex');
BEGIN
  IF p_tenant IS NULL OR coalesce(p_ref, '') = '' OR coalesce(p_action, '') = '' THEN
    RAISE EXCEPTION 'Ghi sổ cần đơn vị, mã đối tượng và hành động' USING ERRCODE = '22023';
  END IF;
  -- Mỗi đơn vị một chuỗi; khóa theo đơn vị để 2 giao dịch không cùng nối vào 1 dòng.
  PERFORM pg_advisory_xact_lock(hashtext('ledger:' || p_tenant::text));
  SELECT l.hash INTO v_prev FROM ledger_entries l
   WHERE l.tenant_id = p_tenant ORDER BY l.seq DESC LIMIT 1;
  v_prev := coalesce(v_prev, repeat('0', 64));
  v_seq := nextval(pg_get_serial_sequence('ledger_entries', 'seq'));
  INSERT INTO ledger_entries (seq, tenant_id, event_id, dossier_id, action, actor,
                              note_hash, created_at, prev_hash, hash)
  OVERRIDING SYSTEM VALUE
  VALUES (v_seq, p_tenant, p_event_id, p_ref, p_action, coalesce(p_actor, ''), v_note, p_created_at,
          v_prev, public.ledger_hash(v_prev, v_seq, p_tenant, p_ref, p_action,
                                     coalesce(p_actor, ''), v_note, p_created_at));
END $$;
REVOKE ALL ON FUNCTION public.ledger_record(uuid, text, text, text, text, timestamptz, bigint) FROM PUBLIC;

-- Ghi 1 dòng sổ cho 1 sự kiện hồ sơ (gói nghiệp vụ xã).
CREATE OR REPLACE FUNCTION public.ledger_append(
  p_event_id bigint, p_dossier_id text, p_action text, p_actor text,
  p_note text, p_created_at timestamptz
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant uuid;
BEGIN
  SELECT coalesce(a.receiving_tenant_id, a.tenant_id) INTO v_tenant
    FROM applications a WHERE a.id = p_dossier_id;
  IF v_tenant IS NULL OR EXISTS (SELECT 1 FROM ledger_entries WHERE event_id = p_event_id) THEN
    RETURN;
  END IF;
  PERFORM public.ledger_record(v_tenant, p_dossier_id, p_action, p_actor, p_note, p_created_at, p_event_id);
END $$;

-- Tự ghi sổ mỗi khi có sự kiện hồ sơ mới (từ Kênh người dân lẫn cán bộ).
CREATE OR REPLACE FUNCTION public.ledger_on_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.ledger_append(NEW.id, NEW.application_id, NEW.event_type,
                               NEW.actor_name, NEW.note, NEW.created_at);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ledger_on_event ON application_events;
CREATE TRIGGER ledger_on_event AFTER INSERT ON application_events
  FOR EACH ROW EXECUTE FUNCTION public.ledger_on_event();

-- Không ai được sửa hay xóa dòng sổ qua SQL thông thường.
CREATE OR REPLACE FUNCTION public.ledger_block_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Sổ ghi nhận không cho phép sửa hoặc xóa' USING ERRCODE = '42501';
END $$;
DROP TRIGGER IF EXISTS ledger_no_update ON ledger_entries;
CREATE TRIGGER ledger_no_update BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.ledger_block_change();
DROP TRIGGER IF EXISTS ledger_no_truncate ON ledger_entries;
CREATE TRIGGER ledger_no_truncate BEFORE TRUNCATE ON ledger_entries
  FOR EACH STATEMENT EXECUTE FUNCTION public.ledger_block_change();
REVOKE ALL ON ledger_entries FROM PUBLIC;

-- Ghi sổ cho các sự kiện đã có từ trước (dữ liệu mẫu), theo thứ tự thời gian.
DO $$
DECLARE e record;
BEGIN
  FOR e IN SELECT ev.* FROM application_events ev
            WHERE NOT EXISTS (SELECT 1 FROM ledger_entries l WHERE l.event_id = ev.id)
            ORDER BY ev.created_at, ev.id
  LOOP
    PERFORM public.ledger_append(e.id, e.application_id, e.event_type, e.actor_name, e.note, e.created_at);
  END LOOP;
END $$;

-- ===== API =====
-- Xem sổ: quản trị hệ thống thấy mọi xã, cán bộ chỉ thấy xã mình.
DROP VIEW IF EXISTS api.ledger;
CREATE VIEW api.ledger AS
SELECT l.seq, t.code AS tenant_code, l.dossier_id, l.action, l.actor,
       l.created_at, l.prev_hash, l.hash
FROM ledger_entries l JOIN tenants t ON t.id = l.tenant_id
WHERE public.is_sys_admin() OR t.code = public.current_tenant_code();

-- Kiểm tra chuỗi: tính lại từng mã băm và so với sổ.
-- Gọi: POST /rest/rpc/verify_ledger  {}  hoặc {"only_tenant":"xa-a"}
CREATE OR REPLACE FUNCTION api.verify_ledger(only_tenant text DEFAULT NULL)
RETURNS TABLE (tenant_code text, entries bigint, ok boolean, broken_seq bigint, reason text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t record; r record; v_prev text; v_n bigint; v_bad bigint; v_why text;
BEGIN
  FOR t IN SELECT x.id, x.code FROM tenants x
            WHERE (public.is_sys_admin() OR x.code = public.current_tenant_code())
              AND (only_tenant IS NULL OR x.code = only_tenant)
            ORDER BY x.code
  LOOP
    v_prev := repeat('0', 64); v_n := 0; v_bad := NULL; v_why := NULL;
    FOR r IN SELECT * FROM ledger_entries l WHERE l.tenant_id = t.id ORDER BY l.seq LOOP
      v_n := v_n + 1;
      IF r.prev_hash <> v_prev THEN
        v_bad := r.seq; v_why := 'Thiếu hoặc sai dòng liền trước'; EXIT;
      END IF;
      IF r.hash <> public.ledger_hash(r.prev_hash, r.seq, r.tenant_id, r.dossier_id,
                                      r.action, r.actor, r.note_hash, r.created_at) THEN
        v_bad := r.seq; v_why := 'Nội dung dòng đã bị sửa'; EXIT;
      END IF;
      v_prev := r.hash;
    END LOOP;
    tenant_code := t.code; entries := v_n; ok := v_bad IS NULL;
    broken_seq := v_bad; reason := v_why;
    RETURN NEXT;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION api.verify_ledger(text) FROM PUBLIC;

DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'commune-app') THEN
    GRANT SELECT ON api.ledger TO "commune-app";
    GRANT EXECUTE ON FUNCTION api.verify_ledger(text) TO "commune-app";
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';