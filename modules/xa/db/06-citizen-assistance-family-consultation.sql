-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
-- Family workspace reuses APPROVED, procedure-scoped citizen_representations.
-- It never grants access to the represented person's own account or other cases.

-- Citizens may propose a consultation time; only staff-provisioned slots are
-- described as available, and creating a request never implies staff acceptance.
CREATE TABLE IF NOT EXISTS citizen_consultation_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  category text NOT NULL CHECK (length(btrim(category)) BETWEEN 2 AND 80),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  capacity smallint NOT NULL DEFAULT 1 CHECK (capacity BETWEEN 1 AND 20),
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS citizen_consultation_slots_list_idx
  ON citizen_consultation_slots(tenant_id, starts_at) WHERE is_published;
-- Slots are created/published only by a separately authorized staff service/DB owner.
ALTER TABLE citizen_consultation_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizen_consultation_slots FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS citizen_consultation_slots_visible ON citizen_consultation_slots;
CREATE POLICY citizen_consultation_slots_visible ON citizen_consultation_slots FOR SELECT
  USING (tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid AND is_published);

CREATE TABLE IF NOT EXISTS citizen_consultation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  citizen_id uuid NOT NULL REFERENCES citizens(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  category text NOT NULL CHECK (length(btrim(category)) BETWEEN 2 AND 80),
  subject text NOT NULL CHECK (length(btrim(subject)) BETWEEN 5 AND 150),
  description text NOT NULL CHECK (length(btrim(description)) BETWEEN 10 AND 2000),
  channel text NOT NULL CHECK(channel IN ('phone','online')),
  contact_phone text NOT NULL CHECK (length(btrim(contact_phone)) BETWEEN 9 AND 15),
  preferred_at timestamptz NOT NULL,
  slot_id uuid REFERENCES citizen_consultation_slots(id),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','declined','cancelled','completed')),
  -- This URL is written only by staff, never by the citizen app.
  meeting_url text,
  staff_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Staff-approved slots cannot be enumerated across tenants, even via this count helper.
CREATE OR REPLACE FUNCTION citizen_slot_remaining(p_slot uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
  SELECT greatest(0,s.capacity-(SELECT count(*)::integer FROM citizen_consultation_requests r
    WHERE r.slot_id=s.id AND r.status IN ('pending','confirmed')))
  FROM citizen_consultation_slots s
  WHERE s.id=p_slot AND s.is_published AND
    s.tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid;
$$;
REVOKE ALL ON FUNCTION citizen_slot_remaining(uuid) FROM PUBLIC;
CREATE INDEX IF NOT EXISTS citizen_consultation_requests_owner_idx
  ON citizen_consultation_requests(citizen_id,tenant_id,created_at DESC);
CREATE INDEX IF NOT EXISTS citizen_consultation_requests_slot_idx
  ON citizen_consultation_requests(slot_id,status);
ALTER TABLE citizen_consultation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizen_consultation_requests FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS citizen_consultation_requests_read ON citizen_consultation_requests;
CREATE POLICY citizen_consultation_requests_read ON citizen_consultation_requests FOR SELECT
  USING(citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid
    AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
DROP POLICY IF EXISTS citizen_consultation_requests_create ON citizen_consultation_requests;
CREATE POLICY citizen_consultation_requests_create ON citizen_consultation_requests FOR INSERT
  WITH CHECK(citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid
    AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
    AND status='pending' AND meeting_url IS NULL AND staff_note IS NULL);
-- Cancellation in a SECURITY DEFINER function; app role has NO general UPDATE permission.
CREATE OR REPLACE FUNCTION citizen_cancel_consultation(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_citizen uuid := nullif(current_setting('app.citizen_id',true),'')::uuid;
DECLARE v_tenant uuid := nullif(current_setting('app.tenant_id',true),'')::uuid;
BEGIN
  IF v_citizen IS NULL OR v_tenant IS NULL THEN RETURN false; END IF;
  UPDATE citizen_consultation_requests SET status='cancelled', updated_at=now()
  WHERE id=p_id AND citizen_id=v_citizen AND tenant_id=v_tenant
    AND status IN ('pending','confirmed') AND preferred_at>now();
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION citizen_cancel_consultation(uuid) FROM PUBLIC;

-- Whenever authorized staff changes consultation status, the citizen receives a notice.
-- The citizen web role has no permission to set confirmation, link or staff note.
CREATE OR REPLACE FUNCTION citizen_consultation_status_notice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('confirmed','declined','completed') THEN
   INSERT INTO citizen_notifications(citizen_id,tenant_id,category,title,body)
   VALUES(NEW.citizen_id,NEW.tenant_id,'consultation',
     CASE WHEN NEW.status='confirmed' THEN 'Lịch tư vấn đã được xác nhận'
          WHEN NEW.status='declined' THEN 'Lịch tư vấn chưa được chấp thuận'
          ELSE 'Phiên tư vấn đã hoàn thành' END,
     'Yêu cầu tư vấn "'||left(NEW.subject,80)||'" đã được cập nhật. Vào mục Đặt lịch tư vấn để xem thông tin.');
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS citizen_consultation_notify ON citizen_consultation_requests;
CREATE TRIGGER citizen_consultation_notify AFTER UPDATE OF status ON citizen_consultation_requests
 FOR EACH ROW EXECUTE FUNCTION citizen_consultation_status_notice();

CREATE TABLE IF NOT EXISTS citizen_stage_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id text NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  citizen_id uuid NOT NULL REFERENCES citizens(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  stage text NOT NULL CHECK(stage IN ('guidance','reception','supplement','result')),
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text NOT NULL DEFAULT '' CHECK(length(comment) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(application_id,citizen_id,stage)
);
CREATE INDEX IF NOT EXISTS citizen_stage_reviews_stage_idx ON citizen_stage_reviews(stage,created_at DESC);
ALTER TABLE citizen_stage_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizen_stage_reviews FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS citizen_stage_reviews_read ON citizen_stage_reviews;
CREATE POLICY citizen_stage_reviews_read ON citizen_stage_reviews FOR SELECT
  USING(citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid
    AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
    AND EXISTS(SELECT 1 FROM applications a WHERE a.id=application_id));
DROP POLICY IF EXISTS citizen_stage_reviews_insert ON citizen_stage_reviews;
CREATE POLICY citizen_stage_reviews_insert ON citizen_stage_reviews FOR INSERT
  WITH CHECK(citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid
    AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
    AND EXISTS(SELECT 1 FROM applications a WHERE a.id=application_id
      AND a.citizen_id=citizen_id AND a.tenant_id=tenant_id));
-- Aggregate without publishing identities. A staff-only service may query this view;
-- do not grant it to communeos_app or unauthenticated citizens.
CREATE OR REPLACE VIEW citizen_stage_review_summary AS
 SELECT tenant_id,stage,count(*)::integer AS responses,
  round(avg(rating)::numeric,2) AS average_rating,
  count(*) FILTER (WHERE rating <= 2)::integer AS low_ratings
 FROM citizen_stage_reviews GROUP BY tenant_id,stage;
REVOKE ALL ON citizen_stage_review_summary FROM PUBLIC;

-- Only DB owner/approved oversight service has access to aggregate ratings across users.
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='communeos_app') THEN
    GRANT SELECT ON citizen_consultation_slots TO communeos_app;
    GRANT EXECUTE ON FUNCTION citizen_slot_remaining(uuid) TO communeos_app;
    GRANT SELECT,INSERT ON citizen_consultation_requests TO communeos_app;
    GRANT EXECUTE ON FUNCTION citizen_cancel_consultation(uuid) TO communeos_app;
    GRANT SELECT,INSERT ON citizen_stage_reviews TO communeos_app;
  END IF;
END $$;
