-- pgTAP tests for update_slot_with_reason + delete_slot_with_reason
-- File: supabase/tests/test_schedule_change_rpcs.sql
-- Story 2.3: Schedule Change & Deadline Lock

BEGIN;

SELECT plan(17);

-- =============================================================
-- FIXTURES
-- =============================================================

-- UUIDs tách biệt với các test file khác
-- Tenant : a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01
-- Owner  : b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b01
-- Member : b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b02
-- Manager: b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b03

-- Auth users
INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
VALUES
  ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b01', 'authenticated', 'authenticated', 'owner_rpc@test.com', '', '2026-01-01 00:00:00+00', now(), now(), '{}', '{}', false),
  ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b02', 'authenticated', 'authenticated', 'member_rpc@test.com', '', '2026-01-01 00:00:00+00', now(), now(), '{}', '{}', false),
  ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b03', 'authenticated', 'authenticated', 'manager_rpc@test.com', '', '2026-01-01 00:00:00+00', now(), now(), '{}', '{}', false)
ON CONFLICT (id) DO NOTHING;

-- public.users
INSERT INTO public.users (id, full_name)
VALUES
  ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b01', 'RPC Test Owner'),
  ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b02', 'RPC Test Member'),
  ('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b03', 'RPC Test Manager')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

-- Tenant
ALTER TABLE public.tenants DISABLE TRIGGER on_tenant_created;
INSERT INTO public.tenants (id, name, timezone, schedule_deadline_day, schedule_deadline_hour)
VALUES ('a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'RPC Test Tenant', 'Asia/Ho_Chi_Minh', 0, 23)
ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.tenants ENABLE TRIGGER on_tenant_created;

-- Tenant members
INSERT INTO public.tenant_members (tenant_id, user_id, role, status)
VALUES
  ('a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b01', 'owner',   'active'),
  ('a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b02', 'member',  'active'),
  ('a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b03', 'manager', 'active')
ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- Schedule week
-- Dùng Monday của tuần hiện tại để week_of luôn hợp lệ (DOW = 1)
INSERT INTO public.schedule_weeks (id, tenant_id, week_of, deadline, is_locked)
VALUES (
  'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380c01',
  'a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01',
  date_trunc('week', now())::date,
  now() + interval '30 days',
  false
) ON CONFLICT (tenant_id, week_of) DO UPDATE SET id = 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380c01';

-- Slot UNLOCKED (start_time 7 ngày sau — chưa bắt đầu)
-- slot_date tính động từ start_time trong tenant timezone (Asia/Ho_Chi_Minh)
-- để validate_slot_date trigger không fail
INSERT INTO public.schedule_slots (id, tenant_id, user_id, week_id, slot_date, start_time, duration_minutes)
VALUES (
  'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380d01',
  'a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01',
  'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b02',
  'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380c01',
  ((now() + interval '7 days') AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,
  now() + interval '7 days',
  120
) ON CONFLICT (id) DO NOTHING;

-- Slot LOCKED (start_time 1 giờ trước — đã bắt đầu)
-- slot_date tính động từ start_time trong tenant timezone
INSERT INTO public.schedule_slots (id, tenant_id, user_id, week_id, slot_date, start_time, duration_minutes)
VALUES (
  'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380d02',
  'a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01',
  'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b02',
  'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380c01',
  ((now() - interval '1 hour') AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,
  now() - interval '1 hour',
  60
) ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- HELPER: simulate JWT claims
-- =============================================================

CREATE OR REPLACE FUNCTION set_rpc_test_claims(p_user_id uuid, p_tenant_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object(
      'sub',              p_user_id::text,
      'role',             'authenticated',
      'active_tenant_id', p_tenant_id::text
    )::text,
    true
  );
END;
$$;

-- =============================================================
-- TESTS: update_slot_with_reason
-- =============================================================

SET LOCAL ROLE authenticated;
SELECT set_rpc_test_claims(
  'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b02',
  'a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01'
);

-- Test 1: Update unlocked slot thành công — không raise exception
SELECT lives_ok(
  $$ SELECT public.update_slot_with_reason(
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380d01'::uuid,
    (now() + interval '8 days')::timestamptz,
    90::smallint,
    'Điều chỉnh giờ làm',
    false
  ) $$,
  'Test 1: Update unlocked slot → thành công'
);

-- Test 2: Verify slot đã được update đúng duration
SELECT is(
  (SELECT duration_minutes FROM public.schedule_slots WHERE id = 'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380d01'),
  90::smallint,
  'Test 2: duration_minutes đã được cập nhật thành 90'
);

-- Test 3: Audit trail được ghi vào schedule_slot_changes
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.schedule_slot_changes
    WHERE slot_id = 'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380d01'
      AND change_type = 'updated'
      AND reason = 'Điều chỉnh giờ làm'
  ),
  'Test 3: schedule_slot_changes ghi change_type=updated + reason đúng'
);

-- Test 4: Notification gửi tới owner — check as postgres (bypass RLS) vì RLS notifications
-- chỉ cho user thấy notifications của chính mình
RESET ROLE;
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.notifications
    WHERE tenant_id = 'a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01'
      AND user_id = 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b01'
      AND type = 'schedule_changed'
  ),
  'Test 4: Notification gửi tới owner sau khi update'
);
SET LOCAL ROLE authenticated;
SELECT set_rpc_test_claims(
  'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b02',
  'a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01'
);

-- Test 5: Update slot locked mà không có emergency override → exception
SELECT throws_ok(
  $$ SELECT public.update_slot_with_reason(
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380d02'::uuid,
    (now() + interval '1 hour')::timestamptz,
    60::smallint,
    'Thử update slot đã lock',
    false
  ) $$,
  'P0001',
  'Slot này đã bị khóa. Dùng Emergency Override để thay đổi.',
  'Test 5: Update locked slot (no override) → exception'
);

-- Test 6: Emergency Override trên locked slot → thành công
SELECT lives_ok(
  $$ SELECT public.update_slot_with_reason(
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380d02'::uuid,
    (now() - interval '30 minutes')::timestamptz,
    45::smallint,
    'Điều chỉnh khẩn cấp',
    true
  ) $$,
  'Test 6: Emergency Override trên locked slot → thành công'
);

-- Test 7: Emergency Override ghi change_type=emergency_override
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.schedule_slot_changes
    WHERE slot_id = 'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380d02'
      AND change_type = 'emergency_override'
      AND reason = 'Điều chỉnh khẩn cấp'
  ),
  'Test 7: schedule_slot_changes ghi change_type=emergency_override cho emergency'
);

-- Test 8: Reason rỗng → exception
SELECT throws_ok(
  $$ SELECT public.update_slot_with_reason(
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380d01'::uuid,
    (now() + interval '9 days')::timestamptz,
    60::smallint,
    '   ',
    false
  ) $$,
  'P0001',
  'Lý do thay đổi là bắt buộc',
  'Test 8: Reason rỗng/whitespace → exception'
);

-- Test 9: Duration ngoài range (< 30) → exception
SELECT throws_ok(
  $$ SELECT public.update_slot_with_reason(
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380d01'::uuid,
    (now() + interval '9 days')::timestamptz,
    15::smallint,
    'Test duration',
    false
  ) $$,
  'P0001',
  'Thời lượng ca phải từ 30 đến 720 phút',
  'Test 9: Duration < 30 → exception'
);

-- Test 10: Sai ownership (owner cố update slot của member) → exception
SELECT set_rpc_test_claims(
  'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b01',
  'a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01'
);
SELECT throws_ok(
  $$ SELECT public.update_slot_with_reason(
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380d01'::uuid,
    (now() + interval '10 days')::timestamptz,
    60::smallint,
    'Cố tình update slot người khác',
    false
  ) $$,
  'P0001',
  'Slot không tồn tại hoặc bạn không có quyền chỉnh sửa',
  'Test 10: Sai ownership → exception'
);

-- =============================================================
-- TESTS: delete_slot_with_reason
-- =============================================================

-- Chuyển lại context về member (chủ sở hữu slot)
SELECT set_rpc_test_claims(
  'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b02',
  'a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01'
);

-- Test 11: Delete locked slot không có emergency override → exception
SELECT throws_ok(
  $$ SELECT public.delete_slot_with_reason(
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380d02'::uuid,
    'Thử xóa slot đã lock',
    false
  ) $$,
  'P0001',
  'Slot này đã bị khóa. Dùng Emergency Override để xóa.',
  'Test 11: Delete locked slot (no override) → exception'
);

-- Test 12: Emergency delete trên locked slot → thành công
SELECT lives_ok(
  $$ SELECT public.delete_slot_with_reason(
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380d02'::uuid,
    'Xóa khẩn cấp — ca nhầm',
    true
  ) $$,
  'Test 12: Emergency delete locked slot → thành công'
);

-- Test 13: Slot đã bị xóa khỏi DB
SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.schedule_slots WHERE id = 'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380d02'),
  'Test 13: Slot đã xóa không còn tồn tại trong schedule_slots'
);

-- Test 14: Reason rỗng khi delete → exception
SELECT throws_ok(
  $$ SELECT public.delete_slot_with_reason(
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380d01'::uuid,
    '',
    false
  ) $$,
  'P0001',
  'Lý do xóa là bắt buộc',
  'Test 14: Delete với reason rỗng → exception'
);

-- =============================================================
-- P-7 ADDITIONAL TESTS
-- =============================================================

-- Test 15: Notification gửi tới manager (không chỉ owner)
-- Dùng postgres role để bypass RLS trên notifications (giống test 4)
RESET ROLE;
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.notifications
    WHERE tenant_id = 'a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01'
      AND user_id = 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b03'   -- manager_rpc@test.com
      AND type = 'schedule_changed'
  ),
  'Test 15: Notification gửi tới manager sau khi update (AC1 + AC3)'
);
SET LOCAL ROLE authenticated;
SELECT set_rpc_test_claims(
  'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b02',
  'a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01'
);

-- Test 16: Sai ownership khi delete — owner cố xóa slot của member → exception
SELECT set_rpc_test_claims(
  'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b01',  -- owner
  'a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01'
);
SELECT throws_ok(
  $$ SELECT public.delete_slot_with_reason(
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380d01'::uuid,
    'Cố tình xóa slot của người khác',
    false
  ) $$,
  'P0001',
  'Slot không tồn tại hoặc bạn không có quyền xóa',
  'Test 16: Sai ownership khi delete → exception (AC5)'
);

-- Test 17: Delete UNLOCKED slot với reason hợp lệ → thành công (AC4)
SELECT set_rpc_test_claims(
  'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b02',  -- member (chủ slot)
  'a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01'
);
SELECT lives_ok(
  $$ SELECT public.delete_slot_with_reason(
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380d01'::uuid,
    'Bận đột xuất — hủy ca',
    false
  ) $$,
  'Test 17: Delete unlocked slot với reason hợp lệ → thành công (AC4)'
);

SELECT finish();

ROLLBACK;
