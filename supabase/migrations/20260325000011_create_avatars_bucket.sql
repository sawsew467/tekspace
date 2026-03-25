-- Migration: Tạo Supabase Storage bucket cho user avatars
-- Story: 8-10-user-avatar-upload

-- ================================================================
-- Tạo bucket avatars (public read, 5MB limit)
-- ================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,  -- 5MB in bytes
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ================================================================
-- RLS Policies cho storage.objects
-- Path pattern: {userId}/{filename}
-- auth.uid()::text phải match với folder đầu tiên trong path
-- ================================================================

-- Policy: Authenticated users upload vào folder của mình
CREATE POLICY "avatars_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (string_to_array(name, '/'))[1] = auth.uid()::text
);

-- Policy: Public read (avatars là public bucket)
CREATE POLICY "avatars_select_public"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'avatars');

-- Policy: Authenticated users update file của mình
CREATE POLICY "avatars_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (string_to_array(name, '/'))[1] = auth.uid()::text
);

-- Policy: Authenticated users delete file của mình
CREATE POLICY "avatars_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (string_to_array(name, '/'))[1] = auth.uid()::text
);
