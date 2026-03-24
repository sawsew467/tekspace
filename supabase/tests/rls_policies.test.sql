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

SELECT plan(17);

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
SELECT * FROM finish();
ROLLBACK;
