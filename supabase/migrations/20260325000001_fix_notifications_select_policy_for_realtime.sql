-- Fix: Supabase Realtime postgres_changes với RLS không truyền custom JWT claim
-- `active_tenant_id` vào Postgres session (khác với PostgREST HTTP context).
-- Kết quả: current_tenant_id() trả về NULL → SELECT policy bị block → events không đến client.
--
-- Fix: Đơn giản hoá SELECT policy, chỉ dùng user_id = auth.uid()
-- - Bảo mật vẫn đảm bảo: user chỉ thấy notification của chính mình
-- - Tenant isolation vẫn đúng: getNotifications/getUnreadCount đều có .eq('tenant_id', ...)
-- - Realtime callback JS cũng có client-side tenant filter
--
-- auth.uid() hoạt động bình thường trong Realtime context vì đây là standard claim.

DROP POLICY IF EXISTS notifications_select_policy ON public.notifications;

CREATE POLICY notifications_select_policy ON public.notifications
  FOR SELECT USING (user_id = auth.uid());
