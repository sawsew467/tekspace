-- Fix notifications_insert_policy: thêm user_id = auth.uid() vào WITH CHECK
-- Bug: policy cũ chỉ check tenant_id → member có thể INSERT notification cho bất kỳ ai trong tenant
-- Fix: giới hạn INSERT chỉ cho notification của chính mình (Edge Functions dùng service role, bypass RLS)

DROP POLICY IF EXISTS notifications_insert_policy ON public.notifications;

CREATE POLICY notifications_insert_policy ON public.notifications
  FOR INSERT
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND user_id = auth.uid()
  );
