-- Migration: upsert_week_slots — SECURITY DEFINER RPC (atomic delete + insert + audit)
--
-- Lý do: upsertWeekSlots trước đây dùng 3 DB calls riêng lẻ (delete → insert → audit).
-- Không có transaction → nếu insert thành công nhưng audit fail, slots tồn tại không có
-- audit trail. Worse: nếu delete thành công nhưng insert fail, user mất toàn bộ slots.
--
-- Function này wrap toàn bộ logic trong 1 plpgsql transaction để đảm bảo atomicity.
--
-- p_slots JSON format: [{slot_date, start_time, duration_minutes}, ...]

CREATE OR REPLACE FUNCTION public.upsert_week_slots(
  p_week_id uuid,
  p_slots   jsonb   -- mảng slot objects, có thể rỗng để xóa hết
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_user_id   uuid;
  v_tenant_id uuid;
BEGIN
  v_user_id   := auth.uid();
  v_tenant_id := public.current_tenant_id();

  IF v_user_id IS NULL OR v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Chưa xác thực — uid hoặc tenant_id bị null';
  END IF;

  -- Validate: week_id thuộc tenant hiện tại
  IF NOT EXISTS (
    SELECT 1 FROM public.schedule_weeks
    WHERE id = p_week_id AND tenant_id = v_tenant_id
  ) THEN
    RAISE EXCEPTION 'week_id % không thuộc tenant %', p_week_id, v_tenant_id;
  END IF;

  -- Validate: week không bị locked
  IF EXISTS (
    SELECT 1 FROM public.schedule_weeks
    WHERE id = p_week_id AND is_locked = true
  ) THEN
    RAISE EXCEPTION 'Lịch tuần này đã bị khóa, không thể thay đổi';
  END IF;

  -- 1. Xóa slots cũ của user trong tuần (atomic với bước 2+3)
  DELETE FROM public.schedule_slots
  WHERE week_id   = p_week_id
    AND user_id   = v_user_id
    AND tenant_id = v_tenant_id;

  -- 2+3. Insert slots mới + audit trail trong cùng CTE (chỉ nếu có slots)
  IF jsonb_array_length(p_slots) > 0 THEN
    WITH inserted AS (
      INSERT INTO public.schedule_slots (tenant_id, user_id, week_id, slot_date, start_time, duration_minutes)
      SELECT
        v_tenant_id,
        v_user_id,
        p_week_id,
        (s->>'slot_date')::date,
        (s->>'start_time')::timestamptz,
        (s->>'duration_minutes')::smallint
      FROM jsonb_array_elements(p_slots) AS s
      RETURNING id
    )
    INSERT INTO public.schedule_slot_changes (tenant_id, slot_id, changed_by, change_type, reason)
    SELECT v_tenant_id, id, v_user_id, 'created', ''
    FROM inserted;
  END IF;
END;
$$;

-- Cho phép authenticated users gọi function này
GRANT EXECUTE ON FUNCTION public.upsert_week_slots(uuid, jsonb) TO authenticated;
