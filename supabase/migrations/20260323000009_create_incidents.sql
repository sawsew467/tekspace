-- Migration: Create incidents table
-- Incident logging (append-only, immutable)

CREATE TYPE public.incident_category AS ENUM (
  'late_schedule', 'missed_report', 'low_commitment', 'policy_violation'
);

CREATE TABLE public.incidents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  member_id   uuid NOT NULL REFERENCES public.users(id),
  manager_id  uuid NOT NULL REFERENCES public.users(id),
  category    public.incident_category NOT NULL,
  note        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- P-8: manager không thể file incident chống chính mình
  CONSTRAINT incidents_no_self_report CHECK (member_id <> manager_id)
  -- KHÔNG có updated_at — immutable, không bao giờ UPDATE hay DELETE
);

CREATE INDEX idx_incidents_tenant_id  ON public.incidents(tenant_id);
CREATE INDEX idx_incidents_member_id  ON public.incidents(member_id);
CREATE INDEX idx_incidents_manager_id ON public.incidents(manager_id);

-- Enable RLS
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
