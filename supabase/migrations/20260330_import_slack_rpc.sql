-- Migration: Story 11.1 — AI Import Daily Reports
-- RPC function để import parsed daily reports từ Slack/Discord/MS Teams export.
-- Upsert mode: skip (giữ nguyên) hoặc overwrite (xóa + insert mới).

-- ================================================================
-- 1. Audit log type (reuse existing member_audit_logs table)
-- ================================================================
-- Import action sử dụng member_audit_logs với action = 'ai_import'

-- ================================================================
-- 2. RPC: import_slack_reports
-- SECURITY DEFINER để bypass RLS nhưng vẫn kiểm tra app-level auth
-- Batch size: 50 rows/batch
-- ================================================================

CREATE OR REPLACE FUNCTION public.import_slack_reports(
  p_reports             jsonb,
  p_mode                text,
  p_tenant_id           uuid,
  p_import_only_mapped boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_report          jsonb;
  v_user_id         uuid;
  v_report_date     date;
  v_completed_tasks jsonb;
  v_inprogress_tasks jsonb;
  v_plan            text;
  v_blockers        text;
  v_hours_logged    numeric(4,1);
  v_existing_id     uuid;
  v_inserted_id     uuid;
  v_count_imported  int := 0;
  v_count_skipped   int := 0;
  v_count_overwritten int := 0;
  v_errors          jsonb := '[]'::jsonb;
  v_row_key         text;
  v_batch_counter   int := 0;
  v_total_hours     numeric(4,1);
  v_task            jsonb;
BEGIN
  -- ── Authorization: owner/manager only ──────────────────────────
  -- Must be member of the target tenant AND have owner/manager role in THAT tenant.
  -- is_tenant_manager() checks current_tenant_id() which reads from JWT claims.
  IF public.current_tenant_id() IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'Permission denied: tenant mismatch';
  END IF;

  IF NOT public.is_tenant_manager() THEN
    RAISE EXCEPTION 'Permission denied: only owner or manager can import reports';
  END IF;

  -- ── Validate mode ───────────────────────────────────────────────
  IF p_mode NOT IN ('skip', 'overwrite') THEN
    RAISE EXCEPTION 'Invalid mode: must be "skip" or "overwrite"';
  END IF;

  -- ── Process each report ────────────────────────────────────────
  FOR v_report IN SELECT * FROM jsonb_array_elements(p_reports)
  LOOP
    v_batch_counter := v_batch_counter + 1;

    -- Extract fields
    v_user_id         := (v_report ->> 'user_id')::uuid;
    v_report_date     := (v_report ->> 'report_date')::date;
    v_completed_tasks  := COALESCE(v_report -> 'completed_tasks', '[]'::jsonb);
    v_inprogress_tasks := COALESCE(v_report -> 'in_progress_tasks', '[]'::jsonb);
    v_plan            := NULLIF(TRIM(v_report ->> 'plan_for_tomorrow'), '');
    v_blockers        := NULLIF(TRIM(v_report ->> 'blockers'), '');

    -- Compute hours_logged = sum of ALL task hours (completed + in_progress)
    v_total_hours := 0;
    FOR v_task IN SELECT * FROM jsonb_array_elements(v_completed_tasks)
    LOOP
      v_total_hours := v_total_hours + COALESCE((v_task ->> 'hours')::numeric, 0);
    END LOOP;
    FOR v_task IN SELECT * FROM jsonb_array_elements(v_inprogress_tasks)
    LOOP
      v_total_hours := v_total_hours + COALESCE((v_task ->> 'hours')::numeric, 0);
    END LOOP;
    v_hours_logged := v_total_hours;

    -- Build row key for error reporting
    v_row_key := COALESCE(v_user_id::text, '?') || '|' || COALESCE(v_report_date::text, '?');

    -- ── Skip unmapped (user_id is null) if import_only_mapped ─────
    IF p_import_only_mapped AND v_user_id IS NULL THEN
      v_count_skipped := v_count_skipped + 1;
      CONTINUE;
    END IF;

    -- ── Skip if no user_id ───────────────────────────────────────
    IF v_user_id IS NULL THEN
      v_errors := v_errors || jsonb_build_object(
        'rowKey', v_row_key,
        'message', 'Missing user_id — author not mapped'
      )::jsonb;
      CONTINUE;
    END IF;

    -- ── Check if report already exists ───────────────────────────
    SELECT id INTO v_existing_id
    FROM public.daily_reports
    WHERE tenant_id  = p_tenant_id
      AND user_id    = v_user_id
      AND report_date = v_report_date;

    IF v_existing_id IS NOT NULL THEN
      IF p_mode = 'skip' THEN
        -- Skip: keep existing data
        v_count_skipped := v_count_skipped + 1;
        CONTINUE;
      ELSE
        -- Overwrite: DELETE existing + INSERT new
        DELETE FROM public.report_tasks WHERE report_id = v_existing_id;
        DELETE FROM public.daily_reports WHERE id = v_existing_id;
        v_count_overwritten := v_count_overwritten + 1;
      END IF;
    END IF;

    -- ── Insert daily_report ─────────────────────────────────────
    BEGIN
      INSERT INTO public.daily_reports (
        tenant_id, user_id, report_date, hours_logged,
        plan_for_tomorrow, blockers, submitted_at
      )
      VALUES (
        p_tenant_id, v_user_id, v_report_date, v_hours_logged,
        v_plan, v_blockers, now()
      )
      RETURNING id INTO v_inserted_id;

      -- ── Insert report_tasks (completed) ────────────────────────
      IF jsonb_array_length(v_completed_tasks) > 0 THEN
        INSERT INTO public.report_tasks (
          tenant_id, report_id, user_id, task_type,
          description, hours, sort_order
        )
        SELECT
          p_tenant_id,
          v_inserted_id,
          v_user_id,
          'completed',
          TRIM(t.value ->> 'description'),
          COALESCE(NULLIF(TRIM(t.value ->> 'hours'), '')::numeric, 0),
          t.ordinality - 1
        FROM jsonb_array_elements(v_completed_tasks)
          WITH ORDINALITY AS t(value, ordinality)
        WHERE TRIM(COALESCE(t.value ->> 'description', '')) <> ''
          AND TRIM(COALESCE(t.value ->> 'description', '')) NOT IN ('N/A', 'n/a', 'N/a');
      END IF;

      -- ── Insert report_tasks (in_progress) ───────────────────────
      IF jsonb_array_length(v_inprogress_tasks) > 0 THEN
        INSERT INTO public.report_tasks (
          tenant_id, report_id, user_id, task_type,
          description, hours, sort_order
        )
        SELECT
          p_tenant_id,
          v_inserted_id,
          v_user_id,
          'in_progress',
          TRIM(t.value ->> 'description'),
          COALESCE(NULLIF(TRIM(t.value ->> 'hours'), '')::numeric, 0),
          t.ordinality - 1
        FROM jsonb_array_elements(v_inprogress_tasks)
          WITH ORDINALITY AS t(value, ordinality)
        WHERE TRIM(COALESCE(t.value ->> 'description', '')) <> ''
          AND TRIM(COALESCE(t.value ->> 'description', '')) NOT IN ('N/A', 'n/a', 'N/a');
      END IF;

      v_count_imported := v_count_imported + 1;

    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_object(
        'rowKey', v_row_key,
        'message', SQLERRM
      )::jsonb;
    END;

    -- ── Batch flush every 50 rows ────────────────────────────────
    IF v_batch_counter % 50 = 0 THEN
      PERFORM pg_sleep(0.01); -- Small yield to prevent lock contention
    END IF;
  END LOOP;

  -- ── Audit log ─────────────────────────────────────────────────
  INSERT INTO public.member_audit_logs (tenant_id, actor_id, action, details)
  VALUES (
    p_tenant_id,
    auth.uid(),
    'ai_import',
    jsonb_build_object(
      'imported',     v_count_imported,
      'skipped',      v_count_skipped,
      'overwritten',  v_count_overwritten,
      'mode',         p_mode,
      'totalReports', jsonb_array_length(p_reports),
      'errors',       v_errors
    )
  );

  -- ── Return result ─────────────────────────────────────────────
  RETURN jsonb_build_object(
    'imported',    v_count_imported,
    'skipped',     v_count_skipped,
    'overwritten', v_count_overwritten,
    'errors',      v_errors
  );
END;
$$;

-- ================================================================
-- 3. RLS for daily_reports INSERT (for this function's use)
-- daily_reports INSERT via SECURITY DEFINER function is allowed
-- No additional policy needed since SECURITY DEFINER bypasses RLS
-- The app-level auth check inside the function provides protection
-- ================================================================
