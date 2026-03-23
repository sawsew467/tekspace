-- Migration: Create tenant_members table
-- RBAC roles per-tenant

CREATE TYPE public.member_role AS ENUM ('owner', 'manager', 'member');
CREATE TYPE public.member_status AS ENUM ('active', 'inactive');

CREATE TABLE public.tenant_members (
  id                uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid    NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id           uuid    NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role              public.member_role   NOT NULL DEFAULT 'member',
  status            public.member_status NOT NULL DEFAULT 'active',
  committed_hours   smallint    -- NULL = dùng tenant default
                   CONSTRAINT tenant_members_committed_hours_valid
                     CHECK (committed_hours IS NULL OR committed_hours BETWEEN 1 AND 168),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

CREATE INDEX idx_tenant_members_tenant_id ON public.tenant_members(tenant_id);
CREATE INDEX idx_tenant_members_user_id   ON public.tenant_members(user_id);

-- Enable RLS
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;

-- updated_at trigger
CREATE TRIGGER set_tenant_members_updated_at
  BEFORE UPDATE ON public.tenant_members
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
