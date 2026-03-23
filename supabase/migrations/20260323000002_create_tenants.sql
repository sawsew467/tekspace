-- Migration: Create tenants table
-- Team workspace (không có tenant_id — IS the tenant)

CREATE TABLE public.tenants (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                        text NOT NULL,
  timezone                    text NOT NULL DEFAULT 'Asia/Ho_Chi_Minh'
                                   CONSTRAINT tenants_timezone_valid CHECK (public.is_valid_timezone(timezone)),
  schedule_deadline_day       smallint NOT NULL DEFAULT 0   -- 0=Sunday
                                   CONSTRAINT tenants_deadline_day_valid CHECK (schedule_deadline_day BETWEEN 0 AND 6),
  schedule_deadline_hour      smallint NOT NULL DEFAULT 23  -- 23:59
                                   CONSTRAINT tenants_deadline_hour_valid CHECK (schedule_deadline_hour BETWEEN 0 AND 23),
  daily_report_deadline_hour  smallint NOT NULL DEFAULT 3   -- 03:00 next day
                                   CONSTRAINT tenants_report_hour_valid CHECK (daily_report_deadline_hour BETWEEN 0 AND 23),
  default_committed_hours     smallint NOT NULL DEFAULT 40
                                   CONSTRAINT tenants_committed_hours_valid CHECK (default_committed_hours BETWEEN 1 AND 168),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on tenants
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- updated_at trigger
CREATE TRIGGER set_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
