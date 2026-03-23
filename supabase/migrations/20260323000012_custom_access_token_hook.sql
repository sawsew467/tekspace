-- Migration: Custom Access Token Hook
-- Embed tenant_roles: { tenantId: role } và active_tenant_id vào JWT

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb AS $$
DECLARE
  claims          jsonb;
  tenant_roles    jsonb;
  default_tenant  uuid;
  uid             uuid;
BEGIN
  uid := (event->>'user_id')::uuid;

  -- P-2+P-3: SECURITY DEFINER để bypass RLS trên tenant_members khi hook gọi
  -- Lấy tất cả tenant roles của user (VOLATILE: không cache, luôn đọc live data)
  SELECT jsonb_object_agg(tenant_id::text, role)
  INTO   tenant_roles
  FROM   public.tenant_members
  WHERE  user_id = uid
    AND  status  = 'active';

  -- IG-1: Embed active_tenant_id = tenant đầu tiên user join (theo thứ tự created_at)
  -- TODO: Cần thiết kế cơ chế tenant switching (refresh session sau khi user chọn tenant)
  --       Hiện tại: default là tenant đầu tiên để RLS không bị silent-fail khi login.
  --       Frontend cần gọi auth.refreshSession() sau khi user switch tenant.
  SELECT tenant_id INTO default_tenant
  FROM   public.tenant_members
  WHERE  user_id = uid
    AND  status  = 'active'
  ORDER BY created_at
  LIMIT 1;

  claims := event->'claims';
  claims := jsonb_set(claims, '{tenant_roles}',    COALESCE(tenant_roles, '{}'::jsonb));
  claims := jsonb_set(claims, '{active_tenant_id}', COALESCE(to_jsonb(default_tenant::text), 'null'::jsonb));

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '';

-- GRANT cho supabase_auth_admin
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

-- ⚠️ MANUAL STEP REQUIRED:
-- Enable hook tại: Supabase Dashboard → Authentication → Hooks → Custom Access Token
-- Chọn: Database Function → public.custom_access_token_hook
