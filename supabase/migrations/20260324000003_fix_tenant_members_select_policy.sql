-- Fix: tenant_members_select_policy quá restrictive
--
-- Policy cũ: members chỉ thấy row của chính mình (user_id = auth.uid())
-- → UI chỉ hiện 1 người (chính họ), không thấy teammates
--
-- AC2 (Story 1.5): Tất cả active members có thể thấy toàn bộ danh sách
-- team của mình — cần thiết cho Team Settings page và Schedule features.
-- Chỉ cần thuộc cùng tenant (via JWT active_tenant_id).

DROP POLICY IF EXISTS tenant_members_select_policy ON public.tenant_members;

CREATE POLICY tenant_members_select_policy ON public.tenant_members
  FOR SELECT USING (
    tenant_id = public.current_tenant_id()
  );
