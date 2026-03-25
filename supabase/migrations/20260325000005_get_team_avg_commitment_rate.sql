-- Story 3.3: Member Self-Dashboard
-- RPC trả về average commitment rate của những thành viên KHÁC (exclude caller) đã submit tuần này.
--
-- Thiết kế (sau code review fixes):
-- • INNER JOIN daily_reports  → chỉ tính người đã submit ít nhất 1 report tuần đó
--   (tránh kéo avg xuống vì người chưa submit bị tính là 0h)
-- • AND tm.user_id != auth.uid() → exclude caller khỏi COUNT và AVG
--   → avg_rate = "trung bình của những người khác", không back-calculable
-- • Threshold >= 4 trên client đảm bảo ít nhất 4 người khác có data trước khi hiển thị
--
-- SECURITY DEFINER bắt buộc: member RLS chỉ cho đọc user_id = auth.uid() trong daily_reports,
-- nhưng function cần đọc daily_reports của toàn team để tính aggregate.

CREATE OR REPLACE FUNCTION public.get_team_avg_commitment_rate(
  p_week_start date,
  p_week_end date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid;
  v_caller_id uuid;
  v_member_count integer;
  v_avg_rate numeric;
BEGIN
  v_tenant_id := public.current_tenant_id();
  v_caller_id := auth.uid();

  -- Tính trên những người KHÁC (exclude caller) đã submit ít nhất 1 report tuần này.
  -- INNER JOIN đảm bảo chỉ tính submitters — không kéo avg với người chưa báo cáo.
  SELECT
    COUNT(DISTINCT tm.user_id)::integer,
    AVG(
      dr.actual_hours::numeric /
      NULLIF(
        COALESCE(tm.committed_hours::numeric, t.default_committed_hours::numeric, 40),
        0
      )
    )
  INTO v_member_count, v_avg_rate
  FROM public.tenant_members tm
  JOIN public.tenants t ON t.id = tm.tenant_id AND t.id = v_tenant_id
  JOIN (
    SELECT user_id, SUM(hours_logged) AS actual_hours
    FROM public.daily_reports
    WHERE tenant_id = v_tenant_id
      AND report_date BETWEEN p_week_start AND p_week_end
    GROUP BY user_id
  ) dr ON dr.user_id = tm.user_id
  WHERE tm.tenant_id = v_tenant_id
    AND tm.status = 'active'
    AND tm.user_id != v_caller_id; -- exclude caller (privacy: không thể back-calculate)

  RETURN jsonb_build_object(
    'member_count', COALESCE(v_member_count, 0),
    'avg_rate',     v_avg_rate  -- NULL nếu không có submitter nào khác trong tuần
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_avg_commitment_rate(date, date) TO authenticated;
