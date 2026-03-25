-- =============================================================
-- pgTAP Tests — storage.objects RLS Policies (avatars bucket)
-- Story: 8-10-user-avatar-upload (code review fix P-12)
-- Chạy: supabase test db
--
-- Test IDs dùng lại user IDs từ rls_policies.test.sql:
--   owner:   a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
--   outsider: a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14
--
-- Lưu ý:
--   - storage.protect_delete() trigger chặn direct SQL DELETE (chỉ cho phép qua Storage API)
--     → DELETE policy được verify qua pg_policy catalog thay vì runtime
--   - path_tokens là generated column → không insert
--   - set_config thay vì _test_set_auth (function đó chỉ tồn tại trong tx của rls_policies.test.sql)
-- =============================================================

BEGIN;

SELECT plan(7);

-- =============================================================
-- FIXTURES — Insert objects trực tiếp như superuser (bypass RLS)
-- =============================================================

-- Seed bucket (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- 2 avatar objects: 1 của owner (a11), 1 của outsider (a14)
INSERT INTO storage.objects (id, bucket_id, name, owner, owner_id)
VALUES
  (
    'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e11',
    'avatars',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/1711234567890.jpg',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  ),
  (
    'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e12',
    'avatars',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14/1711234567890.jpg',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14'
  )
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- T1: Outsider (auth) KHÔNG thể INSERT vào folder của owner
-- =============================================================
SELECT set_config('request.jwt.claims', '{"sub":"a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14","role":"authenticated","aud":"authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $sql$
    INSERT INTO storage.objects (bucket_id, name, owner, owner_id)
    VALUES (
      'avatars',
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/steal.jpg',
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14',
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14'
    )
  $sql$,
  '42501', NULL,
  'T1: Outsider KHÔNG INSERT được vào folder của owner'
);

RESET ROLE;

-- =============================================================
-- T2: Owner có thể INSERT vào folder của mình
-- =============================================================
SELECT set_config('request.jwt.claims', '{"sub":"a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11","role":"authenticated","aud":"authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $sql$
    INSERT INTO storage.objects (bucket_id, name, owner, owner_id)
    VALUES (
      'avatars',
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/insert_test.jpg',
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
    )
  $sql$,
  'T2: Owner INSERT vào folder của mình — OK'
);

RESET ROLE;

-- =============================================================
-- T3: Authenticated user có thể SELECT từ avatars (public bucket)
-- Dùng ok() + >= 2 vì bucket có thể chứa objects từ trước trong test env
-- =============================================================
SELECT set_config('request.jwt.claims', '{"sub":"a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11","role":"authenticated","aud":"authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT ok(
  (SELECT count(*) FROM storage.objects WHERE bucket_id = 'avatars') >= 2,
  'T3: Authenticated user SELECT từ avatars bucket — thấy ít nhất 2 objects'
);

RESET ROLE;

-- =============================================================
-- T4: avatars_delete_own policy tồn tại trên storage.objects
-- (DELETE không thể test runtime vì storage.protect_delete() trigger)
-- =============================================================
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'avatars_delete_own'
      AND polrelid = 'storage.objects'::regclass
      AND polcmd = 'd'
  ),
  'T4: avatars_delete_own DELETE policy tồn tại trên storage.objects'
);

-- =============================================================
-- T5: avatars_update_own có WITH CHECK clause (P-3 fix)
-- polwithcheck IS NOT NULL xác nhận WITH CHECK đã được thêm
-- =============================================================
SELECT ok(
  (SELECT polwithcheck FROM pg_policy
   WHERE polname = 'avatars_update_own'
     AND polrelid = 'storage.objects'::regclass) IS NOT NULL,
  'T5: avatars_update_own có WITH CHECK clause (P-3 code review fix)'
);

-- =============================================================
-- T6: Outsider KHÔNG thể UPDATE rename object sang folder của owner
-- (Runtime enforcement của WITH CHECK)
-- =============================================================
SELECT set_config('request.jwt.claims', '{"sub":"a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14","role":"authenticated","aud":"authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $sql$
    UPDATE storage.objects
    SET name = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/hijacked.jpg'
    WHERE bucket_id = 'avatars'
      AND name = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14/1711234567890.jpg'
  $sql$,
  '42501', NULL,
  'T6: WITH CHECK (P-3) — outsider KHÔNG rename object sang folder của owner'
);

RESET ROLE;

-- =============================================================
-- T7: Owner có thể UPDATE rename object trong folder của mình
-- =============================================================
SELECT set_config('request.jwt.claims', '{"sub":"a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11","role":"authenticated","aud":"authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $sql$
    UPDATE storage.objects
    SET name = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/renamed.jpg'
    WHERE bucket_id = 'avatars'
      AND name = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/insert_test.jpg'
  $sql$,
  'T7: Owner UPDATE rename object trong folder của mình — OK'
);

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
