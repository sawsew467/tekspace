-- Test Suite: Story 11.1 — AI Import Daily Reports RPC
-- Tests: R1–R10 (RPC), S1–S2 (RLS security)
-- Run with: psql ... -f supabase/tests/test_ai_import_rpc.sql

BEGIN;

-- ================================================================
-- SETUP: Create test users and tenant
-- Disable handle_new_tenant trigger (auth.uid() is NULL when running as postgres)
-- ================================================================

ALTER TABLE public.tenants DISABLE TRIGGER on_tenant_created;

-- 1. auth.users (FK source for public.users)
INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
VALUES
  ('00000000-0000-0000-0000-000000000011', 'authenticated', 'authenticated', 'owner@test.com',   '', '2026-01-01 00:00:00+00', now(), now(), '{}', '{}', false),
  ('00000000-0000-0000-0000-000000000012', 'authenticated', 'authenticated', 'manager@test.com', '', '2026-01-01 00:00:00+00', now(), now(), '{}', '{}', false),
  ('00000000-0000-0000-0000-000000000013', 'authenticated', 'authenticated', 'member@test.com',  '', '2026-01-01 00:00:00+00', now(), now(), '{}', '{}', false),
  ('00000000-0000-0000-0000-000000000099', 'authenticated', 'authenticated', 'wrong@test.com',   '', '2026-01-01 00:00:00+00', now(), now(), '{}', '{}', false)
ON CONFLICT (id) DO NOTHING;

-- 2. public.users
INSERT INTO public.users (id, full_name)
VALUES
  ('00000000-0000-0000-0000-000000000011', 'Test Owner'),
  ('00000000-0000-0000-0000-000000000012', 'Test Manager'),
  ('00000000-0000-0000-0000-000000000013', 'Test Member'),
  ('00000000-0000-0000-0000-000000000099', 'Wrong User')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

-- 3. Tenants
INSERT INTO public.tenants (id, name, timezone, daily_report_deadline_hour)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Test Tenant AI Import', 'Asia/Ho_Chi_Minh', 3::smallint),
  ('00000000-0000-0000-0000-000000000099', 'Other Tenant',          'Asia/Ho_Chi_Minh', 3::smallint)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.tenants ENABLE TRIGGER on_tenant_created;

-- 4. Tenant members
INSERT INTO public.tenant_members (tenant_id, user_id, role, status)
VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', 'owner',   'active'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', 'manager', 'active'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000013', 'member',  'active'),
  ('00000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000000099', 'owner',   'active')
ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- ================================================================
-- R1: Owner can import reports successfully
-- ================================================================

DO $$
DECLARE
  _owner_id  uuid := '00000000-0000-0000-0000-000000000011';
  _tenant_id uuid := '00000000-0000-0000-0000-000000000001';
  _result    jsonb;
BEGIN
  -- Simulate JWT with owner role for test tenant
  EXECUTE format('SET LOCAL request.jwt.claims = %L',
    '{"active_tenant_id":"' || _tenant_id || '","sub":"' || _owner_id || '","role":"owner","email":"owner@test.com"}');
  _result := public.import_slack_reports(
    jsonb_build_array(
      jsonb_build_object(
        'user_id', _owner_id::text,
        'report_date', '2026-03-25',
        'completed_tasks', jsonb_build_array(jsonb_build_object('description', 'Task A', 'hours', 2)),
        'in_progress_tasks', jsonb_build_array(jsonb_build_object('description', 'Task B', 'hours', 1)),
        'plan_for_tomorrow', 'Next task',
        'blockers', NULL
      )
    ),
    'skip',
    _tenant_id,
    false
  );
  IF (_result->>'imported')::int != 1 THEN RAISE EXCEPTION 'R1 FAILED: got %', _result; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.daily_reports WHERE tenant_id = _tenant_id AND user_id = _owner_id AND report_date = '2026-03-25') THEN
    RAISE EXCEPTION 'R1 FAILED: Report not inserted';
  END IF;
  RAISE NOTICE 'R1 PASSED: Owner can import reports';
END $$;

-- ================================================================
-- R2: hours_logged = sum of completed + in_progress tasks
-- ================================================================

DO $$
DECLARE
  _owner_id  uuid := '00000000-0000-0000-0000-000000000011';
  _tenant_id uuid := '00000000-0000-0000-0000-000000000001';
  _hours     numeric;
BEGIN
  EXECUTE format('SET LOCAL request.jwt.claims = %L',
    '{"active_tenant_id":"' || _tenant_id || '","sub":"' || _owner_id || '","role":"owner","email":"owner@test.com"}');
  SELECT hours_logged INTO _hours FROM public.daily_reports
  WHERE tenant_id = _tenant_id AND user_id = _owner_id AND report_date = '2026-03-25';
  IF _hours != 3 THEN RAISE EXCEPTION 'R2 FAILED: expected hours=3, got=%', _hours; END IF;
  RAISE NOTICE 'R2 PASSED: hours_logged = 3 (2 completed + 1 in_progress)';
END $$;

-- ================================================================
-- R3: Skip mode does not overwrite existing report
-- ================================================================

DO $$
DECLARE
  _owner_id  uuid := '00000000-0000-0000-0000-000000000011';
  _tenant_id uuid := '00000000-0000-0000-0000-000000000001';
  _result    jsonb;
BEGIN
  EXECUTE format('SET LOCAL request.jwt.claims = %L',
    '{"active_tenant_id":"' || _tenant_id || '","sub":"' || _owner_id || '","role":"owner","email":"owner@test.com"}');
  _result := public.import_slack_reports(
    jsonb_build_array(
      jsonb_build_object(
        'user_id', _owner_id::text,
        'report_date', '2026-03-25',
        'completed_tasks', jsonb_build_array(jsonb_build_object('description', 'Task X Ignored', 'hours', 99)),
        'in_progress_tasks', '[]'::jsonb,
        'plan_for_tomorrow', NULL,
        'blockers', NULL
      )
    ),
    'skip', _tenant_id, false
  );
  IF (_result->>'skipped')::int != 1 THEN RAISE EXCEPTION 'R3 FAILED: expected skipped=1, got %', _result; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.report_tasks rt JOIN public.daily_reports dr ON dr.id = rt.report_id
    WHERE dr.tenant_id = _tenant_id AND dr.user_id = _owner_id AND dr.report_date = '2026-03-25' AND rt.description = 'Task A') THEN
    RAISE EXCEPTION 'R3 FAILED: Original task was overwritten';
  END IF;
  RAISE NOTICE 'R3 PASSED: Skip mode preserves existing report';
END $$;

-- ================================================================
-- R4: Overwrite mode replaces existing report
-- ================================================================

DO $$
DECLARE
  _owner_id  uuid := '00000000-0000-0000-0000-000000000011';
  _tenant_id uuid := '00000000-0000-0000-0000-000000000001';
  _result    jsonb;
BEGIN
  EXECUTE format('SET LOCAL request.jwt.claims = %L',
    '{"active_tenant_id":"' || _tenant_id || '","sub":"' || _owner_id || '","role":"owner","email":"owner@test.com"}');
  _result := public.import_slack_reports(
    jsonb_build_array(
      jsonb_build_object(
        'user_id', _owner_id::text,
        'report_date', '2026-03-25',
        'completed_tasks', jsonb_build_array(jsonb_build_object('description', 'New Overwrite Task', 'hours', 5)),
        'in_progress_tasks', '[]'::jsonb,
        'plan_for_tomorrow', NULL,
        'blockers', NULL
      )
    ),
    'overwrite', _tenant_id, false
  );
  IF (_result->>'overwritten')::int != 1 THEN RAISE EXCEPTION 'R4 FAILED: expected overwritten=1, got %', _result; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.report_tasks rt JOIN public.daily_reports dr ON dr.id = rt.report_id
    WHERE dr.tenant_id = _tenant_id AND dr.user_id = _owner_id AND dr.report_date = '2026-03-25' AND rt.description = 'New Overwrite Task') THEN
    RAISE EXCEPTION 'R4 FAILED: New task not found after overwrite';
  END IF;
  RAISE NOTICE 'R4 PASSED: Overwrite mode replaces existing report';
END $$;

-- ================================================================
-- R5: N/A and empty tasks are not inserted
-- ================================================================

DO $$
DECLARE
  _owner_id  uuid := '00000000-0000-0000-0000-000000000011';
  _tenant_id uuid := '00000000-0000-0000-0000-000000000001';
  _task_count int;
BEGIN
  EXECUTE format('SET LOCAL request.jwt.claims = %L',
    '{"active_tenant_id":"' || _tenant_id || '","sub":"' || _owner_id || '","role":"owner","email":"owner@test.com"}');
  PERFORM public.import_slack_reports(
    jsonb_build_array(
      jsonb_build_object(
        'user_id', _owner_id::text,
        'report_date', '2026-03-26',
        'completed_tasks', jsonb_build_array(
          jsonb_build_object('description', 'Real Task', 'hours', 1),
          jsonb_build_object('description', 'N/A', 'hours', 0),
          jsonb_build_object('description', '', 'hours', 0),
          jsonb_build_object('description', '  N/A  ', 'hours', 0)
        ),
        'in_progress_tasks', jsonb_build_array(
          jsonb_build_object('description', 'N/A', 'hours', 2)
        ),
        'plan_for_tomorrow', NULL,
        'blockers', NULL
      )
    ),
    'skip', _tenant_id, false
  );
  SELECT COUNT(*) INTO _task_count FROM public.report_tasks rt
  JOIN public.daily_reports dr ON dr.id = rt.report_id
  WHERE dr.tenant_id = _tenant_id AND dr.user_id = _owner_id AND dr.report_date = '2026-03-26';
  IF _task_count != 1 THEN RAISE EXCEPTION 'R5 FAILED: expected 1 task (only Real Task), got=%', _task_count; END IF;
  RAISE NOTICE 'R5 PASSED: N/A and empty tasks are skipped';
END $$;

-- ================================================================
-- R6: plan_for_tomorrow and blockers are saved
-- ================================================================

DO $$
DECLARE
  _owner_id  uuid := '00000000-0000-0000-0000-000000000011';
  _tenant_id uuid := '00000000-0000-0000-0000-000000000001';
  _plan      text;
  _blockers  text;
BEGIN
  EXECUTE format('SET LOCAL request.jwt.claims = %L',
    '{"active_tenant_id":"' || _tenant_id || '","sub":"' || _owner_id || '","role":"owner","email":"owner@test.com"}');
  PERFORM public.import_slack_reports(
    jsonb_build_array(
      jsonb_build_object(
        'user_id', _owner_id::text,
        'report_date', '2026-03-27',
        'completed_tasks', '[]'::jsonb,
        'in_progress_tasks', '[]'::jsonb,
        'plan_for_tomorrow', 'Deploy to staging',
        'blockers', 'Waiting for API key'
      )
    ),
    'skip', _tenant_id, false
  );
  SELECT plan_for_tomorrow, blockers INTO _plan, _blockers FROM public.daily_reports
  WHERE tenant_id = _tenant_id AND user_id = _owner_id AND report_date = '2026-03-27';
  IF _plan != 'Deploy to staging' THEN RAISE EXCEPTION 'R6 FAILED: plan=%', _plan; END IF;
  IF _blockers != 'Waiting for API key' THEN RAISE EXCEPTION 'R6 FAILED: blockers=%', _blockers; END IF;
  RAISE NOTICE 'R6 PASSED: plan_for_tomorrow and blockers saved correctly';
END $$;

-- ================================================================
-- R7: import_only_mapped skips null user_id rows
-- ================================================================

DO $$
DECLARE
  _tenant_id uuid := '00000000-0000-0000-0000-000000000001';
  _result    jsonb;
BEGIN
  EXECUTE format('SET LOCAL request.jwt.claims = %L',
    '{"active_tenant_id":"' || _tenant_id || '","sub":"00000000-0000-0000-0000-000000000011","role":"owner","email":"owner@test.com"}');
  _result := public.import_slack_reports(
    jsonb_build_array(
      jsonb_build_object(
        'user_id', NULL,
        'report_date', '2026-03-28',
        'completed_tasks', jsonb_build_array(jsonb_build_object('description', 'Unmapped Task', 'hours', 1)),
        'in_progress_tasks', '[]'::jsonb,
        'plan_for_tomorrow', NULL,
        'blockers', NULL
      )
    ),
    'skip', _tenant_id, true
  );
  IF (_result->>'skipped')::int != 1 THEN RAISE EXCEPTION 'R7 FAILED: expected skipped=1, got %', _result; END IF;
  RAISE NOTICE 'R7 PASSED: import_only_mapped skips null user_id rows';
END $$;

-- ================================================================
-- R8: Error rows captured in result.errors
-- ================================================================

DO $$
DECLARE
  _tenant_id uuid := '00000000-0000-0000-0000-000000000001';
  _result    jsonb;
BEGIN
  EXECUTE format('SET LOCAL request.jwt.claims = %L',
    '{"active_tenant_id":"' || _tenant_id || '","sub":"00000000-0000-0000-0000-000000000011","role":"owner","email":"owner@test.com"}');
  _result := public.import_slack_reports(
    jsonb_build_array(
      jsonb_build_object(
        'user_id', NULL,
        'report_date', '2026-03-29',
        'completed_tasks', '[]'::jsonb,
        'in_progress_tasks', '[]'::jsonb,
        'plan_for_tomorrow', NULL,
        'blockers', NULL
      )
    ),
    'skip', _tenant_id, false
  );
  IF jsonb_array_length(COALESCE(_result->'errors', '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'R8 FAILED: expected errors, got %', _result;
  END IF;
  RAISE NOTICE 'R8 PASSED: Error rows captured in result.errors';
END $$;

-- ================================================================
-- R9: Audit log inserted after import
-- ================================================================

DO $$
DECLARE
  _owner_id  uuid := '00000000-0000-0000-0000-000000000011';
  _tenant_id uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
  EXECUTE format('SET LOCAL request.jwt.claims = %L',
    '{"active_tenant_id":"' || _tenant_id || '","sub":"' || _owner_id || '","role":"owner","email":"owner@test.com"}');
  PERFORM public.import_slack_reports(
    jsonb_build_array(
      jsonb_build_object(
        'user_id', _owner_id::text,
        'report_date', '2026-03-28',
        'completed_tasks', jsonb_build_array(jsonb_build_object('description', 'Audit Test Task', 'hours', 1)),
        'in_progress_tasks', '[]'::jsonb,
        'plan_for_tomorrow', NULL,
        'blockers', NULL
      )
    ),
    'skip', _tenant_id, false
  );
  IF NOT EXISTS (SELECT 1 FROM public.member_audit_logs WHERE tenant_id = _tenant_id AND action = 'ai_import') THEN
    RAISE EXCEPTION 'R9 FAILED: Audit log not found';
  END IF;
  RAISE NOTICE 'R9 PASSED: Audit log inserted after import';
END $$;

-- ================================================================
-- R10: Manager can also import reports
-- ================================================================

DO $$
DECLARE
  _manager_id uuid := '00000000-0000-0000-0000-000000000012';
  _tenant_id   uuid := '00000000-0000-0000-0000-000000000001';
  _result      jsonb;
BEGIN
  EXECUTE format('SET LOCAL request.jwt.claims = %L',
    '{"active_tenant_id":"' || _tenant_id || '","sub":"' || _manager_id || '","role":"manager","email":"manager@test.com"}');
  _result := public.import_slack_reports(
    jsonb_build_array(
      jsonb_build_object(
        'user_id', _manager_id::text,
        'report_date', '2026-03-29',
        'completed_tasks', jsonb_build_array(jsonb_build_object('description', 'Manager Task', 'hours', 2)),
        'in_progress_tasks', '[]'::jsonb,
        'plan_for_tomorrow', NULL,
        'blockers', NULL
      )
    ),
    'skip', _tenant_id, false
  );
  IF (_result->>'imported')::int != 1 THEN RAISE EXCEPTION 'R10 FAILED: got %', _result; END IF;
  RAISE NOTICE 'R10 PASSED: Manager can import reports';
END $$;

-- ================================================================
-- S1: Member is denied import (permission denied)
-- Simulate JWT claims with member role
-- ================================================================

DO $$
DECLARE
  _member_id  uuid := '00000000-0000-0000-0000-000000000013';
  _tenant_id  uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
  -- Set JWT claims simulating authenticated user with member role
  EXECUTE format('SET LOCAL request.jwt.claims = %L',
    '{"active_tenant_id":"' || _tenant_id || '","sub":"' || _member_id || '","role":"member","email":"member@test.com"}');
  BEGIN
    PERFORM public.import_slack_reports(
      jsonb_build_array(
        jsonb_build_object(
          'user_id', _member_id::text,
          'report_date', '2026-03-30',
          'completed_tasks', '[]'::jsonb,
          'in_progress_tasks', '[]'::jsonb,
          'plan_for_tomorrow', NULL,
          'blockers', NULL
        )
      ),
      'skip', _tenant_id, false
    );
    RAISE EXCEPTION 'S1 FAILED: Member should not be able to import';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Permission denied%' THEN RAISE EXCEPTION 'S1 FAILED: Wrong error: %', SQLERRM; END IF;
  END;
  RAISE NOTICE 'S1 PASSED: Member is denied import';
END $$;

-- ================================================================
-- S2: Wrong-tenant user is denied import
-- Simulate JWT claims with owner role from OTHER tenant
-- ================================================================

DO $$
DECLARE
  _wrong_user_id  uuid := '00000000-0000-0000-0000-000000000099';
  _wrong_tenant_id uuid := '00000000-0000-0000-0000-000000000099';
  _test_tenant_id uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
  -- Simulate: user from wrong_tenant trying to import into test_tenant
  EXECUTE format('SET LOCAL request.jwt.claims = %L',
    '{"active_tenant_id":"' || _wrong_tenant_id || '","sub":"' || _wrong_user_id || '","role":"owner","email":"wrong@test.com"}');
  BEGIN
    PERFORM public.import_slack_reports(
      jsonb_build_array(
        jsonb_build_object(
          'user_id', _wrong_user_id::text,
          'report_date', '2026-03-30',
          'completed_tasks', '[]'::jsonb,
          'in_progress_tasks', '[]'::jsonb,
          'plan_for_tomorrow', NULL,
          'blockers', NULL
        )
      ),
      'skip', _test_tenant_id, false
    );
    RAISE EXCEPTION 'S2 FAILED: Wrong-tenant user should not be able to import';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Permission denied%' THEN RAISE EXCEPTION 'S2 FAILED: Wrong error: %', SQLERRM; END IF;
  END;
  RAISE NOTICE 'S2 PASSED: Wrong-tenant user is denied import';
END $$;

-- ================================================================
-- CLEANUP
-- ================================================================

DELETE FROM public.report_tasks WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM public.daily_reports WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM public.member_audit_logs WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM public.tenant_members WHERE tenant_id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000099'
);
DELETE FROM public.users WHERE id IN (
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000012',
  '00000000-0000-0000-0000-000000000013',
  '00000000-0000-0000-0000-000000000099'
);
DELETE FROM public.tenants WHERE id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000099'
);
DELETE FROM auth.users WHERE id IN (
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000012',
  '00000000-0000-0000-0000-000000000013',
  '00000000-0000-0000-0000-000000000099'
);

COMMIT;
