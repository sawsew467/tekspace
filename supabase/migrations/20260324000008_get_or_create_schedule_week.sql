-- Migration: get_or_create_schedule_week — SECURITY DEFINER RPC
-- Members không thể INSERT vào schedule_weeks trực tiếp (RLS chặn).
-- Function này bypass RLS để tạo/lấy schedule_week cho tenant + week_of.
--
-- Deadline calculation:
--   schedule_deadline_day: 0=Sunday, 1=Monday, ..., 6=Saturday (PostgreSQL DOW)
--   week_of: always Monday (DOW=1)
--   formula: deadline_date = week_of + ((deadline_day - 1 + 7) % 7 - 7)
--     - deadline_day=0 (Sun): offset = (6)%7 - 7 = -1  → Sunday before Monday   ✓
--     - deadline_day=6 (Sat): offset = (5)%7 - 7 = -2  → Saturday before Monday ✓
--     - deadline_day=1 (Mon): offset = (0)%7 - 7 = -7  → Monday before Monday   ✓

CREATE OR REPLACE FUNCTION public.get_or_create_schedule_week(p_week_of date)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_tenant_id     uuid;
  v_week_id       uuid;
  v_deadline      timestamptz;
  v_deadline_day  smallint;
  v_deadline_hour smallint;
  v_tenant_tz     text;
  v_deadline_date date;
  v_offset        int;
BEGIN
  -- Validate: p_week_of phải là Monday (DOW = 1)
  IF EXTRACT(DOW FROM p_week_of) <> 1 THEN
    RAISE EXCEPTION 'p_week_of phải là thứ Hai (Monday) — nhận được %', p_week_of;
  END IF;

  v_tenant_id := public.current_tenant_id();
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'current_tenant_id() trả về NULL — JWT thiếu active_tenant_id';
  END IF;

  -- Lấy tenant config
  SELECT schedule_deadline_day, schedule_deadline_hour, timezone
  INTO   v_deadline_day, v_deadline_hour, v_tenant_tz
  FROM   public.tenants
  WHERE  id = v_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant % không tồn tại', v_tenant_id;
  END IF;

  -- Tính ngày deadline trong tuần trước week_of
  -- formula: offset = ((deadline_day - 1 + 7) % 7) - 7
  v_offset := ((v_deadline_day::int - 1 + 7) % 7) - 7;
  v_deadline_date := p_week_of + v_offset;

  -- Xây dựng deadline timestamp tại giờ deadline theo tenant timezone
  -- VD: deadline_date='2026-01-11', hour=23 → '2026-01-11 23:59:00' Asia/Ho_Chi_Minh
  v_deadline := (v_deadline_date::text || ' ' || lpad(v_deadline_hour::text, 2, '0') || ':59:00')::timestamp
                AT TIME ZONE v_tenant_tz;

  -- Upsert: tạo nếu chưa có, trả về id
  INSERT INTO public.schedule_weeks (tenant_id, week_of, deadline, is_locked)
  VALUES (v_tenant_id, p_week_of, v_deadline, false)
  ON CONFLICT (tenant_id, week_of) DO NOTHING
  RETURNING id INTO v_week_id;

  -- Nếu đã tồn tại (conflict → không insert) → lấy id
  IF v_week_id IS NULL THEN
    SELECT id INTO v_week_id
    FROM   public.schedule_weeks
    WHERE  tenant_id = v_tenant_id AND week_of = p_week_of;
  END IF;

  RETURN v_week_id;
END;
$$;

-- Cho phép authenticated users gọi function này
GRANT EXECUTE ON FUNCTION public.get_or_create_schedule_week(date) TO authenticated;
