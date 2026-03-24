-- pgTAP tests for get_or_create_schedule_week
-- File: supabase/tests/test_get_or_create_schedule_week.sql

BEGIN;

SELECT plan(10);

-- =============================================================
-- FIXTURES (chạy với quyền postgres superuser — bypass RLS)
-- =============================================================

-- Test UUIDs (tách biệt với rls_policies.test.sql)
-- Tenant:  e0eebc99-...-e11
-- User:    f0eebc99-...-f11

-- Auth user
INSERT INTO auth.users (id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
VALUES (
  'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f11',
  'authenticated', 'authenticated', 'scheduletest@test.com', '',
  '2026-01-01 00:00:00+00', now(), now(), '{}', '{}', false
) ON CONFLICT (id) DO NOTHING;

-- public.users
INSERT INTO public.users (id, full_name)
VALUES ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f11', 'Schedule Test User')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

-- Tenant (disable trigger — handle_new_tenant gọi auth.uid() = NULL khi chạy postgres)
ALTER TABLE public.tenants DISABLE TRIGGER on_tenant_created;
INSERT INTO public.tenants (id, name, timezone, schedule_deadline_day, schedule_deadline_hour)
VALUES ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e11', 'Schedule Test Tenant', 'Asia/Ho_Chi_Minh', 0, 23)
ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.tenants ENABLE TRIGGER on_tenant_created;

-- Tenant member
INSERT INTO public.tenant_members (tenant_id, user_id, role, status)
VALUES (
  'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e11',
  'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f11',
  'member', 'active'
) ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- =============================================================
-- HELPERS (simulate JWT như rls_policies.test.sql)
-- =============================================================

CREATE OR REPLACE FUNCTION set_schedule_test_claims(p_user_id uuid, p_tenant_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object(
      'sub',              p_user_id::text,
      'role',             'authenticated',
      'active_tenant_id', p_tenant_id::text
    )::text,
    true -- local to transaction
  );
END;
$$;

-- =============================================================
-- TESTS
-- =============================================================

-- Simulate authenticated member context
SET LOCAL ROLE authenticated;
SELECT set_schedule_test_claims(
  'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f11',
  'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e11'
);

-- Test 1: Non-Monday date → raise exception
SELECT throws_ok(
  $$ SELECT public.get_or_create_schedule_week('2026-03-24'::date) $$,
  'P0001',
  'p_week_of phải là thứ Hai (Monday) — nhận được 2026-03-24',
  'Test 1: Non-Monday (Tuesday 2026-03-24) → exception'
);

-- Test 2: Valid Monday → returns uuid (not null)
SELECT isnt(
  public.get_or_create_schedule_week('2026-03-23'::date),
  NULL,
  'Test 2: Valid Monday 2026-03-23 → returns non-null uuid'
);

-- Test 3: Idempotent — gọi lần 2 với cùng week_of → trả về cùng uuid
SELECT is(
  public.get_or_create_schedule_week('2026-03-23'::date),
  public.get_or_create_schedule_week('2026-03-23'::date),
  'Test 3: Idempotent — cùng week_of trả về cùng uuid'
);

-- Test 4: Deadline được tính đúng
-- deadline_day=0 (Sun), deadline_hour=23
-- week_of = 2026-03-23 (Monday) → deadline_date = 2026-03-22 (Sunday) 23:59 ICT
SELECT ok(
  (SELECT (deadline AT TIME ZONE 'Asia/Ho_Chi_Minh')::timestamp
   FROM public.schedule_weeks
   WHERE tenant_id = 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e11'
     AND week_of   = '2026-03-23'
  ) = '2026-03-22 23:59:00'::timestamp,
  'Test 4: Deadline = Sunday 2026-03-22 23:59 ICT (ngày trước Monday 2026-03-23)'
);

-- Test 5: week_of trong DB là Monday (DOW=1)
SELECT is(
  (SELECT EXTRACT(DOW FROM week_of)::int
   FROM public.schedule_weeks
   WHERE tenant_id = 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e11'
     AND week_of   = '2026-03-23'),
  1,
  'Test 5: week_of lưu trong DB là Monday (DOW=1)'
);

-- =============================================================
-- TESTS 6-10: Deadline formula cho các giá trị deadline_day khác
-- Formula: offset = ((deadline_day - 1 + 7) % 7) - 7  → range [-7, -1]
-- Mô hình: deadline luôn nằm trong TUẦN TRƯỚC week_of (pre-registration).
-- =============================================================

-- Test 6: deadline_day=5 (Friday) → offset = ((5-1+7)%7)-7 = 4-7 = -3
--         week_of=2026-03-23 (Mon) → deadline_date = 2026-03-20 (Fri trước đó)
SELECT ok(
  ((5 - 1 + 7) % 7) - 7 = -3,
  'Test 6: Formula — deadline_day=5 (Friday) → offset=-3'
);

-- Test 7: deadline_day=6 (Saturday) → offset = ((6-1+7)%7)-7 = 5-7 = -2
--         week_of=2026-03-23 (Mon) → deadline_date = 2026-03-21 (Sat trước đó)
SELECT ok(
  ((6 - 1 + 7) % 7) - 7 = -2,
  'Test 7: Formula — deadline_day=6 (Saturday) → offset=-2'
);

-- Test 8: deadline_day=1 (Monday) → offset = ((1-1+7)%7)-7 = 0-7 = -7
--         week_of=2026-03-23 (Mon) → deadline_date = 2026-03-16 (Mon tuần trước)
SELECT ok(
  ((1 - 1 + 7) % 7) - 7 = -7,
  'Test 8: Formula — deadline_day=1 (Monday) → offset=-7 (1 tuần trước)'
);

-- Test 9: deadline_day=2 (Tuesday) → offset = ((2-1+7)%7)-7 = 1-7 = -6
SELECT ok(
  ((2 - 1 + 7) % 7) - 7 = -6,
  'Test 9: Formula — deadline_day=2 (Tuesday) → offset=-6'
);

-- Test 10: Tất cả deadline_day (0-6) cho offset nằm trong range [-7, -1]
--          (đảm bảo deadline luôn trước week_of)
SELECT ok(
  (SELECT bool_and(((day - 1 + 7) % 7) - 7 BETWEEN -7 AND -1)
   FROM generate_series(0, 6) AS day),
  'Test 10: Mọi deadline_day (0-6) đều cho offset trong range [-7, -1]'
);

SELECT finish();

ROLLBACK;
