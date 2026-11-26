-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
--
-- Gói nghiệp vụ xã: mỗi sự kiện của hồ sơ (nộp, chuyển xử lý, bổ sung, hoàn thành, từ chối...) tự ghi một dòng
-- vào sổ ghi nhận của lõi (core/db/init/05-so-ghi-nhan.sql, public.ledger_record), chuỗi theo xã tiếp nhận.
-- Chạy lại nhiều lần không lỗi.

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

NOTIFY pgrst, 'reload schema';
