-- Fix: Add WITH CHECK to avatars_update_own policy
-- Code review fix for Story 8-10 (P-3)
-- Without WITH CHECK, a user could rename their storage object to any arbitrary path.

DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;

CREATE POLICY "avatars_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (string_to_array(name, '/'))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (string_to_array(name, '/'))[1] = auth.uid()::text
);
