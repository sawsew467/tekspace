-- Fix: Làm rõ nội dung notification khi schedule thay đổi
-- Thêm thông tin slot cụ thể (ngày, giờ, thời lượng) vào message
-- Ví dụ: "Nguyễn Văn A đã đổi ca T3 09:00 → 10:00 (2h). Lý do: ..."
--         "Nguyễn Văn A đã xóa ca T3 09:00–11:00. Lý do: ..."

-- Helper: format timestamptz thành "T2 08:00" theo tenant timezone
-- DOW: 0=CN, 1=T2, ..., 6=T7 (PostgreSQL extract dow)
CREATE OR REPLACE FUNCTION public.format_slot_label(
  p_ts timestamptz,
  p_tz text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER SET search_path = ''
AS $$
  SELECT
    CASE extract(dow FROM (p_ts AT TIME ZONE p_tz))::int
      WHEN 1 THEN 'T2'
      WHEN 2 THEN 'T3'
      WHEN 3 THEN 'T4'
      WHEN 4 THEN 'T5'
      WHEN 5 THEN 'T6'
      WHEN 6 THEN 'T7'
      WHEN 0 THEN 'CN'
    END
    || ' '
    || to_char(p_ts AT TIME ZONE p_tz, 'HH24:MI')
$$;

-- ================================================================
-- update_slot_with_reason — thêm slot time vào notification message
-- ================================================================
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
  v_old_label     text;
  v_new_label     text;
  v_new_end_label text;
  v_msg           text;
BEGIN
  v_user_id   := auth.uid();
  v_tenant_id := public.current_tenant_id();

  IF v_user_id IS NULL OR v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Chưa xác thực — uid hoặc tenant_id bị null';
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'Lý do thay đổi là bắt buộc';
  END IF;

  IF p_new_duration_minutes < 30 OR p_new_duration_minutes > 720 THEN
    RAISE EXCEPTION 'Thời lượng ca phải từ 30 đến 720 phút';
  END IF;

  SELECT * INTO v_slot
  FROM public.schedule_slots
  WHERE id        = p_slot_id
    AND user_id   = v_user_id
    AND tenant_id = v_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Slot không tồn tại hoặc bạn không có quyền chỉnh sửa';
  END IF;

  IF NOT p_is_emergency_override AND now() >= v_slot.start_time THEN
    RAISE EXCEPTION 'Slot này đã bị khóa. Dùng Emergency Override để thay đổi.';
  END IF;

  SELECT t.timezone INTO v_tenant_tz
  FROM public.tenants t
  WHERE t.id = v_tenant_id;

  IF v_tenant_tz IS NULL THEN
    RAISE WARNING 'Tenant % chưa cấu hình timezone — sử dụng UTC làm fallback.', v_tenant_id;
    v_tenant_tz := 'UTC';
  END IF;

  v_new_slot_date := (p_new_start_time AT TIME ZONE v_tenant_tz)::date;

  UPDATE public.schedule_slots
  SET
    start_time       = p_new_start_time,
    duration_minutes = p_new_duration_minutes,
    slot_date        = v_new_slot_date,
    updated_at       = now()
  WHERE id = p_slot_id;

  INSERT INTO public.schedule_slot_changes (tenant_id, slot_id, changed_by, change_type, reason)
  VALUES (
    v_tenant_id,
    p_slot_id,
    v_user_id,
    CASE WHEN p_is_emergency_override THEN 'emergency_override'::public.slot_change_type
         ELSE 'updated'::public.slot_change_type END,
    p_reason
  );

  SELECT full_name INTO v_changer_name
  FROM public.users
  WHERE id = v_user_id;

  -- Format slot labels để manager hiểu rõ thay đổi
  v_old_label     := public.format_slot_label(v_slot.start_time, v_tenant_tz);
  v_new_label     := public.format_slot_label(p_new_start_time, v_tenant_tz);
  v_new_end_label := to_char(
                       (p_new_start_time + (p_new_duration_minutes || ' minutes')::interval) AT TIME ZONE v_tenant_tz,
                       'HH24:MI'
                     );

  v_msg := coalesce(v_changer_name, 'Thành viên')
    || CASE
         WHEN p_is_emergency_override THEN ' (Emergency Override)'
         ELSE ''
       END
    || ' đã đổi ca '
    || v_old_label
    || ' → '
    || v_new_label
    || '–'
    || v_new_end_label
    || '. Lý do: '
    || p_reason;

  INSERT INTO public.notifications (tenant_id, user_id, type, message, link_to)
  SELECT
    v_tenant_id,
    tm.user_id,
    'schedule_changed',
    v_msg,
    '/dashboard'
  FROM public.tenant_members tm
  WHERE tm.tenant_id = v_tenant_id
    AND tm.role   IN ('owner', 'manager')
    AND tm.status  = 'active'
    AND tm.user_id <> v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_slot_with_reason(uuid, timestamptz, smallint, text, boolean) TO authenticated;

-- ================================================================
-- delete_slot_with_reason — thêm slot time vào notification message
-- ================================================================
CREATE OR REPLACE FUNCTION public.delete_slot_with_reason(
  p_slot_id              uuid,
  p_reason               text,
  p_is_emergency_override boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_user_id      uuid;
  v_tenant_id    uuid;
  v_tenant_tz    text;
  v_slot         public.schedule_slots%ROWTYPE;
  v_changer_name text;
  v_slot_label   text;
  v_end_label    text;
  v_msg          text;
BEGIN
  v_user_id   := auth.uid();
  v_tenant_id := public.current_tenant_id();

  IF v_user_id IS NULL OR v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Chưa xác thực — uid hoặc tenant_id bị null';
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'Lý do xóa là bắt buộc';
  END IF;

  SELECT * INTO v_slot
  FROM public.schedule_slots
  WHERE id        = p_slot_id
    AND user_id   = v_user_id
    AND tenant_id = v_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Slot không tồn tại hoặc bạn không có quyền xóa';
  END IF;

  IF NOT p_is_emergency_override AND now() >= v_slot.start_time THEN
    RAISE EXCEPTION 'Slot này đã bị khóa. Dùng Emergency Override để xóa.';
  END IF;

  SELECT full_name INTO v_changer_name
  FROM public.users
  WHERE id = v_user_id;

  SELECT t.timezone INTO v_tenant_tz
  FROM public.tenants t
  WHERE t.id = v_tenant_id;

  IF v_tenant_tz IS NULL THEN
    RAISE WARNING 'Tenant % chưa cấu hình timezone — sử dụng UTC làm fallback.', v_tenant_id;
    v_tenant_tz := 'UTC';
  END IF;

  -- Format slot label: "T3 09:00–11:00"
  v_slot_label := public.format_slot_label(v_slot.start_time, v_tenant_tz);
  v_end_label  := to_char(
                    (v_slot.start_time + (v_slot.duration_minutes || ' minutes')::interval) AT TIME ZONE v_tenant_tz,
                    'HH24:MI'
                  );

  v_msg := coalesce(v_changer_name, 'Thành viên')
    || CASE
         WHEN p_is_emergency_override THEN ' (Emergency Override)'
         ELSE ''
       END
    || ' đã xóa ca '
    || v_slot_label
    || '–'
    || v_end_label
    || '. Lý do: '
    || p_reason;

  INSERT INTO public.notifications (tenant_id, user_id, type, message, link_to)
  SELECT
    v_tenant_id,
    tm.user_id,
    'schedule_changed',
    v_msg,
    '/dashboard'
  FROM public.tenant_members tm
  WHERE tm.tenant_id = v_tenant_id
    AND tm.role   IN ('owner', 'manager')
    AND tm.status  = 'active'
    AND tm.user_id <> v_user_id;

  DELETE FROM public.schedule_slots
  WHERE id = p_slot_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Slot không còn tồn tại — có thể đã bị xóa trước đó';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_slot_with_reason(uuid, text, boolean) TO authenticated;
