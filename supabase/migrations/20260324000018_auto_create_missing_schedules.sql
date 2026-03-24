-- Migration: auto_create_missing_schedules — batch create empty schedules + notify
-- Story 2.4: Missed Deadline Auto-Handling
-- Called by Edge Function notify-schedule-change with action=auto_create_empty
-- Runs for ALL tenants (service role context — no RLS)

CREATE OR REPLACE FUNCTION public.auto_create_missing_schedules(p_week_of date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_tenant         RECORD;
  v_member         RECORD;
  v_week_id        uuid;
  v_week_locked    bool;
  v_deadline       timestamptz;
  v_deadline_date  date;
  v_offset         int;
  v_processed      int := 0;
BEGIN
  -- Validate: p_week_of phải là Monday (ISO week start)
  IF EXTRACT(DOW FROM p_week_of) <> 1 THEN
    RAISE EXCEPTION 'p_week_of phải là thứ Hai (Monday) — nhận được: % (DOW=%)',
      p_week_of, EXTRACT(DOW FROM p_week_of);
  END IF;

  FOR v_tenant IN
    SELECT id, timezone, schedule_deadline_day, schedule_deadline_hour
    FROM public.tenants
  LOOP
    -- Tính deadline (cùng công thức với get_or_create_schedule_week)
    v_offset       := ((v_tenant.schedule_deadline_day::int - 1 + 7) % 7) - 7;
    v_deadline_date := p_week_of + v_offset;
    v_deadline      := (
      v_deadline_date::text || ' ' ||
      lpad(v_tenant.schedule_deadline_hour::text, 2, '0') || ':59:00'
    )::timestamp AT TIME ZONE v_tenant.timezone;

    -- Upsert schedule_weeks (tạo nếu chưa có, bỏ qua nếu đã có)
    INSERT INTO public.schedule_weeks (tenant_id, week_of, deadline, is_locked)
    VALUES (v_tenant.id, p_week_of, v_deadline, false)
    ON CONFLICT (tenant_id, week_of) DO NOTHING;

    SELECT id, is_locked INTO v_week_id, v_week_locked
    FROM public.schedule_weeks
    WHERE tenant_id = v_tenant.id AND week_of = p_week_of;

    IF v_week_id IS NULL THEN
      CONTINUE;  -- defensive: không xảy ra, nhưng tránh null pointer
    END IF;

    -- Skip notifications nếu tuần đã bị lock — member không thể submit dù sao
    IF v_week_locked THEN
      CONTINUE;
    END IF;

    -- Với mỗi active member KHÔNG có slots trong tuần này → notify
    FOR v_member IN
      SELECT tm.user_id, u.full_name
      FROM public.tenant_members tm
      JOIN public.users u ON u.id = tm.user_id
      WHERE tm.tenant_id = v_tenant.id
        AND tm.status = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM public.schedule_slots ss
          WHERE ss.week_id   = v_week_id
            AND ss.user_id   = tm.user_id
            AND ss.tenant_id = v_tenant.id
        )
    LOOP
      -- Notify member về lịch trống
      -- Idempotent: skip nếu notification schedule_missed đã tồn tại trong 2 ngày qua
      INSERT INTO public.notifications (tenant_id, user_id, type, message, link_to)
      SELECT
        v_tenant.id,
        v_member.user_id,
        'schedule_missed',
        'Bạn chưa đăng ký lịch tuần này. Lịch trống đã được tạo — hãy cập nhật sớm nhất có thể.',
        '/schedule'
      WHERE NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.tenant_id  = v_tenant.id
          AND n.user_id    = v_member.user_id
          AND n.type       = 'schedule_missed'
          AND n.created_at >= now() - interval '2 days'
      );

      -- Notify tất cả managers/owners (không self-notify)
      -- Idempotent per manager+member: skip nếu đã notify về member này trong 2 ngày qua
      INSERT INTO public.notifications (tenant_id, user_id, type, message, link_to)
      SELECT
        v_tenant.id,
        tm.user_id,
        'schedule_missed',
        coalesce(v_member.full_name, 'Thành viên') || ' chưa đăng ký lịch tuần mới.',
        '/schedule'
      FROM public.tenant_members tm
      WHERE tm.tenant_id = v_tenant.id
        AND tm.role IN ('owner', 'manager')
        AND tm.status = 'active'
        AND tm.user_id <> v_member.user_id  -- không self-notify
        AND NOT EXISTS (
          SELECT 1 FROM public.notifications n
          WHERE n.tenant_id  = v_tenant.id
            AND n.user_id    = tm.user_id
            AND n.type       = 'schedule_missed'
            AND n.message    = coalesce(v_member.full_name, 'Thành viên') || ' chưa đăng ký lịch tuần mới.'
            AND n.created_at >= now() - interval '2 days'
        );

      v_processed := v_processed + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('processed_members', v_processed, 'week_of', p_week_of);
END;
$$;

-- Không cần GRANT authenticated — function chỉ được gọi từ Edge Function (service_role)
-- Service_role có quyền gọi tất cả function mặc định trong Supabase
