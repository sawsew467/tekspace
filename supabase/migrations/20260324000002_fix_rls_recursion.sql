-- Fix: RLS infinite recursion (PostgreSQL error 54001)
--
-- Root cause: is_tenant_manager() queries tenant_members WITHOUT SECURITY DEFINER
-- → hits tenant_members_select_policy → calls is_tenant_manager() again → ∞
--
-- Fix 1: Add SECURITY DEFINER to is_tenant_manager() so it runs as function owner
--        (bypasses RLS) instead of as the calling user.
--
-- Fix 2: users_select_policy có inline subquery ON tenant_members → same recursion
--        when tenant_members is joined with users. Extract thành SECURITY DEFINER fn.

-- ================================================================
-- Fix is_tenant_manager: thêm SECURITY DEFINER
-- ================================================================
CREATE OR REPLACE FUNCTION public.is_tenant_manager()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE tenant_id = public.current_tenant_id()
      AND user_id   = auth.uid()
      AND role IN   ('owner', 'manager')
      AND status    = 'active'
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '';

-- ================================================================
-- New helper: kiểm tra user có phải active member của tenant hiện tại không
-- Dùng trong users_select_policy thay vì inline subquery
-- ================================================================
CREATE OR REPLACE FUNCTION public.is_member_of_current_tenant(check_user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE tenant_id = public.current_tenant_id()
      AND user_id   = check_user_id
      AND status    = 'active'
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '';

-- ================================================================
-- Rebuild users_select_policy dùng helper thay vì inline subquery
-- ================================================================
DROP POLICY IF EXISTS users_select_policy ON public.users;

CREATE POLICY users_select_policy ON public.users
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (
      id = auth.uid()
      OR public.is_member_of_current_tenant(id)
    )
  );
