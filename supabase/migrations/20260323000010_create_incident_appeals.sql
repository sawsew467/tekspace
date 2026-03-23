-- Migration: Create incident_appeals table
-- Appeal responses (append-only)

CREATE TABLE public.incident_appeals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- P-25: RESTRICT explicit — không xóa incident khi còn appeal
  incident_id uuid NOT NULL REFERENCES public.incidents(id) ON DELETE RESTRICT,
  member_id   uuid NOT NULL REFERENCES public.users(id),
  response    text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- KHÔNG có updated_at — immutable
  UNIQUE (incident_id, member_id)  -- chỉ 1 appeal per incident per member
);

CREATE INDEX idx_incident_appeals_incident_id ON public.incident_appeals(incident_id);

-- Enable RLS
ALTER TABLE public.incident_appeals ENABLE ROW LEVEL SECURITY;
