-- Migration: Create member_audit_logs table
-- Audit trail for member management actions (remove, promote, transfer ownership)
-- INSERTs are performed via Edge Functions using service role — no client INSERT policy needed

CREATE TABLE public.member_audit_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_id    uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  target_id   uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  action      text        NOT NULL,  -- 'remove' | 'promote_manager' | 'transfer_ownership_from' | 'transfer_ownership_to'
  details     jsonb,                  -- Optional: { previousRole: 'member', newRole: 'manager' }
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_member_audit_logs_tenant_id ON public.member_audit_logs(tenant_id);
CREATE INDEX idx_member_audit_logs_created_at ON public.member_audit_logs(tenant_id, created_at DESC);

ALTER TABLE public.member_audit_logs ENABLE ROW LEVEL SECURITY;

-- Chỉ manager/owner mới SELECT được (dùng is_tenant_manager() helper đã có)
CREATE POLICY member_audit_logs_select_policy ON public.member_audit_logs
  FOR SELECT USING (
    tenant_id = public.current_tenant_id()
    AND public.is_tenant_manager()
  );

-- INSERT chỉ qua Edge Functions (service role bypass) — KHÔNG có client INSERT policy
-- Không cần INSERT policy ở đây
