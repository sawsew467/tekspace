-- Fix: public.users.active_tenant_id = NULL cho tất cả user đã có tenant membership
-- Root cause: Hook không chạy khi login (hoặc hook bị skip trong một số trường hợp)
-- Fix: Set active_tenant_id = tenant đầu tiên user join (theo created_at)

UPDATE public.users
SET    active_tenant_id = sub.tenant_id
FROM   (
  SELECT tm.user_id, tm.tenant_id
  FROM   public.tenant_members tm
  WHERE  tm.status = 'active'
  AND    tm.created_at = (
    SELECT MIN(tm2.created_at)
    FROM   public.tenant_members tm2
    WHERE  tm2.user_id = tm.user_id AND tm2.status = 'active'
  )
) sub
WHERE  public.users.id = sub.user_id
AND    public.users.active_tenant_id IS NULL;

-- Verify
DO $$
DECLARE
  cnt integer;
BEGIN
  SELECT COUNT(*) INTO cnt
  FROM   public.users
  WHERE  active_tenant_id IS NULL
  AND    EXISTS (SELECT 1 FROM public.tenant_members WHERE user_id = public.users.id AND status = 'active');

  RAISE NOTICE 'Users still with NULL active_tenant_id despite having active membership: %', cnt;
END $$;
