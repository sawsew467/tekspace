-- Migration: DB trigger for updated_at
-- Story 4.6 fix (P-1): updated_at phải được set bởi DB trigger, không phải client
--
-- AC-5 spec: "Khi UPDATE, DB set updated_at = now()"
-- Trước đây: client gửi updated_at → có thể forge timestamp
-- Sau fix: BEFORE UPDATE trigger tự động set updated_at = now()

-- Trigger function — dùng chung được cho nhiều bảng nếu cần sau này
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Trigger trên daily_reports — BEFORE UPDATE để updated_at luôn đúng
CREATE TRIGGER daily_reports_set_updated_at
  BEFORE UPDATE ON public.daily_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
