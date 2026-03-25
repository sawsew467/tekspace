-- supabase/migrations/20260325000013_add_tenant_logo.sql
-- Story: 8-14-tenant-avatar-logo

-- ================================================================
-- 1. Thêm cột logo_url vào tenants
-- ================================================================
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS logo_url text;

-- ================================================================
-- 2. SECURITY DEFINER helper để storage RLS kiểm tra tenant role
-- Cần thiết vì storage.objects policies không thể dùng inline
-- subquery vào bảng có RLS (vi phạm CLAUDE.md RLS rules)
-- ================================================================
CREATE OR REPLACE FUNCTION public.is_tenant_manager_or_owner(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE tenant_id = p_tenant_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'manager')
      AND status = 'active'
  );
$$;

-- ================================================================
-- 3. Storage bucket tenant-logos
-- ================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tenant-logos',
  'tenant-logos',
  true,
  5242880,  -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ================================================================
-- 4. RLS Policies cho bucket tenant-logos
-- Path pattern: {tenantId}/{filename}
-- Chỉ owner/manager của tenant đó mới được write
-- ================================================================

-- Public read (bucket đã public=true)
CREATE POLICY "tenant_logos_select_public"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'tenant-logos');

-- Insert: authenticated + valid path format + là manager/owner của tenant
-- Fix F7: guard position('/' in name) > 0 trước uuid cast để tránh invalid cast error
CREATE POLICY "tenant_logos_insert_manager"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'tenant-logos'
  AND position('/' in name) > 0
  AND public.is_tenant_manager_or_owner(
    (string_to_array(name, '/'))[1]::uuid
  )
);

-- Update: authenticated + valid path format + là manager/owner của tenant
-- Fix F4: thêm WITH CHECK để restrict giá trị mới (không chỉ row cũ)
-- Fix F7: guard position('/' in name) > 0
CREATE POLICY "tenant_logos_update_manager"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'tenant-logos'
  AND position('/' in name) > 0
  AND public.is_tenant_manager_or_owner(
    (string_to_array(name, '/'))[1]::uuid
  )
)
WITH CHECK (
  bucket_id = 'tenant-logos'
  AND position('/' in name) > 0
  AND public.is_tenant_manager_or_owner(
    (string_to_array(name, '/'))[1]::uuid
  )
);

-- Delete: authenticated + valid path format + là manager/owner của tenant
-- Fix F7: guard position('/' in name) > 0
CREATE POLICY "tenant_logos_delete_manager"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'tenant-logos'
  AND position('/' in name) > 0
  AND public.is_tenant_manager_or_owner(
    (string_to_array(name, '/'))[1]::uuid
  )
);
