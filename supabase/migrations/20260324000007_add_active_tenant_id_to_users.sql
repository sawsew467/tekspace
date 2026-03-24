-- Migration: Add active_tenant_id to users + update custom_access_token_hook
-- Story 1.7: Tenant Switcher & Personal Profile

-- Thêm active_tenant_id vào users để hỗ trợ tenant switching
ALTER TABLE public.users
  ADD COLUMN active_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;

-- Index để hook query nhanh
CREATE INDEX idx_users_active_tenant_id ON public.users(id) WHERE active_tenant_id IS NOT NULL;

-- Update custom_access_token_hook để ưu tiên users.active_tenant_id nếu không NULL
-- Thay thế toàn bộ function cũ bằng version mới hỗ trợ tenant switching
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb AS $$
DECLARE
  claims          jsonb;
  tenant_roles    jsonb;
  active_tenant   uuid;
  default_tenant  uuid;
  uid             uuid;
BEGIN
  uid := (event->>'user_id')::uuid;

  -- SECURITY DEFINER để bypass RLS trên tenant_members khi hook gọi
  -- Lấy tất cả tenant roles của user (VOLATILE: không cache, luôn đọc live data)
  SELECT jsonb_object_agg(tenant_id::text, role)
  INTO   tenant_roles
  FROM   public.tenant_members
  WHERE  user_id = uid AND status = 'active';

  -- IG-1 UPDATED: Ưu tiên users.active_tenant_id nếu đã set VÀ user còn là member
  SELECT u.active_tenant_id INTO active_tenant
  FROM   public.users u
  WHERE  u.id = uid;

  -- Validate: active_tenant_id phải là tenant user còn active membership
  IF active_tenant IS NOT NULL THEN
    PERFORM 1 FROM public.tenant_members
    WHERE tenant_id = active_tenant AND user_id = uid AND status = 'active';
    IF NOT FOUND THEN
      active_tenant := NULL;  -- Reset nếu không còn member
    END IF;
  END IF;

  -- Fallback: dùng tenant đầu tiên theo created_at
  IF active_tenant IS NULL THEN
    SELECT tenant_id INTO default_tenant
    FROM   public.tenant_members
    WHERE  user_id = uid AND status = 'active'
    ORDER BY created_at LIMIT 1;
    active_tenant := default_tenant;
  END IF;

  claims := event->'claims';
  claims := jsonb_set(claims, '{tenant_roles}',    COALESCE(tenant_roles, '{}'::jsonb));
  claims := jsonb_set(claims, '{active_tenant_id}', COALESCE(to_jsonb(active_tenant::text), 'null'::jsonb));

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '';

-- Giữ nguyên GRANT (không cần thay đổi vì function name giữ nguyên)
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;
