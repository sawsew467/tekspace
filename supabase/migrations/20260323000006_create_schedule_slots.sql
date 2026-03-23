-- Migration: Create schedule_slots and schedule_slot_changes tables
-- Time slots (UTC + duration) + Audit trail cho schedule edits

CREATE TABLE public.schedule_slots (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES public.users(id),
  week_id           uuid NOT NULL REFERENCES public.schedule_weeks(id) ON DELETE CASCADE,
  slot_date         date NOT NULL,        -- ngày của slot (theo timezone của tenant)
  start_time        timestamptz NOT NULL, -- UTC absolute
  duration_minutes  smallint NOT NULL CHECK (duration_minutes >= 30 AND duration_minutes <= 720),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_schedule_slots_tenant_id ON public.schedule_slots(tenant_id);
CREATE INDEX idx_schedule_slots_user_id   ON public.schedule_slots(user_id);
CREATE INDEX idx_schedule_slots_week_id   ON public.schedule_slots(week_id);

-- Enable RLS
ALTER TABLE public.schedule_slots ENABLE ROW LEVEL SECURITY;

-- updated_at trigger
CREATE TRIGGER set_schedule_slots_updated_at
  BEFORE UPDATE ON public.schedule_slots
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ================================================================
-- P-19: Validate slot_date khớp với date của start_time theo timezone tenant
-- ================================================================
CREATE OR REPLACE FUNCTION public.validate_slot_date()
RETURNS TRIGGER AS $$
DECLARE
  tenant_tz   text;
  expected_dt date;
BEGIN
  SELECT t.timezone INTO tenant_tz
  FROM public.tenants t
  WHERE t.id = NEW.tenant_id;

  expected_dt := (NEW.start_time AT TIME ZONE tenant_tz)::date;

  IF NEW.slot_date <> expected_dt THEN
    RAISE EXCEPTION
      'slot_date (%) không khớp với ngày của start_time (%) theo timezone % — expected %',
      NEW.slot_date, NEW.start_time, tenant_tz, expected_dt;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE TRIGGER validate_schedule_slot_date
  BEFORE INSERT OR UPDATE ON public.schedule_slots
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_slot_date();

-- ================================================================
-- P-20: Ngăn overlap slots của cùng user trong cùng ngày
-- ================================================================
CREATE OR REPLACE FUNCTION public.check_slot_overlap()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.schedule_slots s
    WHERE s.user_id    = NEW.user_id
      AND s.tenant_id  = NEW.tenant_id
      AND s.slot_date  = NEW.slot_date
      AND s.id        <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND (s.start_time, s.start_time + (s.duration_minutes || ' minutes')::interval)
            OVERLAPS
          (NEW.start_time, NEW.start_time + (NEW.duration_minutes || ' minutes')::interval)
  ) THEN
    RAISE EXCEPTION
      'Slot overlap: user % đã có slot chồng lấp vào ngày % lúc %',
      NEW.user_id, NEW.slot_date, NEW.start_time;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE TRIGGER check_schedule_slot_overlap
  BEFORE INSERT OR UPDATE ON public.schedule_slots
  FOR EACH ROW
  EXECUTE FUNCTION public.check_slot_overlap();

-- ================================================================
-- Audit trail: schedule_slot_changes (append-only)
-- ================================================================
CREATE TYPE public.slot_change_type AS ENUM ('created', 'updated', 'deleted', 'emergency_override');

CREATE TABLE public.schedule_slot_changes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- P-7: ON DELETE CASCADE — khi slot bị xóa, audit log đi theo
  -- (cascade chain tenant→weeks→slots→slot_changes hoạt động đầy đủ)
  slot_id     uuid NOT NULL REFERENCES public.schedule_slots(id) ON DELETE CASCADE,
  changed_by  uuid NOT NULL REFERENCES public.users(id),
  change_type public.slot_change_type NOT NULL,
  -- D-7: reason là optional cho 'created'; NOT NULL với '' vẫn bypass — để app tự validate
  reason      text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
  -- KHÔNG có updated_at — append-only, immutable
);

CREATE INDEX idx_schedule_slot_changes_slot_id    ON public.schedule_slot_changes(slot_id);
CREATE INDEX idx_schedule_slot_changes_changed_by ON public.schedule_slot_changes(changed_by);
CREATE INDEX idx_schedule_slot_changes_tenant_id  ON public.schedule_slot_changes(tenant_id);

-- Enable RLS
ALTER TABLE public.schedule_slot_changes ENABLE ROW LEVEL SECURITY;
