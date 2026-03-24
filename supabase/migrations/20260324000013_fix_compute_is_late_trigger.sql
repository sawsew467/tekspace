-- Migration: Fix compute_is_late trigger
-- Bug 1: Khi tenant không tìm thấy → tenant_deadline_hour/tenant_tz = NULL
--         → report_deadline = NULL → NEW.submitted_at > NULL = NULL
--         → vi phạm NOT NULL constraint trên is_late
-- Bug 2: ::timestamptz AT TIME ZONE tz → sai logic (convert UTC→local thay vì local→UTC)
--         Đúng: ::timestamp AT TIME ZONE tz → interpret local time → returns timestamptz (UTC)

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

  -- Fallback nếu tenant không tìm thấy hoặc fields là NULL
  tenant_deadline_hour := COALESCE(tenant_deadline_hour, 3);   -- default 03:00 sáng
  tenant_tz             := COALESCE(tenant_tz, 'UTC');

  -- Deadline = (report_date + 1 ngày) lúc deadline_hour TRONG tenant timezone
  -- PHẢI dùng ::timestamp (không tz) trước AT TIME ZONE:
  --   '2026-03-25 03:00:00'::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'
  --   → treat 03:00 là giờ địa phương → trả về timestamptz UTC = '2026-03-24 20:00:00+00'
  -- SAI nếu dùng ::timestamptz trước (sẽ interpret 03:00 là UTC trước rồi mới shift)
  report_deadline := (
    (NEW.report_date + 1)::text
    || ' '
    || lpad(tenant_deadline_hour::text, 2, '0')
    || ':00:00'
  )::timestamp AT TIME ZONE tenant_tz;

  -- COALESCE bảo vệ trường hợp vẫn NULL (belt-and-suspenders)
  NEW.is_late := COALESCE(NEW.submitted_at > report_deadline, false);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';
