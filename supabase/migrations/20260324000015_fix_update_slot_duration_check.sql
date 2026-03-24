-- Fix: Thêm duration validation vào update_slot_with_reason
-- Trước đây thiếu IF duration < 30 check trước UPDATE → DB constraint 23514 thay vì P0001

CREATE OR REPLACE FUNCTION public.update_slot_with_reason(
  p_slot_id              uuid,
  p_new_start_time       timestamptz,
  p_new_duration_minutes smallint,
  p_reason               text,
  p_is_emergency_override boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_user_id       uuid;
  v_tenant_id     uuid;
  v_tenant_tz     text;
  v_new_slot_date date;
  v_slot          public.schedule_slots%ROWTYPE;
  v_changer_name  text;
BEGIN
  v_user_id   := auth.uid();
  v_tenant_id := public.current_tenant_id();

  IF v_user_id IS NULL OR v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Chưa xác thực — uid hoặc tenant_id bị null';
  END IF;

  -- Validate reason không rỗng
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'Lý do thay đổi là bắt buộc';
  END IF;

  -- Validate duration range (30–720 phút) — defense-in-depth trước khi UPDATE
  -- Phải check TRƯỚC khi UPDATE để trả về P0001 thay vì DB constraint 23514
  IF p_new_duration_minutes < 30 OR p_new_duration_minutes > 720 THEN
    RAISE EXCEPTION 'Thời lượng ca phải từ 30 đến 720 phút';
  END IF;

  -- Lấy slot — verify ownership + tenant
  SELECT * INTO v_slot
  FROM public.schedule_slots
  WHERE id        = p_slot_id
    AND user_id   = v_user_id
    AND tenant_id = v_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Slot không tồn tại hoặc bạn không có quyền chỉnh sửa';
  END IF;

  -- Deadline lock check (server-side enforcement)
  -- Client-side check là UX; đây là security boundary
  IF NOT p_is_emergency_override AND now() >= v_slot.start_time THEN
    RAISE EXCEPTION 'Slot này đã bị khóa. Dùng Emergency Override để thay đổi.';
  END IF;

  -- Tính slot_date mới từ new start_time theo tenant timezone
  -- DB trigger validate_slot_date sẽ kiểm tra lại sau UPDATE
  SELECT t.timezone INTO v_tenant_tz
  FROM public.tenants t
  WHERE t.id = v_tenant_id;

  IF v_tenant_tz IS NULL THEN
    v_tenant_tz := 'UTC';
  END IF;

  v_new_slot_date := (p_new_start_time AT TIME ZONE v_tenant_tz)::date;

  -- Update slot
  UPDATE public.schedule_slots
  SET
    start_time       = p_new_start_time,
    duration_minutes = p_new_duration_minutes,
    slot_date        = v_new_slot_date,
    updated_at       = now()
  WHERE id = p_slot_id;

  -- Audit trail
  INSERT INTO public.schedule_slot_changes (tenant_id, slot_id, changed_by, change_type, reason)
  VALUES (
    v_tenant_id,
    p_slot_id,
    v_user_id,
    CASE WHEN p_is_emergency_override THEN 'emergency_override'::public.slot_change_type
         ELSE 'updated'::public.slot_change_type END,
    p_reason
  );

  -- Lấy tên người thay đổi để ghi vào notification message
  SELECT full_name INTO v_changer_name
  FROM public.users
  WHERE id = v_user_id;

  -- Notify tất cả managers/owners trong tenant (không self-notify)
  INSERT INTO public.notifications (tenant_id, user_id, type, message, link_to)
  SELECT
    v_tenant_id,
    tm.user_id,
    'schedule_changed',
    CASE
      WHEN p_is_emergency_override
        THEN coalesce(v_changer_name, 'Thành viên') || ' đã dùng Emergency Override để thay đổi lịch. Lý do: ' || p_reason
      ELSE
        coalesce(v_changer_name, 'Thành viên') || ' đã thay đổi lịch làm việc. Lý do: ' || p_reason
    END,
    '/schedule'
  FROM public.tenant_members tm
  WHERE tm.tenant_id = v_tenant_id
    AND tm.role   IN ('owner', 'manager')
    AND tm.status  = 'active'
    AND tm.user_id <> v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_slot_with_reason(uuid, timestamptz, smallint, text, boolean) TO authenticated;
