-- Migration: RLS Policies cho tất cả data tables
-- Sử dụng current_tenant_id() helper function

-- ================================================================
-- Helper: đọc active_tenant_id từ JWT claims
-- ================================================================
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid AS $$
  SELECT (auth.jwt() ->> 'active_tenant_id')::uuid
$$ LANGUAGE sql STABLE SET search_path = '';

-- ================================================================
-- Helper: kiểm tra caller là owner/manager của tenant hiện tại
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
$$ LANGUAGE sql STABLE SET search_path = '';

-- ================================================================
-- users table policies
-- ================================================================
CREATE POLICY users_select_policy ON public.users
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.tenant_members tm
        WHERE tm.user_id   = users.id
          AND tm.tenant_id = public.current_tenant_id()
          AND tm.status    = 'active'
      )
    )
  );

CREATE POLICY users_update_policy ON public.users
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ================================================================
-- tenants table policies
-- ================================================================
CREATE POLICY tenants_select_policy ON public.tenants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tenant_members tm
      WHERE tm.tenant_id = tenants.id
        AND tm.user_id   = auth.uid()
        AND tm.status    = 'active'
    )
  );

CREATE POLICY tenants_update_policy ON public.tenants
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.tenant_members tm
      WHERE tm.tenant_id = tenants.id
        AND tm.user_id   = auth.uid()
        AND tm.role IN   ('owner', 'manager')
        AND tm.status    = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_members tm
      WHERE tm.tenant_id = tenants.id
        AND tm.user_id   = auth.uid()
        AND tm.role IN   ('owner', 'manager')
        AND tm.status    = 'active'
    )
  );

-- P-6: Bất kỳ user nào cũng có thể tạo tenant (trigger bên dưới sẽ tự thêm owner)
CREATE POLICY tenants_insert_policy ON public.tenants
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- P-6: Trigger tự-insert creator làm owner khi tạo tenant mới
CREATE OR REPLACE FUNCTION public.handle_new_tenant()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.tenant_members (tenant_id, user_id, role, status)
  VALUES (NEW.id, auth.uid(), 'owner', 'active');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER on_tenant_created
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_tenant();

-- ================================================================
-- tenant_members table policies
-- P-4: Chỉ owner/manager mới có thể thêm, sửa, xóa members
-- IG-8: members chỉ xem row của chính mình; manager/owner xem tất cả
-- ================================================================
CREATE POLICY tenant_members_select_policy ON public.tenant_members
  FOR SELECT USING (
    tenant_id = public.current_tenant_id()
    AND (
      user_id = auth.uid()         -- xem row của chính mình
      OR public.is_tenant_manager() -- manager/owner xem tất cả
    )
  );

CREATE POLICY tenant_members_insert_policy ON public.tenant_members
  FOR INSERT WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_tenant_manager()
  );

CREATE POLICY tenant_members_update_policy ON public.tenant_members
  FOR UPDATE USING (
    tenant_id = public.current_tenant_id()
    AND public.is_tenant_manager()
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_tenant_manager()
  );

CREATE POLICY tenant_members_delete_policy ON public.tenant_members
  FOR DELETE USING (
    tenant_id = public.current_tenant_id()
    AND public.is_tenant_manager()
  );

-- ================================================================
-- tenant_invites table policies
-- Chỉ manager/owner tạo invites; IG-9: check expires_at khi update
-- ================================================================
CREATE POLICY tenant_invites_select_policy ON public.tenant_invites
  FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY tenant_invites_insert_policy ON public.tenant_invites
  FOR INSERT WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_tenant_manager()
  );

CREATE POLICY tenant_invites_update_policy ON public.tenant_invites
  FOR UPDATE USING (tenant_id = public.current_tenant_id())
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    -- IG-9: Không cho accept invite đã hết hạn
    AND NOT (status = 'accepted' AND expires_at < now())
  );

-- ================================================================
-- schedule_weeks table policies
-- Chỉ manager/owner tạo/khóa schedule weeks
-- ================================================================
CREATE POLICY schedule_weeks_select_policy ON public.schedule_weeks
  FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY schedule_weeks_insert_policy ON public.schedule_weeks
  FOR INSERT WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_tenant_manager()
  );

CREATE POLICY schedule_weeks_update_policy ON public.schedule_weeks
  FOR UPDATE USING (
    tenant_id = public.current_tenant_id()
    AND public.is_tenant_manager()
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_tenant_manager()
  );

-- ================================================================
-- schedule_slots table policies
-- P-12: user_id phải là member trong tenant
-- Members chỉ insert/update/delete slot của chính mình (trừ manager)
-- ================================================================
CREATE POLICY schedule_slots_select_policy ON public.schedule_slots
  FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY schedule_slots_insert_policy ON public.schedule_slots
  FOR INSERT WITH CHECK (
    tenant_id = public.current_tenant_id()
    -- P-12: user_id phải là active member của tenant
    AND EXISTS (
      SELECT 1 FROM public.tenant_members tm
      WHERE tm.tenant_id = public.current_tenant_id()
        AND tm.user_id   = user_id
        AND tm.status    = 'active'
    )
    -- Chỉ insert cho chính mình, hoặc manager insert cho member
    AND (user_id = auth.uid() OR public.is_tenant_manager())
  );

CREATE POLICY schedule_slots_update_policy ON public.schedule_slots
  FOR UPDATE USING (
    tenant_id = public.current_tenant_id()
    AND (user_id = auth.uid() OR public.is_tenant_manager())
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (user_id = auth.uid() OR public.is_tenant_manager())
  );

CREATE POLICY schedule_slots_delete_policy ON public.schedule_slots
  FOR DELETE USING (
    tenant_id = public.current_tenant_id()
    AND (user_id = auth.uid() OR public.is_tenant_manager())
  );

-- ================================================================
-- schedule_slot_changes table policies (append-only)
-- P-11: changed_by phải là auth.uid()
-- ================================================================
CREATE POLICY schedule_slot_changes_select_policy ON public.schedule_slot_changes
  FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY schedule_slot_changes_insert_policy ON public.schedule_slot_changes
  FOR INSERT WITH CHECK (
    tenant_id  = public.current_tenant_id()
    AND changed_by = auth.uid()
  );

-- ================================================================
-- daily_reports table policies
-- IG-6: members thấy report của chính mình; manager/owner thấy tất cả
-- ================================================================
CREATE POLICY daily_reports_select_policy ON public.daily_reports
  FOR SELECT USING (
    tenant_id = public.current_tenant_id()
    AND (user_id = auth.uid() OR public.is_tenant_manager())
  );

CREATE POLICY daily_reports_insert_policy ON public.daily_reports
  FOR INSERT WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND user_id = auth.uid()
  );

-- ================================================================
-- notifications table policies
-- Users chỉ thấy/xóa notifications của chính mình
-- IG-2: Thêm DELETE policy để user có thể xóa notification
-- ================================================================
CREATE POLICY notifications_select_policy ON public.notifications
  FOR SELECT USING (
    tenant_id = public.current_tenant_id() AND user_id = auth.uid()
  );

CREATE POLICY notifications_insert_policy ON public.notifications
  FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY notifications_update_policy ON public.notifications
  FOR UPDATE USING (
    tenant_id = public.current_tenant_id() AND user_id = auth.uid()
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id() AND user_id = auth.uid()
  );

-- IG-2: User có thể xóa notification của chính mình
CREATE POLICY notifications_delete_policy ON public.notifications
  FOR DELETE USING (
    tenant_id = public.current_tenant_id() AND user_id = auth.uid()
  );

-- ================================================================
-- incidents table policies (append-only, immutable)
-- P-5: Chỉ manager/owner mới được insert; manager_id phải là auth.uid()
-- IG-7: member chỉ thấy incident của chính mình; manager thấy tất cả
-- ================================================================
CREATE POLICY incidents_select_policy ON public.incidents
  FOR SELECT USING (
    tenant_id = public.current_tenant_id()
    AND (member_id = auth.uid() OR public.is_tenant_manager())
  );

CREATE POLICY incidents_insert_policy ON public.incidents
  FOR INSERT WITH CHECK (
    tenant_id   = public.current_tenant_id()
    AND manager_id  = auth.uid()
    AND public.is_tenant_manager()
    -- P-9: manager phải thuộc cùng tenant với member
    AND EXISTS (
      SELECT 1 FROM public.tenant_members tm
      WHERE tm.tenant_id = public.current_tenant_id()
        AND tm.user_id   = member_id
        AND tm.status    = 'active'
    )
  );

-- ================================================================
-- incident_appeals table policies (append-only)
-- P-10: member_id phải là victim trong incident được tham chiếu
-- ================================================================
CREATE POLICY incident_appeals_select_policy ON public.incident_appeals
  FOR SELECT USING (
    tenant_id = public.current_tenant_id()
    AND (member_id = auth.uid() OR public.is_tenant_manager())
  );

CREATE POLICY incident_appeals_insert_policy ON public.incident_appeals
  FOR INSERT WITH CHECK (
    tenant_id  = public.current_tenant_id()
    AND member_id  = auth.uid()
    -- P-10: chỉ victim của incident mới được appeal
    AND member_id = (
      SELECT i.member_id FROM public.incidents i WHERE i.id = incident_id
    )
  );
