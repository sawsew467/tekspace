-- Fix circular dependency: tenants_select_policy → tenant_members → current_tenant_id()
--
-- Vấn đề:
--   tenants_select_policy dùng subquery vào tenant_members để check membership.
--   tenant_members_select_policy (migration 000003) chỉ trả về rows khi
--   active_tenant_id đã có trong JWT.
--
--   → Khi user login lần đầu (JWT chưa có active_tenant_id):
--       1. App query tenants để tìm tenant của user
--       2. tenants_select_policy subquery vào tenant_members → 0 rows (vì active_tenant_id = null)
--       3. tenants trả về 0 rows → app không biết tenant nào để activate
--       4. Không bao giờ set được active_tenant_id → stuck forever
--
-- Fix:
--   Thêm điều kiện "OR user_id = auth.uid()" để user luôn thấy được
--   membership rows của chính mình (không phụ thuộc active_tenant_id).
--   Cần thiết cho: tenant discovery khi login, tenant switcher (Story 1.7).
--
--   Hai điều kiện:
--   - tenant_id = current_tenant_id() → thấy tất cả teammates khi tenant đang active (AC2 Story 1.5)
--   - user_id = auth.uid()           → thấy own rows across all tenants (tenant discovery + switcher)

DROP POLICY IF EXISTS tenant_members_select_policy ON public.tenant_members;

CREATE POLICY tenant_members_select_policy ON public.tenant_members
  FOR SELECT USING (
    tenant_id = public.current_tenant_id()  -- thấy all teammates khi tenant active
    OR user_id = auth.uid()                 -- thấy own memberships (tenant discovery)
  );
