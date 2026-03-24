-- RLS Policy Tests — TekSpace
-- Chạy: psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/tests/rls_policies.sql
--
-- Update UUID nếu reset DB:
--   SELECT u.id, u.email, tm.role, tm.tenant_id
--   FROM public.users u JOIN public.tenant_members tm ON tm.user_id = u.id;
--
-- tenant   : 1ed78aaa-31af-49d9-86a6-3e9e8084198b
-- owner_id : 2c30a661-ed01-46da-8949-2c24e71821ad  (bao.thang.1912@gmail.com)
-- member_id: 0e03f8eb-9804-4e20-bf55-c7d79df414c3  (thangtvb.des@gmail.com)
-- other    : 18af5e0c-de55-422f-9e6c-55e53c8bf31c  (tenant khác)

-- ================================================================
-- TEST 1: OWNER thấy tất cả members
-- ================================================================
BEGIN;
  SET LOCAL role = authenticated;
  SET LOCAL "request.jwt.claims" = '{"sub":"2c30a661-ed01-46da-8949-2c24e71821ad","role":"authenticated","active_tenant_id":"1ed78aaa-31af-49d9-86a6-3e9e8084198b"}';
  DO $$
  DECLARE v int;
  BEGIN
    SELECT COUNT(*) INTO v FROM public.tenant_members
    WHERE tenant_id = '1ed78aaa-31af-49d9-86a6-3e9e8084198b' AND status = 'active';
    IF v = 2 THEN RAISE NOTICE '✅ PASS: owner thấy tất cả members (rows=%)', v;
    ELSE          RAISE WARNING '❌ FAIL: owner thấy tất cả members — expected 2, got %', v; END IF;
  END $$;
ROLLBACK;

-- ================================================================
-- TEST 2: MEMBER thấy tất cả members (AC2)
-- ================================================================
BEGIN;
  SET LOCAL role = authenticated;
  SET LOCAL "request.jwt.claims" = '{"sub":"0e03f8eb-9804-4e20-bf55-c7d79df414c3","role":"authenticated","active_tenant_id":"1ed78aaa-31af-49d9-86a6-3e9e8084198b"}';
  DO $$
  DECLARE v int;
  BEGIN
    SELECT COUNT(*) INTO v FROM public.tenant_members
    WHERE tenant_id = '1ed78aaa-31af-49d9-86a6-3e9e8084198b' AND status = 'active';
    IF v = 2 THEN RAISE NOTICE '✅ PASS: member thấy tất cả members AC2 (rows=%)', v;
    ELSE          RAISE WARNING '❌ FAIL: member thấy tất cả members AC2 — expected 2, got %', v; END IF;
  END $$;
ROLLBACK;

-- ================================================================
-- TEST 3: MEMBER JOIN users không bị stack overflow (RLS recursion)
-- ================================================================
BEGIN;
  SET LOCAL role = authenticated;
  SET LOCAL "request.jwt.claims" = '{"sub":"0e03f8eb-9804-4e20-bf55-c7d79df414c3","role":"authenticated","active_tenant_id":"1ed78aaa-31af-49d9-86a6-3e9e8084198b"}';
  DO $$
  DECLARE v int;
  BEGIN
    SELECT COUNT(*) INTO v
    FROM public.tenant_members tm
    JOIN public.users u ON u.id = tm.user_id
    WHERE tm.tenant_id = '1ed78aaa-31af-49d9-86a6-3e9e8084198b' AND tm.status = 'active';
    IF v = 2 THEN RAISE NOTICE '✅ PASS: member JOIN users không bị recursion (rows=%)', v;
    ELSE          RAISE WARNING '❌ FAIL: member JOIN users — expected 2, got %', v; END IF;
  END $$;
ROLLBACK;

-- ================================================================
-- TEST 4: MEMBER không thấy tenant khác (isolation)
-- ================================================================
BEGIN;
  SET LOCAL role = authenticated;
  SET LOCAL "request.jwt.claims" = '{"sub":"0e03f8eb-9804-4e20-bf55-c7d79df414c3","role":"authenticated","active_tenant_id":"1ed78aaa-31af-49d9-86a6-3e9e8084198b"}';
  DO $$
  DECLARE v int;
  BEGIN
    SELECT COUNT(*) INTO v FROM public.tenant_members
    WHERE tenant_id = '18af5e0c-de55-422f-9e6c-55e53c8bf31c';
    IF v = 0 THEN RAISE NOTICE '✅ PASS: member KHÔNG thấy tenant khác (rows=%)', v;
    ELSE          RAISE WARNING '❌ FAIL: member thấy tenant khác — expected 0, got %', v; END IF;
  END $$;
ROLLBACK;

-- ================================================================
-- TEST 5: MEMBER bị chặn INSERT tenant_members
-- ================================================================
BEGIN;
  SET LOCAL role = authenticated;
  SET LOCAL "request.jwt.claims" = '{"sub":"0e03f8eb-9804-4e20-bf55-c7d79df414c3","role":"authenticated","active_tenant_id":"1ed78aaa-31af-49d9-86a6-3e9e8084198b"}';
  DO $$
  BEGIN
    BEGIN
      INSERT INTO public.tenant_members (tenant_id, user_id, role, status)
      VALUES ('1ed78aaa-31af-49d9-86a6-3e9e8084198b', gen_random_uuid(), 'member', 'active');
      RAISE WARNING '❌ FAIL: member không nên INSERT được tenant_members';
    EXCEPTION WHEN others THEN
      RAISE NOTICE '✅ PASS: member bị chặn INSERT tenant_members';
    END;
  END $$;
ROLLBACK;

-- ================================================================
-- TEST 6: is_tenant_manager() — owner=true
-- ================================================================
BEGIN;
  SET LOCAL role = authenticated;
  SET LOCAL "request.jwt.claims" = '{"sub":"2c30a661-ed01-46da-8949-2c24e71821ad","role":"authenticated","active_tenant_id":"1ed78aaa-31af-49d9-86a6-3e9e8084198b"}';
  DO $$
  DECLARE v bool;
  BEGIN
    SELECT public.is_tenant_manager() INTO v;
    IF v     THEN RAISE NOTICE '✅ PASS: owner is_tenant_manager() = true';
    ELSE          RAISE WARNING '❌ FAIL: owner is_tenant_manager() = false'; END IF;
  END $$;
ROLLBACK;

-- ================================================================
-- TEST 7: is_tenant_manager() — member=false
-- ================================================================
BEGIN;
  SET LOCAL role = authenticated;
  SET LOCAL "request.jwt.claims" = '{"sub":"0e03f8eb-9804-4e20-bf55-c7d79df414c3","role":"authenticated","active_tenant_id":"1ed78aaa-31af-49d9-86a6-3e9e8084198b"}';
  DO $$
  DECLARE v bool;
  BEGIN
    SELECT public.is_tenant_manager() INTO v;
    IF NOT v THEN RAISE NOTICE '✅ PASS: member is_tenant_manager() = false';
    ELSE          RAISE WARNING '❌ FAIL: member is_tenant_manager() = true'; END IF;
  END $$;
ROLLBACK;
