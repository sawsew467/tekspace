-- Migration: Daily Report Edit Window
-- Story 4.6: Cho phép member chỉnh sửa report hôm nay trước deadline
--
-- Changes:
--   1. Add updated_at column to daily_reports
--   2. Add UPDATE RLS policy (member chỉ update report của chính mình)
--
-- Note: is_late là immutable sau INSERT — không có BEFORE UPDATE trigger
-- Deadline window check được thực hiện ở FE, không ở RLS

-- 1. Add updated_at column
ALTER TABLE public.daily_reports
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NULL;

-- 2. UPDATE RLS policy
-- Member có thể UPDATE report của chính mình trong cùng tenant
-- Deadline window check ở FE — RLS chỉ enforce ownership + tenant isolation
CREATE POLICY daily_reports_update_policy ON public.daily_reports
  FOR UPDATE
  USING (
    tenant_id = public.current_tenant_id()
    AND user_id = auth.uid()
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND user_id = auth.uid()
  );
