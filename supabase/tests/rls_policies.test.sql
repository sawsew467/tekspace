-- =============================================================
-- pgTAP RLS Policy Tests — TekSpace
-- Chạy: supabase test db
-- Docs: https://pgtap.org/
--
-- Mỗi test kiểm tra RLS từ góc nhìn của role cụ thể.
-- Dùng set_config('request.jwt.claims') để giả lập JWT.
-- SET LOCAL ROLE authenticated để kích hoạt RLS enforcement.
--
-- Test IDs cố định (dễ đọc):
--   Users:   a0eebc99-...-a11 (owner), -a12 (manager), -a13 (member), -a14 (outsider)
--   Tenants: b0eebc99-...-b11 (Tenant A), -b12 (Tenant B)
-- =============================================================

BEGIN;

SELECT plan(41);

-- =============================================================
-- FIXTURES (chạy với quyền postgres superuser — bypass RLS)
-- =============================================================

-- Auth users
INSERT INTO auth.users (id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11','authenticated','authenticated','owner@rls-test.com',   '','2026-01-01 00:00:00+00', now(), now(), '{}','{}', false),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12','authenticated','authenticated','manager@rls-test.com', '','2026-01-01 00:00:00+00', now(), now(), '{}','{}', false),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13','authenticated','authenticated','member@rls-test.com',  '','2026-01-01 00:00:00+00', now(), now(), '{}','{}', false),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14','authenticated','authenticated','outsider@rls-test.com','','2026-01-01 00:00:00+00', now(), now(), '{}','{}', false)
ON CONFLICT (id) DO NOTHING;

-- public.users (trigger handle_new_user đã chạy khi insert auth.users, dùng ON CONFLICT để an toàn)
INSERT INTO public.users (id, full_name) VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Test Owner'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Test Manager'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'Test Member'),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'Test Outsider')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

-- Tenants (disable trigger tạm thời vì handle_new_tenant gọi auth.uid() → NULL khi chạy như postgres)
ALTER TABLE public.tenants DISABLE TRIGGER on_tenant_created;
INSERT INTO public.tenants (id, name) VALUES
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'RLS Test Tenant A'),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b12', 'RLS Test Tenant B')
ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.tenants ENABLE TRIGGER on_tenant_created;

-- Tenant members
INSERT INTO public.tenant_members (tenant_id, user_id, role, status) VALUES
  -- Tenant A: owner + manager + member
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11','a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11','owner',   'active'),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11','a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12','manager', 'active'),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11','a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13','member',  'active'),
  -- Tenant B: chỉ có outsider
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b12','a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14','owner',   'active')
ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- Notifications (1 cho owner, 1 cho manager — member không có)
INSERT INTO public.notifications (id, tenant_id, user_id, type, message) VALUES
  ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11','b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11','a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11','invite_sent',   'Notif for owner'),
  ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c12','b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11','a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12','invite_accepted','Notif for manager')
ON CONFLICT (id) DO NOTHING;

-- Tenant invite
INSERT INTO public.tenant_invites (id, tenant_id, invited_by, email, token, status, expires_at)
VALUES (
  'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380d11',
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
  'newjoin@rls-test.com',
  'tok_rls_test_aaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'pending',
  now() + interval '7 days'
) ON CONFLICT (id) DO NOTHING;

-- Incidents + incident_appeals (Story 7-2: RLS tests)
-- Incidents: f11 (victim=member), f12 (victim=owner), f13 (victim=member, dùng cho INSERT test)
INSERT INTO public.incidents (id, tenant_id, member_id, manager_id, category, note) VALUES
  (
    'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f11',
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',  -- member là victim
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',  -- manager log
    'missed_report', 'RLS test — member incident (có appeal pre-existing)'
  ),
  (
    'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f12',
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',  -- owner là victim
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
    'missed_report', 'RLS test — owner incident (appeal cross-visibility test)'
  ),
  (
    'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f13',
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',  -- member là victim
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
    'missed_report', 'RLS test — member incident 2 (dùng cho INSERT test T27)'
  )
ON CONFLICT (id) DO NOTHING;

-- Pre-existing appeals: f21 (member's appeal), f22 (owner's appeal)
INSERT INTO public.incident_appeals (id, tenant_id, incident_id, member_id, response) VALUES
  (
    'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f21',
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11',
    'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f11',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',  -- member's appeal
    'Đây là phản hồi của member'
  ),
  (
    'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f22',
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11',
    'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f12',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',  -- owner's appeal
    'Đây là phản hồi của owner'
  )
ON CONFLICT (id) DO NOTHING;

-- Outcome notes (Story 7-3: RLS tests)
-- e31 = note cho incident f11 (victim = member a13), manager = a12
-- e32 = note cho incident f12 (victim = owner a11), manager = a12
INSERT INTO public.incident_outcome_notes (id, tenant_id, incident_id, manager_id, note) VALUES
  (
    'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e31',
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11',
    'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f11',  -- incident f11: victim = member (a13)
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',  -- manager ghi chú
    'RLS test — outcome note cho member incident'
  ),
  (
    'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e32',
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11',
    'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f12',  -- incident f12: victim = owner (a11)
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
    'RLS test — outcome note cho owner incident'
  )
ON CONFLICT (id) DO NOTHING;

-- Daily reports (Story 4.6: UPDATE RLS tests)
-- Dùng bypass mode (postgres superuser) để insert fixture
-- submitted_at = '2026-01-15 10:00:00+00' (10am UTC = trước deadline 03:00 ICT ngày 16)
-- → trigger compute_is_late sẽ set is_late = false (10:00 UTC < 20:00 UTC = 03:00 ICT)
INSERT INTO public.daily_reports (id, tenant_id, user_id, report_date, hours_logged, is_late, submitted_at)
VALUES
  -- Member's own report in Tenant A (is_late = false vì submitted trước deadline)
  (
    'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e11',
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',  -- member
    '2026-01-15',
    8,
    false,
    '2026-01-15 10:00:00+00'  -- 5pm ICT, trước deadline 03:00 ICT ngày 16 (= 20:00 UTC)
  ),
  -- Owner's report in Tenant A (member should NOT be able to update this)
  (
    'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e12',
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',  -- owner
    '2026-01-15',
    6,
    false,
    '2026-01-15 10:00:00+00'
  ),
  -- Report in Tenant B (member của Tenant A không được update)
  (
    'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e13',
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b12',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14',  -- outsider in Tenant B
    '2026-01-15',
    4,
    false,
    '2026-01-15 10:00:00+00'
  )
ON CONFLICT (id) DO NOTHING;

-- report_tasks fixtures (Story 9.2: tasks đã chuyển sang bảng relational)
INSERT INTO public.report_tasks (id, tenant_id, report_id, user_id, task_type, description, sort_order)
VALUES
  (
    'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e21',
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11',
    'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e11',  -- member's report (Tenant A)
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',  -- member
    'completed',
    'RLS test task — member completed',
    0
  )
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- HELPERS
-- =============================================================

-- Set JWT claims để giả lập authenticated user
CREATE OR REPLACE FUNCTION public._test_set_auth(p_user_id uuid, p_tenant_id uuid DEFAULT NULL)
RETURNS void LANGUAGE sql AS $$
  SELECT set_config(
    'request.jwt.claims',
    json_build_object(
      'sub',              p_user_id::text,
      'role',             'authenticated',
      'aud',              'authenticated',
      'active_tenant_id', COALESCE(p_tenant_id::text, '')
    )::text,
    true  -- is_local: reset khi transaction kết thúc
  );
$$;

-- UPDATE tenant và trả về số rows bị ảnh hưởng
-- Không có SECURITY DEFINER → chạy với quyền của caller (authenticated role, RLS áp dụng)
CREATE OR REPLACE FUNCTION public._test_update_tenant(p_name text, p_tenant_id uuid)
RETURNS int LANGUAGE sql AS $$
  WITH upd AS (
    UPDATE public.tenants SET name = p_name WHERE id = p_tenant_id RETURNING id
  ) SELECT count(*)::int FROM upd;
$$;

-- UPDATE committed_hours của tenant_member và trả về số rows bị ảnh hưởng
-- Không có SECURITY DEFINER → chạy với quyền của caller (authenticated role, RLS áp dụng)
CREATE OR REPLACE FUNCTION public._test_update_committed_hours(
  p_user_id uuid,
  p_tenant_id uuid,
  p_hours smallint
)
RETURNS int LANGUAGE sql AS $$
  WITH upd AS (
    UPDATE public.tenant_members
    SET committed_hours = p_hours
    WHERE user_id = p_user_id AND tenant_id = p_tenant_id
    RETURNING id
  ) SELECT count(*)::int FROM upd;
$$;

-- UPDATE daily_report và trả về số rows bị ảnh hưởng-- Không có SECURITY DEFINER → chạy với quyền của caller (authenticated role, RLS áp dụng)
CREATE OR REPLACE FUNCTION public._test_update_daily_report(p_report_id uuid)
RETURNS int LANGUAGE sql AS $$
  WITH upd AS (
    UPDATE public.daily_reports
    SET
      hours_logged = 2,
      updated_at = now()
    WHERE id = p_report_id
    RETURNING id
  ) SELECT count(*)::int FROM upd;
$$;

-- =============================================================
-- TEST SECTION 1: Không có infinite recursion
-- Lỗi gốc: is_tenant_manager() không có SECURITY DEFINER
-- Fix: migration 20260324000002_fix_rls_recursion.sql
-- =============================================================

SELECT public._test_set_auth(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13'::uuid,
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'::uuid
);
SET LOCAL ROLE authenticated;

SELECT ok(
  (SELECT count(*) FROM public.tenant_members) IS NOT NULL,
  '1. Không bị infinite recursion (error 54001) khi member query tenant_members'
);

RESET ROLE;

-- =============================================================
-- TEST SECTION 2: users table — SELECT policy
-- =============================================================

SELECT public._test_set_auth(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13'::uuid,  -- member
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'::uuid   -- Tenant A
);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*)::int FROM public.users WHERE id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13'),
  1,
  '2. Member thấy profile của chính mình'
);

SELECT is(
  (SELECT count(*)::int FROM public.users WHERE id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'),
  1,
  '3. Member thấy profile của teammate cùng tenant'
);

SELECT is(
  (SELECT count(*)::int FROM public.users WHERE id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14'),
  0,
  '4. Member KHÔNG thấy user của tenant khác (outsider)'
);

RESET ROLE;

-- =============================================================
-- TEST SECTION 3: tenants table — SELECT & UPDATE policy
-- =============================================================

SELECT public._test_set_auth(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13'::uuid,
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'::uuid
);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*)::int FROM public.tenants WHERE id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'),
  1,
  '5. Member thấy tenant của mình'
);

SELECT is(
  (SELECT count(*)::int FROM public.tenants WHERE id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b12'),
  0,
  '6. Member KHÔNG thấy tenant khác'
);

-- Regular member UPDATE tenant → USING clause không match → 0 rows affected (silent fail, no error)
SELECT is(
  public._test_update_tenant('Hacked by member', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'::uuid),
  0,
  '7. Regular member KHÔNG UPDATE được tenant (0 rows affected)'
);

RESET ROLE;

-- Manager UPDATE tenant → 1 row affected
SELECT public._test_set_auth(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid,  -- manager
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'::uuid
);
SET LOCAL ROLE authenticated;

SELECT is(
  public._test_update_tenant('RLS Test Tenant A', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'::uuid),
  1,
  '8. Manager UPDATE được tenant (1 row affected)'
);

RESET ROLE;

-- =============================================================
-- TEST SECTION 4: tenant_members — SELECT & INSERT policy
-- =============================================================

-- Regular member: thấy tất cả active members trong cùng tenant (AC2 Story 1.5)
-- Policy cũ (IG-8): member chỉ thấy row của chính mình → đã đổi vì cần hiện team list
-- Fix: migration 20260324000003_fix_tenant_members_select_policy.sql
SELECT public._test_set_auth(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13'::uuid,
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'::uuid
);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*)::int FROM public.tenant_members
   WHERE tenant_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'),
  3,
  '9. Regular member thấy tất cả members trong cùng tenant (AC2 — team list)'
);

RESET ROLE;

-- Manager: thấy tất cả 3 rows trong Tenant A
SELECT public._test_set_auth(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid,
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'::uuid
);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*)::int FROM public.tenant_members
   WHERE tenant_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'),
  3,
  '10. Manager thấy tất cả 3 rows trong tenant_members'
);

RESET ROLE;

-- Regular member INSERT vào tenant_members → lỗi 42501
SELECT public._test_set_auth(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13'::uuid,
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'::uuid
);
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $sql$
    INSERT INTO public.tenant_members (tenant_id, user_id, role, status)
    VALUES (
      'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11',
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14',
      'member', 'active'
    )
  $sql$,
  '42501', NULL,
  '11. Regular member KHÔNG INSERT được vào tenant_members'
);

RESET ROLE;

-- =============================================================
-- TEST SECTION 5: tenant_invites — SELECT & INSERT policy
-- =============================================================

-- Manager thấy invites
SELECT public._test_set_auth(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid,
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'::uuid
);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*)::int FROM public.tenant_invites
   WHERE tenant_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'),
  1,
  '12. Manager thấy invites trong tenant'
);

RESET ROLE;

-- Regular member cũng thấy invites (policy hiện tại cho phép — potential security gap)
-- ⚠️  POLICY NOTE: member thấy email của người được invite → cân nhắc restrict về manager-only
SELECT public._test_set_auth(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13'::uuid,
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'::uuid
);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*)::int FROM public.tenant_invites
   WHERE tenant_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'),
  1,
  '13. [POLICY NOTE] Regular member thấy invites (policy cho phép — xem xét restrict về manager-only)'
);

RESET ROLE;

-- Regular member INSERT invite → lỗi 42501
SELECT public._test_set_auth(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13'::uuid,
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'::uuid
);
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $sql$
    INSERT INTO public.tenant_invites (tenant_id, invited_by, email, token, expires_at)
    VALUES (
      'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11',
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
      'evil@rls-test.com',
      'tok_rls_evil_bbbbbbbbbbbbbbbbbbbbbbbbbbb',
      now() + interval '1 day'
    )
  $sql$,
  '42501', NULL,
  '14. Regular member KHÔNG INSERT được invite'
);

RESET ROLE;

-- =============================================================
-- TEST SECTION 6: notifications — SELECT & INSERT policy
-- =============================================================

-- Owner chỉ thấy notification của chính mình (không thấy của manager)
SELECT public._test_set_auth(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid,  -- owner
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'::uuid
);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*)::int FROM public.notifications
   WHERE tenant_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'),
  1,
  '15. User chỉ thấy notification của chính mình (không thấy notification của người khác)'
);

RESET ROLE;

-- Member không có notification → count = 0
SELECT public._test_set_auth(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13'::uuid,  -- member (không có notif)
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'::uuid
);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*)::int FROM public.notifications
   WHERE tenant_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'),
  0,
  '16. User KHÔNG thấy notification của người khác'
);

-- ⚠️  BUG: notifications_insert_policy chỉ check tenant_id, KHÔNG check user_id
-- → member có thể INSERT notification cho bất kỳ ai trong tenant
-- FIX CẦN THỰC HIỆN: thêm "AND user_id = auth.uid()" vào WITH CHECK
-- Test này sẽ FAIL cho đến khi bug được fix
SELECT throws_ok(
  $sql$
    INSERT INTO public.notifications (tenant_id, user_id, type, message)
    VALUES (
      'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11',
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',  -- insert cho OWNER (không phải mình)
      'invite_sent',
      'Spam notification from member'
    )
  $sql$,
  '42501', NULL,
  '17. [BUG] User KHÔNG INSERT được notification cho người khác — FAILING vì policy thiếu user_id check'
);

RESET ROLE;

-- =============================================================
-- TEST SECTION 7: daily_reports — UPDATE policy (Story 4.6)
-- =============================================================

-- Test 18: Member CÓ THỂ UPDATE report của chính mình trong cùng tenant
SELECT public._test_set_auth(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13'::uuid,  -- member
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'::uuid   -- Tenant A
);
SET LOCAL ROLE authenticated;

SELECT is(
  public._test_update_daily_report('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e11'::uuid),
  1,
  '18. Member CÓ THỂ UPDATE report của chính mình (1 row affected)'
);

RESET ROLE;

-- Test 19: Member KHÔNG THỂ UPDATE report của người khác (owner)
SELECT public._test_set_auth(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13'::uuid,  -- member
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'::uuid   -- Tenant A
);
SET LOCAL ROLE authenticated;

SELECT is(
  public._test_update_daily_report('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e12'::uuid),  -- owner's report
  0,
  '19. Member KHÔNG UPDATE được report của người khác (0 rows affected)'
);

RESET ROLE;

-- Test 20: Member Tenant A KHÔNG THỂ UPDATE report của Tenant B
SELECT public._test_set_auth(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13'::uuid,  -- member in Tenant A
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'::uuid   -- active_tenant_id = Tenant A
);
SET LOCAL ROLE authenticated;

SELECT is(
  public._test_update_daily_report('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e13'::uuid),  -- Tenant B report
  0,
  '20. Member Tenant A KHÔNG UPDATE được report của Tenant B (tenant isolation)'
);

RESET ROLE;

-- Test 21: is_late KHÔNG bị thay đổi sau khi UPDATE bình thường (immutable)
-- UPDATE chỉ set tasks/hours_logged/updated_at — is_late phải giữ nguyên false
SELECT public._test_set_auth(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13'::uuid,  -- member
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'::uuid   -- Tenant A
);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT is_late FROM public.daily_reports WHERE id = 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e11'),
  false,
  '21. is_late KHÔNG thay đổi sau khi UPDATE (immutable — chỉ được set bởi INSERT trigger)'
);

RESET ROLE;

-- =============================================================
-- TEST SECTION 8: tenant_members — committed_hours UPDATE policy (Story 5.1)
-- Policy: is_tenant_manager() — chỉ owner/manager được UPDATE
-- =============================================================

-- Test 22: Manager CÓ THỂ UPDATE committed_hours của member
SELECT public._test_set_auth(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid,  -- manager
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'::uuid   -- Tenant A
);
SET LOCAL ROLE authenticated;

SELECT is(
  public._test_update_committed_hours(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13'::uuid,  -- target: member
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'::uuid,  -- Tenant A
    35::smallint
  ),
  1,
  '22. Manager CÓ THỂ UPDATE committed_hours của member (1 row affected)'
);

RESET ROLE;

-- Test 23: Regular member KHÔNG THỂ UPDATE committed_hours (kể cả của chính mình)
SELECT public._test_set_auth(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13'::uuid,  -- member
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'::uuid   -- Tenant A
);
SET LOCAL ROLE authenticated;

SELECT is(
  public._test_update_committed_hours(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13'::uuid,  -- target: chính mình
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'::uuid,  -- Tenant A
    30::smallint
  ),
  0,
  '23. Regular member KHÔNG UPDATE được committed_hours (0 rows — RLS blocks)'
);

RESET ROLE;

-- Test 24: Manager CÓ THỂ UPDATE committed_hours = NULL (reset về team default)
-- Đây là path riêng — NULL là giá trị hợp lệ (smallint nullable), phải test độc lập
SELECT public._test_set_auth(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid,  -- manager
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'::uuid   -- Tenant A
);
SET LOCAL ROLE authenticated;

SELECT is(
  public._test_update_committed_hours(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13'::uuid,  -- target: member
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'::uuid,  -- Tenant A
    NULL::smallint                                   -- reset về team default
  ),
  1,
  '24. Manager CÓ THỂ UPDATE committed_hours = NULL (reset về mặc định nhóm)'
);

RESET ROLE;

-- =============================================================
-- TEST SECTION 9: incident_appeals — SELECT & INSERT policy (Story 7-2)
-- =============================================================

-- Test 25: Member chỉ thấy appeal của chính mình (không thấy appeal của owner)
SELECT public._test_set_auth(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13'::uuid,  -- member
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'::uuid
);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*)::int FROM public.incident_appeals
   WHERE tenant_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'),
  1,  -- chỉ thấy f21 (của mình), không thấy f22 (của owner)
  '25. Member chỉ thấy appeal của chính mình (cross-member isolation)'
);

RESET ROLE;

-- Test 26: Manager thấy tất cả appeals trong tenant
SELECT public._test_set_auth(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid,  -- manager
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'::uuid
);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*)::int FROM public.incident_appeals
   WHERE tenant_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'),
  2,  -- thấy cả f21 (member) lẫn f22 (owner)
  '26. Manager thấy tất cả appeals trong tenant'
);

RESET ROLE;

-- Test 27: Member CÓ THỂ INSERT appeal cho incident của chính mình
SELECT public._test_set_auth(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13'::uuid,  -- member
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'::uuid
);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $sql$
    INSERT INTO public.incident_appeals (incident_id, tenant_id, member_id, response)
    VALUES (
      'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f13',  -- incident f13: victim = member (chưa có appeal)
      'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11',
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
      'Test appeal response'
    )
  $sql$,
  '27. Member CÓ THỂ INSERT appeal cho incident của chính mình (RLS victim check pass)'
);

RESET ROLE;

-- Test 28: Member KHÔNG THỂ INSERT appeal cho incident của member khác (victim check fail)
SELECT public._test_set_auth(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13'::uuid,  -- member
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'::uuid
);
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $sql$
    INSERT INTO public.incident_appeals (incident_id, tenant_id, member_id, response)
    VALUES (
      'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f12',  -- incident f12: victim = owner (không phải member)
      'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11',
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
      'Trying to appeal another member incident'
    )
  $sql$,
  '42501', NULL,
  '28. Member KHÔNG THỂ INSERT appeal cho incident của member khác (42501)'
);

RESET ROLE;

-- Test 29: Manager KHÔNG THỂ INSERT appeal (không phải victim của incident)
SELECT public._test_set_auth(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid,  -- manager
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'::uuid
);
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $sql$
    INSERT INTO public.incident_appeals (incident_id, tenant_id, member_id, response)
    VALUES (
      'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f11',  -- incident f11: victim = member (không phải manager)
      'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11',
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
      'Manager trying to submit appeal'
    )
  $sql$,
  '42501', NULL,
  '29. Manager KHÔNG THỂ INSERT appeal (không phải victim của incident — 42501)'
);

RESET ROLE;

-- =============================================================
-- Tests 30-34: incident_outcome_notes RLS (Story 7-3)
-- Bảng mới: tenant isolation + manager/victim access control
-- Test IDs: e31 (note for f11, victim=member), e32 (note for f12, victim=owner)
-- =============================================================

-- Test 30: Manager THẤY tất cả outcome notes trong tenant
SELECT public._test_set_auth(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid,  -- manager
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'::uuid
);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*)::int FROM public.incident_outcome_notes
   WHERE tenant_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'),
  2,  -- thấy cả e31 (note cho member's incident) lẫn e32 (note cho owner's incident)
  '30. Manager thấy tất cả outcome notes trong tenant'
);

RESET ROLE;

-- Test 31: Member THẤY outcome notes của incident mình là victim
SELECT public._test_set_auth(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13'::uuid,  -- member
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'::uuid
);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*)::int FROM public.incident_outcome_notes
   WHERE incident_id = 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f11'),  -- f11: victim = member
  1,  -- thấy e31
  '31. Member thấy outcome notes của incident mình là victim'
);

RESET ROLE;

-- Test 32: Member KHÔNG THẤY outcome notes của incident mình KHÔNG là victim
SELECT public._test_set_auth(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13'::uuid,  -- member
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'::uuid
);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*)::int FROM public.incident_outcome_notes
   WHERE incident_id = 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f12'),  -- f12: victim = owner (không phải member)
  0,  -- không thấy e32
  '32. Member KHÔNG thấy outcome notes của incident người khác (tenant isolation)'
);

RESET ROLE;

-- Test 33: Manager CÓ THỂ INSERT outcome note
SELECT public._test_set_auth(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid,  -- manager
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'::uuid
);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $sql$
    INSERT INTO public.incident_outcome_notes (incident_id, tenant_id, manager_id, note)
    VALUES (
      'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f13',  -- incident f13 (chưa có note)
      'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11',
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
      'Test outcome note từ manager'
    )
  $sql$,
  '33. Manager CÓ THỂ INSERT outcome note (manager_id = auth.uid() pass)'
);

RESET ROLE;

-- Test 34: Member KHÔNG THỂ INSERT outcome note (chỉ manager/owner được INSERT)
SELECT public._test_set_auth(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13'::uuid,  -- member
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'::uuid
);
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $sql$
    INSERT INTO public.incident_outcome_notes (incident_id, tenant_id, manager_id, note)
    VALUES (
      'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f11',  -- incident f11: member là victim
      'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11',
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
      'Member cố gắng INSERT outcome note'
    )
  $sql$,
  '42501', NULL,
  '34. Member KHÔNG THỂ INSERT outcome note (is_tenant_manager() fail — 42501)'
);

RESET ROLE;

-- =============================================================
-- TEST SECTION 9: incident_resolutions — Story 9.3
-- =============================================================

-- Test 35: Manager CÓ THỂ INSERT incident_resolution (outcome + resolved_by = auth.uid())
SELECT public._test_set_auth(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid,  -- manager
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'::uuid
);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $sql$
    INSERT INTO public.incident_resolutions (tenant_id, incident_id, outcome, resolved_by)
    VALUES (
      'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11',
      'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f11',  -- incident f11: manager là manager_id
      'dismissed',
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'   -- resolved_by = auth.uid() ✓
    )
  $sql$,
  '35. Manager CÓ THỂ INSERT incident_resolution (resolved_by = auth.uid() pass)'
);

RESET ROLE;

-- Test 36: Member KHÔNG THỂ INSERT incident_resolution (is_tenant_manager() fail)
SELECT public._test_set_auth(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13'::uuid,  -- member
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'::uuid
);
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $sql$
    INSERT INTO public.incident_resolutions (tenant_id, incident_id, outcome, resolved_by)
    VALUES (
      'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11',
      'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f11',
      'upheld',
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13'
    )
  $sql$,
  '42501', NULL,
  '36. Member KHÔNG THỂ INSERT incident_resolution (is_tenant_manager() fail — 42501)'
);

RESET ROLE;

-- Test 37: Manager thấy resolution trong tenant của mình
SELECT public._test_set_auth(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'::uuid,  -- manager
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'::uuid
);
SET LOCAL ROLE authenticated;

SELECT ok(
  (SELECT count(*) FROM public.incident_resolutions
   WHERE incident_id = 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f11') = 1,
  '37. Manager CÓ THỂ SELECT resolution trong tenant của mình'
);

RESET ROLE;

-- Test 38: Member thấy resolution của incident mà mình là victim
SELECT public._test_set_auth(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13'::uuid,  -- member (victim của f11)
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'::uuid
);
SET LOCAL ROLE authenticated;

SELECT ok(
  (SELECT count(*) FROM public.incident_resolutions
   WHERE incident_id = 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f11') = 1,
  '38. Member THẤY resolution của incident mà mình là victim (is_incident_victim pass)'
);

RESET ROLE;

-- =============================================================
-- TEST SECTION 10: report_tasks — SELECT & INSERT policy (Story 9.2)
-- =============================================================

-- Test 39: Member thấy tasks trong report của chính mình (Tenant A)
SELECT public._test_set_auth(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13'::uuid,  -- member
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'::uuid   -- Tenant A
);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*)::int FROM public.report_tasks
   WHERE report_id = 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e11'),
  1,
  '39. Member THẤY tasks trong report của chính mình'
);

RESET ROLE;

-- Test 40: Member KHÔNG THỂ INSERT tasks vào report của người khác
SELECT public._test_set_auth(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13'::uuid,  -- member
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'::uuid   -- Tenant A
);
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $sql$
    INSERT INTO public.report_tasks (tenant_id, report_id, user_id, task_type, description, sort_order)
    VALUES (
      'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11',
      'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e12',  -- owner's report
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',  -- owner's user_id
      'completed',
      'Unauthorized task insert',
      0
    )
  $sql$,
  '42501', NULL,
  '40. Member KHÔNG INSERT được task vào report của người khác'
);

RESET ROLE;

-- Test 41: Member KHÔNG THẤY resolution của incident mà mình không phải victim (cross-member isolation)
-- Fixture: insert resolution cho f12 (victim=owner/a11) — chạy như postgres superuser (bypass RLS)
INSERT INTO public.incident_resolutions (tenant_id, incident_id, outcome, resolved_by)
VALUES (
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11',
  'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f12',  -- incident f12: victim = owner (a11)
  'upheld',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'   -- resolved by manager
)
ON CONFLICT (incident_id) DO NOTHING;

SELECT public._test_set_auth(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13'::uuid,  -- member (a13, KHÔNG phải victim của f12)
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'::uuid
);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*)::int FROM public.incident_resolutions
   WHERE incident_id = 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f12'),
  0,
  '41. Member KHÔNG THẤY resolution của incident mà mình không phải victim (cross-member isolation)'
);

RESET ROLE;

-- =============================================================
SELECT * FROM finish();
ROLLBACK;
