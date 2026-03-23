-- Migration: Create daily_reports table
-- Structured daily report + tasks (append-only sau submit)

CREATE TABLE public.daily_reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.users(id),
  report_date  date NOT NULL,
  -- P-21: tasks phải là JSON array
  tasks        jsonb NOT NULL DEFAULT '[]'::jsonb
                    CONSTRAINT daily_reports_tasks_is_array CHECK (jsonb_typeof(tasks) = 'array'),
  -- tasks schema: [{ description: string, output_type: 'pr'|'figma'|'document'|'other', output_link?: string }]
  -- P-17: hours_logged phải nằm trong 0–24
  hours_logged numeric(4,1) NOT NULL DEFAULT 0
                    CONSTRAINT daily_reports_hours_valid CHECK (hours_logged >= 0 AND hours_logged <= 24),
  -- IG-4: is_late được tính tự động bởi trigger (không set từ client)
  is_late      boolean NOT NULL DEFAULT false,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  -- KHÔNG có updated_at — append-only sau submit
  UNIQUE (tenant_id, user_id, report_date)  -- 1 report per member per day
);

CREATE INDEX idx_daily_reports_tenant_id   ON public.daily_reports(tenant_id);
CREATE INDEX idx_daily_reports_user_id     ON public.daily_reports(user_id);
CREATE INDEX idx_daily_reports_report_date ON public.daily_reports(tenant_id, report_date);

-- Enable RLS
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- IG-4: Auto-compute is_late dựa vào submitted_at vs deadline của tenant
-- Trigger chạy BEFORE INSERT để set đúng giá trị trước khi lưu
-- ================================================================
CREATE OR REPLACE FUNCTION public.compute_is_late()
RETURNS TRIGGER AS $$
DECLARE
  tenant_deadline_hour  smallint;
  tenant_tz             text;
  report_deadline       timestamptz;
BEGIN
  SELECT daily_report_deadline_hour, timezone
  INTO   tenant_deadline_hour, tenant_tz
  FROM   public.tenants
  WHERE  id = NEW.tenant_id;

  -- Deadline là report_date + 1 ngày tại deadline_hour, theo timezone tenant
  -- Ví dụ: report_date = '2026-03-23', deadline_hour = 3, tz = 'Asia/Ho_Chi_Minh'
  -- → deadline = '2026-03-24 03:00:00+07'
  report_deadline := (NEW.report_date + 1)::timestamptz
                     + (tenant_deadline_hour || ' hours')::interval
                     - EXTRACT(EPOCH FROM now() - now() AT TIME ZONE tenant_tz) * '1 second'::interval;
  -- Simplified: convert to tenant tz, compute deadline, convert back
  report_deadline := ((NEW.report_date + 1)::text || ' ' || lpad(tenant_deadline_hour::text, 2, '0') || ':00:00')::timestamptz AT TIME ZONE tenant_tz;

  NEW.is_late := NEW.submitted_at > report_deadline;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE TRIGGER compute_daily_report_is_late
  BEFORE INSERT ON public.daily_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.compute_is_late();
