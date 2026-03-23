-- Migration: Create tenant_invites table
-- Invite lifecycle

-- IG-3: Thêm 'declined' (invitee từ chối) và 'revoked' (manager hủy) vào state machine
CREATE TYPE public.invite_status AS ENUM ('pending', 'accepted', 'expired', 'declined', 'revoked');

CREATE TABLE public.tenant_invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- P-24: ON DELETE SET NULL — giữ lại audit trail invite khi user bị xóa
  invited_by  uuid REFERENCES public.users(id) ON DELETE SET NULL,
  email       text NOT NULL,
  -- P-23: token phải đủ entropy (>= 32 chars)
  token       text NOT NULL UNIQUE CONSTRAINT tenant_invites_token_length CHECK (length(token) >= 32),
  status      public.invite_status NOT NULL DEFAULT 'pending',
  expires_at  timestamptz NOT NULL CONSTRAINT tenant_invites_expires_future CHECK (expires_at > created_at),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tenant_invites_tenant_id ON public.tenant_invites(tenant_id);
CREATE INDEX idx_tenant_invites_token     ON public.tenant_invites(token);

-- P-22: Chỉ cho phép 1 pending invite per email per tenant
CREATE UNIQUE INDEX idx_tenant_invites_pending_email
  ON public.tenant_invites(tenant_id, email)
  WHERE status = 'pending';

-- Enable RLS
ALTER TABLE public.tenant_invites ENABLE ROW LEVEL SECURITY;
