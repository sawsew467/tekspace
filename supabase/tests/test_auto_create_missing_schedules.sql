-- pgTAP tests for auto_create_missing_schedules function
-- Story 2.4: Missed Deadline Auto-Handling

BEGIN;

SELECT plan(12);

-- =============================================================
-- FIXTURES — UUID prefix: c1 (Tenant1), c2 (Tenant2)
-- Tenant1 : c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01
-- Owner1  : c1eebc99-9c0b-4ef8-bb6d-6bb9bd380b01  (no slots → vào member loop)
-- Manager1: c1eebc99-9c0b-4ef8-bb6d-6bb9bd380b02  (no slots → vào member loop; test self-notify)
-- Member1 : c1eebc99-9c0b-4ef8-bb6d-6bb9bd380b03  (no slots → phải được notify)
-- Member2 : c1eebc99-9c0b-4ef8-bb6d-6bb9bd380b04  (có slots → không notify)
-- Tenant2 : c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a01
-- Member3 : c2eebc99-9c0b-4ef8-bb6d-6bb9bd380b01  (no slots → test cross-tenant isolation)
-- =============================================================

-- Auth users (Tenant1)
INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
VALUES
  ('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380b01', 'authenticated', 'authenticated', 'owner_acem@test.com',   '', '2026-01-01', now(), now(), '{}', '{}', false),
  ('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380b02', 'authenticated', 'authenticated', 'manager_acem@test.com', '', '2026-01-01', now(), now(), '{}', '{}', false),
  ('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380b03', 'authenticated', 'authenticated', 'member1_acem@test.com', '', '2026-01-01', now(), now(), '{}', '{}', false),
  ('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380b04', 'authenticated', 'authenticated', 'member2_acem@test.com', '', '2026-01-01', now(), now(), '{}', '{}', false)
ON CONFLICT (id) DO NOTHING;

-- Auth users (Tenant2 — cross-tenant isolation test)
INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
VALUES
  ('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380b01', 'authenticated', 'authenticated', 'member3_acxm@test.com', '', '2026-01-01', now(), now(), '{}', '{}', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, full_name)
VALUES
  ('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380b01', 'ACEM Owner'),
  ('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380b02', 'ACEM Manager'),
  ('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380b03', 'ACEM Member One'),
  ('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380b04', 'ACEM Member Two'),
  ('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380b01', 'ACXM Member')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

ALTER TABLE public.tenants DISABLE TRIGGER on_tenant_created;
INSERT INTO public.tenants (id, name, timezone, schedule_deadline_day, schedule_deadline_hour)
VALUES
  ('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'ACEM Test Tenant', 'Asia/Ho_Chi_Minh', 0, 23),
  ('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'ACXM Test Tenant', 'Asia/Ho_Chi_Minh', 0, 23)
ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.tenants ENABLE TRIGGER on_tenant_created;

INSERT INTO public.tenant_members (tenant_id, user_id, role, status)
VALUES
  ('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380b01', 'owner',   'active'),
  ('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380b02', 'manager', 'active'),
  ('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380b03', 'member',  'active'),
  ('c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380b04', 'member',  'active'),
  ('c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380b01', 'member',  'active')
ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- Tenant1: schedule_weeks cho tuần 2026-04-06 đã có (Member2 đã nộp lịch)
INSERT INTO public.schedule_weeks (id, tenant_id, week_of, deadline, is_locked)
VALUES (
  'c1eebc99-0000-0000-0000-6bb9bd380001',
  'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01',
  '2026-04-06',
  '2026-04-05 23:59:00+07',  -- Sunday trước tuần
  false
) ON CONFLICT (tenant_id, week_of) DO NOTHING;

INSERT INTO public.schedule_slots (tenant_id, user_id, week_id, slot_date, start_time, duration_minutes)
VALUES (
  'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01',
  'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380b04',  -- Member2 đã có slot
  'c1eebc99-0000-0000-0000-6bb9bd380001',
  '2026-04-07',
  '2026-04-07 02:00:00+00',  -- 9AM ICT Monday
  120
);

-- =============================================================
-- TESTS
-- =============================================================

-- T1: p_week_of không phải Monday → RAISE EXCEPTION
SELECT throws_ok(
  $$ SELECT public.auto_create_missing_schedules('2026-04-07') $$,
  'P0001',
  NULL,
  'T1: phải throw nếu p_week_of không phải Monday'
);

-- T2: function trả về jsonb hợp lệ (first call cho '2026-04-06')
SELECT is(
  (SELECT (public.auto_create_missing_schedules('2026-04-06') -> 'week_of')::text),
  '"2026-04-06"',
  'T2: kết quả chứa week_of đúng'
);

-- T3: schedule_weeks record tồn tại cho Tenant1 (có thể đã có từ fixture)
SELECT ok(
  EXISTS (SELECT 1 FROM public.schedule_weeks WHERE tenant_id = 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01' AND week_of = '2026-04-06'),
  'T3: schedule_weeks record tồn tại cho Tenant1 sau khi gọi function'
);

-- T4: is_locked = false
SELECT is(
  (SELECT is_locked FROM public.schedule_weeks WHERE tenant_id = 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01' AND week_of = '2026-04-06'),
  false,
  'T4: schedule_weeks.is_locked = false (member được phép submit muộn)'
);

-- T5: Member1 (không có slot) nhận notification schedule_missed
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.notifications
    WHERE tenant_id = 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01'
      AND user_id   = 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380b03'
      AND type      = 'schedule_missed'
  ),
  'T5: Member1 nhận notification schedule_missed'
);

-- T6: Member2 (đã có slot) KHÔNG nhận notification
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE tenant_id = 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01'
      AND user_id   = 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380b04'
      AND type      = 'schedule_missed'
  ),
  'T6: Member2 (đã có slot) KHÔNG nhận notification'
);

-- T7: Manager nhận notification về Member1 không đăng ký
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.notifications
    WHERE tenant_id = 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01'
      AND user_id   = 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380b02'
      AND type      = 'schedule_missed'
      AND message LIKE '%ACEM Member One%'
  ),
  'T7: Manager nhận notification về Member1 không đăng ký'
);

-- T8: idempotent — ON CONFLICT DO NOTHING không tạo duplicate schedule_weeks
SELECT is(
  (SELECT count(*)::int FROM public.schedule_weeks
   WHERE tenant_id = 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01'
     AND week_of   = '2026-04-06'),
  1,
  'T8: ON CONFLICT DO NOTHING — không duplicate schedule_weeks khi gọi lại'
);

-- T9: Self-notify guard — Manager không nhận notification về chính mình từ manager loop
-- Manager1 (b02) không có slot → vào member loop → nhận member notification
-- Nhưng trong vòng manager-notify cho b02: b02 bị exclude bởi user_id <> v_member.user_id
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE tenant_id = 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01'
      AND user_id   = 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380b02'
      AND type      = 'schedule_missed'
      AND message LIKE '%ACEM Manager%'  -- notification về chính Manager1
  ),
  'T9: Manager không nhận self-notify (user_id <> v_member.user_id guard hoạt động)'
);

-- T10: Creation path — function tạo schedule_weeks khi chưa có record
-- Dùng tuần 2026-04-13 (không có fixture pre-populate)
DO $$ BEGIN PERFORM public.auto_create_missing_schedules('2026-04-13'); END $$;

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.schedule_weeks
    WHERE tenant_id = 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01'
      AND week_of   = '2026-04-13'
  ),
  'T10: function INSERT schedule_weeks record mới khi chưa tồn tại (creation path)'
);

-- T11: Cross-tenant isolation — Tenant2 member nhận đúng tenant_id, không leak sang Tenant1
-- (T2 đã gọi function cho '2026-04-06' xử lý ALL tenants — Tenant2 cũng được xử lý)
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.notifications
    WHERE tenant_id = 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a01'
      AND user_id   = 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380b01'
      AND type      = 'schedule_missed'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE tenant_id = 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01'
      AND user_id   = 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380b01'
  ),
  'T11: cross-tenant isolation — Tenant2 member nhận notification đúng tenant_id, không leak sang Tenant1'
);

-- T12: Notification idempotency — gọi function lần 2 không tạo duplicate notifications
-- NOT EXISTS guard với window 2 days ngăn insert khi notification đã tồn tại
DO $$ BEGIN PERFORM public.auto_create_missing_schedules('2026-04-06'); END $$;

SELECT is(
  (SELECT count(*)::int FROM public.notifications
   WHERE tenant_id = 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01'
     AND user_id   = 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380b03'
     AND type      = 'schedule_missed'),
  1,
  'T12: gọi function lần 2 không tạo duplicate notification cho Member1 (idempotency guard)'
);

SELECT * FROM finish();
ROLLBACK;
