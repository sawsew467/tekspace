-- =============================================================
-- pgTAP tests for Epic 9 migrations
-- - Story 9.2: daily_reports/report_tasks new columns
-- - Story 9.3: incident_resolutions RLS
-- =============================================================

BEGIN;

SELECT plan(12);

-- =============================================================
-- FIXTURES
-- =============================================================

-- Auth users
INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin)
VALUES
  ('e9000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'e9_owner@test.com',   '', '2026-01-01 00:00:00+00', now(), now(), '{}', '{}', false),
  ('e9000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'e9_manager@test.com', '', '2026-01-01 00:00:00+00', now(), now(), '{}', '{}', false),
  ('e9000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'e9_member1@test.com', '', '2026-01-01 00:00:00+00', now(), now(), '{}', '{}', false),
  ('e9000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'e9_member2@test.com', '', '2026-01-01 00:00:00+00', now(), now(), '{}', '{}', false),
  ('e9000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'e9_outsider@test.com', '', '2026-01-01 00:00:00+00', now(), now(), '{}', '{}', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, full_name)
VALUES
  ('e9000000-0000-4000-8000-000000000001', 'Epic9 Owner'),
  ('e9000000-0000-4000-8000-000000000002', 'Epic9 Manager'),
  ('e9000000-0000-4000-8000-000000000003', 'Epic9 Member 1'),
  ('e9000000-0000-4000-8000-000000000004', 'Epic9 Member 2'),
  ('e9000000-0000-4000-8000-000000000005', 'Epic9 Outsider')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

ALTER TABLE public.tenants DISABLE TRIGGER on_tenant_created;
INSERT INTO public.tenants (id, name)
VALUES
  ('f9000000-0000-4000-8000-000000000001', 'Epic9 Tenant A'),
  ('f9000000-0000-4000-8000-000000000002', 'Epic9 Tenant B')
ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.tenants ENABLE TRIGGER on_tenant_created;

INSERT INTO public.tenant_members (tenant_id, user_id, role, status)
VALUES
  ('f9000000-0000-4000-8000-000000000001', 'e9000000-0000-4000-8000-000000000001', 'owner',   'active'),
  ('f9000000-0000-4000-8000-000000000001', 'e9000000-0000-4000-8000-000000000002', 'manager', 'active'),
  ('f9000000-0000-4000-8000-000000000001', 'e9000000-0000-4000-8000-000000000003', 'member',  'active'),
  ('f9000000-0000-4000-8000-000000000001', 'e9000000-0000-4000-8000-000000000004', 'member',  'active'),
  ('f9000000-0000-4000-8000-000000000002', 'e9000000-0000-4000-8000-000000000005', 'owner',   'active')
ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- Incident fixture (tenant A, victim = member1, logged by manager)
INSERT INTO public.incidents (id, tenant_id, member_id, manager_id, category, note)
VALUES (
  'a9000000-0000-4000-8000-000000000001',
  'f9000000-0000-4000-8000-000000000001',
  'e9000000-0000-4000-8000-000000000003',
  'e9000000-0000-4000-8000-000000000002',
  'missed_report',
  'Epic9 RLS test incident'
)
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- HELPERS
-- =============================================================

CREATE OR REPLACE FUNCTION public._epic9_set_auth(p_user_id uuid, p_tenant_id uuid)
RETURNS void LANGUAGE sql AS $$
  SELECT set_config(
    'request.jwt.claims',
    json_build_object(
      'sub',              p_user_id::text,
      'role',             'authenticated',
      'aud',              'authenticated',
      'active_tenant_id', p_tenant_id::text
    )::text,
    true
  );
$$;

-- =============================================================
-- TEST SECTION 1: incident_resolutions (Story 9.3)
-- =============================================================

-- 1) Manager can resolve
SELECT public._epic9_set_auth(
  'e9000000-0000-4000-8000-000000000002'::uuid,
  'f9000000-0000-4000-8000-000000000001'::uuid
);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $sql$
    INSERT INTO public.incident_resolutions (tenant_id, incident_id, outcome, note, resolved_by)
    VALUES (
      'f9000000-0000-4000-8000-000000000001',
      'a9000000-0000-4000-8000-000000000001',
      'upheld',
      'Resolved by manager',
      'e9000000-0000-4000-8000-000000000002'
    )
  $sql$,
  '1. Manager CÓ THỂ INSERT incident_resolution'
);

RESET ROLE;

-- 2) Member cannot resolve
SELECT public._epic9_set_auth(
  'e9000000-0000-4000-8000-000000000003'::uuid,
  'f9000000-0000-4000-8000-000000000001'::uuid
);
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $sql$
    INSERT INTO public.incident_resolutions (tenant_id, incident_id, outcome, resolved_by)
    VALUES (
      'f9000000-0000-4000-8000-000000000001',
      'a9000000-0000-4000-8000-000000000001',
      'dismissed',
      'e9000000-0000-4000-8000-000000000003'
    )
  $sql$,
  '42501', NULL,
  '2. Member KHÔNG THỂ INSERT incident_resolution'
);

-- 3) Victim member can read own incident resolution
SELECT is(
  (SELECT count(*)::int FROM public.incident_resolutions
   WHERE incident_id = 'a9000000-0000-4000-8000-000000000001'),
  1,
  '3. Victim member THẤY incident_resolution của incident mình'
);

RESET ROLE;

-- 4) Non-victim member in same tenant cannot read
SELECT public._epic9_set_auth(
  'e9000000-0000-4000-8000-000000000004'::uuid,
  'f9000000-0000-4000-8000-000000000001'::uuid
);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*)::int FROM public.incident_resolutions
   WHERE incident_id = 'a9000000-0000-4000-8000-000000000001'),
  0,
  '4. Non-victim member KHÔNG THẤY incident_resolution'
);

RESET ROLE;

-- 5) Outsider tenant cannot read
SELECT public._epic9_set_auth(
  'e9000000-0000-4000-8000-000000000005'::uuid,
  'f9000000-0000-4000-8000-000000000002'::uuid
);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*)::int FROM public.incident_resolutions
   WHERE incident_id = 'a9000000-0000-4000-8000-000000000001'),
  0,
  '5. User tenant khác KHÔNG THẤY incident_resolution (tenant isolation)'
);

RESET ROLE;

-- =============================================================
-- TEST SECTION 2: daily_reports + report_tasks new columns (Story 9.2)
-- =============================================================

-- 6) Member can insert daily_report with new nullable columns
SELECT public._epic9_set_auth(
  'e9000000-0000-4000-8000-000000000003'::uuid,
  'f9000000-0000-4000-8000-000000000001'::uuid
);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $sql$
    INSERT INTO public.daily_reports (
      id, tenant_id, user_id, report_date, hours_logged, submitted_at, plan_for_tomorrow, blockers
    ) VALUES (
      'b9000000-0000-4000-8000-000000000001',
      'f9000000-0000-4000-8000-000000000001',
      'e9000000-0000-4000-8000-000000000003',
      CURRENT_DATE,
      8,
      now(),
      'Hoàn thiện incident review UI',
      'Đợi feedback UX'
    )
  $sql$,
  '6. Member CÓ THỂ INSERT daily_report với plan_for_tomorrow + blockers'
);

-- 7) Owner/manager can read member report including new columns
SELECT public._epic9_set_auth(
  'e9000000-0000-4000-8000-000000000002'::uuid,
  'f9000000-0000-4000-8000-000000000001'::uuid
);

SELECT is(
  (SELECT plan_for_tomorrow FROM public.daily_reports
   WHERE id = 'b9000000-0000-4000-8000-000000000001'),
  'Hoàn thiện incident review UI',
  '7. Manager THẤY plan_for_tomorrow'
);

SELECT is(
  (SELECT blockers FROM public.daily_reports
   WHERE id = 'b9000000-0000-4000-8000-000000000001'),
  'Đợi feedback UX',
  '8. Manager THẤY blockers'
);

-- 9) Member inserts report_task with task_type=in_progress and project_tag
SELECT public._epic9_set_auth(
  'e9000000-0000-4000-8000-000000000003'::uuid,
  'f9000000-0000-4000-8000-000000000001'::uuid
);

SELECT lives_ok(
  $sql$
    INSERT INTO public.report_tasks (
      id, tenant_id, report_id, user_id, task_type, project_tag, description, sort_order, hours
    ) VALUES (
      'c9000000-0000-4000-8000-000000000001',
      'f9000000-0000-4000-8000-000000000001',
      'b9000000-0000-4000-8000-000000000001',
      'e9000000-0000-4000-8000-000000000003',
      'in_progress',
      'TekSpace',
      'Refactor dashboard cards',
      1,
      3
    )
  $sql$,
  '9. Member CÓ THỂ INSERT report_task với task_type=in_progress + project_tag'
);

-- 10) task_type check blocks invalid values
SELECT throws_ok(
  $sql$
    INSERT INTO public.report_tasks (
      tenant_id, report_id, user_id, task_type, description, sort_order
    ) VALUES (
      'f9000000-0000-4000-8000-000000000001',
      'b9000000-0000-4000-8000-000000000001',
      'e9000000-0000-4000-8000-000000000003',
      'todo',
      'Invalid task type test',
      2
    )
  $sql$,
  '23514', NULL,
  '10. task_type CHECK chặn giá trị không hợp lệ'
);

-- Prepare another report owned by member2
RESET ROLE;
INSERT INTO public.daily_reports (
  id, tenant_id, user_id, report_date, hours_logged, submitted_at
) VALUES (
  'b9000000-0000-4000-8000-000000000002',
  'f9000000-0000-4000-8000-000000000001',
  'e9000000-0000-4000-8000-000000000004',
  CURRENT_DATE,
  5,
  now()
) ON CONFLICT (id) DO NOTHING;

-- 11) member1 cannot insert task for member2 report
SELECT public._epic9_set_auth(
  'e9000000-0000-4000-8000-000000000003'::uuid,
  'f9000000-0000-4000-8000-000000000001'::uuid
);
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $sql$
    INSERT INTO public.report_tasks (
      tenant_id, report_id, user_id, task_type, description, sort_order
    ) VALUES (
      'f9000000-0000-4000-8000-000000000001',
      'b9000000-0000-4000-8000-000000000002',
      'e9000000-0000-4000-8000-000000000004',
      'completed',
      'Try insert to other user report',
      0
    )
  $sql$,
  '42501', NULL,
  '11. Member KHÔNG INSERT được report_task cho report của user khác'
);

-- 12) member can still read own task row with new columns
SELECT is(
  (SELECT project_tag FROM public.report_tasks
   WHERE id = 'c9000000-0000-4000-8000-000000000001'),
  'TekSpace',
  '12. Member đọc được project_tag trên report_task của chính mình'
);

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
