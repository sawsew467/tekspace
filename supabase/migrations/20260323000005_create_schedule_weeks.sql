-- Migration: Create schedule_weeks table
-- Weekly tracking + deadline

CREATE TABLE public.schedule_weeks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- P-18: week_of phải là thứ Hai (ISO Monday = DOW 1)
  week_of     date NOT NULL CONSTRAINT schedule_weeks_monday CHECK (EXTRACT(DOW FROM week_of) = 1),  -- Monday of the week (ISO)
  deadline    timestamptz NOT NULL,
  is_locked   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, week_of)
);

CREATE INDEX idx_schedule_weeks_tenant_id ON public.schedule_weeks(tenant_id);

-- Enable RLS
ALTER TABLE public.schedule_weeks ENABLE ROW LEVEL SECURITY;
