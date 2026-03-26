-- Fix: incident_appeals SELECT policy dùng current_tenant_id() không hoạt động trong Realtime context.
-- Cùng root cause với notifications (đã fix ở 20260325000001_fix_notifications_select_policy_for_realtime.sql):
-- Supabase Realtime postgres_changes KHÔNG truyền custom JWT claim `active_tenant_id`
-- vào Postgres session → current_tenant_id() trả về NULL → tenant_id = NULL luôn false
-- → Realtime events không đến client dù bảng đã có trong publication.
--
-- Vấn đề phụ: is_tenant_manager() cũng dùng current_tenant_id() nội bộ → cũng fail trong Realtime.
--
-- Fix:
-- 1. Tạo helper is_manager_of_tenant(tid) nhận tenant_id từ ROW (không dùng JWT claim)
-- 2. Viết lại SELECT policy dùng auth.uid() + is_manager_of_tenant(tenant_id)
-- - auth.uid() hoạt động bình thường trong cả PostgREST lẫn Realtime context
-- - is_manager_of_tenant(tid) dùng SECURITY DEFINER để bypass RLS trên tenant_members
-- - Tenant isolation vẫn đúng: hook đã filter .eq('tenant_id', ...) phía client

-- ────────────────────────────────────────────────────────
-- Helper: kiểm tra caller là manager/owner của tenant CỤ THỂ (không dùng JWT claim)
-- SECURITY DEFINER: bypass RLS trên tenant_members (tránh recursion)
-- Dùng cho Realtime context nơi current_tenant_id() = NULL
-- ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_manager_of_tenant(tid uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE tenant_id = tid
      AND user_id   = auth.uid()
      AND role IN   ('owner', 'manager')
      AND status    = 'active'
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '';

-- ────────────────────────────────────────────────────────
-- Rewrite incident_appeals SELECT policy
-- ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS incident_appeals_select_policy ON public.incident_appeals;

CREATE POLICY incident_appeals_select_policy ON public.incident_appeals
  FOR SELECT USING (
    member_id = auth.uid()
    OR public.is_manager_of_tenant(tenant_id)
  );
