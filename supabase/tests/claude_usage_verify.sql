-- Manual verification for claude usage tracking (Docker-free / cloud path).
--
-- `supabase test db` needs a local shadow DB (Docker). This project runs against
-- Supabase Cloud, so verify by running THIS script in the Supabase SQL editor
-- (or psql as the postgres role). Everything is wrapped in BEGIN...ROLLBACK, so
-- it seeds throwaway rows, checks, and rolls back — NOTHING is persisted.
--
-- Fill the three placeholders with REAL ids from your project first:
--   <TENANT_A>        a tenant uuid
--   <USER_A>          a user uuid who is an ACTIVE member of <TENANT_A>
--   <USER_OUTSIDER>   a user uuid who is NOT a member of <TENANT_A>
--
-- Expected results are noted on each SELECT. Any mismatch = RLS/RPC bug.

BEGIN;

-- Seed one session + snapshot in TENANT_A (as postgres, bypasses RLS).
insert into public.claude_sessions (session_id, user_id, tenant_id, model, project_name)
values ('verify-sess-0001', '<USER_A>', '<TENANT_A>', 'verify', 'verify-app');
insert into public.usage_snapshots (session_id, user_id, tenant_id, context_tokens)
values ('verify-sess-0001', '<USER_A>', '<TENANT_A>', 12345);
insert into public.device_tokens (user_id, tenant_id, token_hash, token_prefix, label)
values ('<USER_A>', '<TENANT_A>', 'verifyhash_a', 'cku_verifya', 'verify');

-- --- RT-1: an ACTIVE member of TENANT_A can read team usage ---
set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"<USER_A>","role":"authenticated","active_tenant_id":"<TENANT_A>"}';
select 'RT-1 member sees session   (expect 1)' as check,
       count(*) from public.claude_sessions where session_id = 'verify-sess-0001';
select 'RT-1 member sees snapshot  (expect 1)' as check,
       count(*) from public.usage_snapshots where session_id = 'verify-sess-0001';
select 'RT-13 status view visible  (expect 1)' as check,
       count(*) from public.usage_team_status where session_id = 'verify-sess-0001';
-- RT-15: member sees ONLY their own tokens
select 'RT-15 owner sees own token (expect 1)' as check,
       count(*) from public.device_tokens where token_hash = 'verifyhash_a';
reset role;

-- --- RT-1 / isolation: an OUTSIDER (not in TENANT_A) sees nothing ---
set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"<USER_OUTSIDER>","role":"authenticated","active_tenant_id":"<TENANT_A>"}';
-- NOTE: even with active_tenant_id spoofed to TENANT_A, membership is checked via
-- auth.uid() in user_can_read_tenant_usage(), so a non-member still sees nothing.
select 'RT-1 outsider blocked snap (expect 0)' as check,
       count(*) from public.usage_snapshots where session_id = 'verify-sess-0001';
select 'RT-15 outsider no tokens   (expect 0)' as check,
       count(*) from public.device_tokens where token_hash = 'verifyhash_a';
reset role;

-- --- RT-6: create_device_token returns a raw cku_ token as the member ---
set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"<USER_A>","role":"authenticated","active_tenant_id":"<TENANT_A>"}';
select 'RT-6 create returns cku_   (expect t)' as check,
       (public.create_device_token('verify-created') like 'cku_%') as ok;
select 'RT-6 only hash stored       (expect 0)' as check,
       count(*) from public.device_tokens
       where token_prefix like 'cku_%' and token_hash like 'cku_%';  -- hash is never the raw token
reset role;

ROLLBACK;

-- Sanity (outside txn): objects exist.
select 'objects present (expect 5)' as check, count(*) from (
  select 1 from pg_class where relname in ('device_tokens','claude_sessions','usage_snapshots')
  union all select 1 from pg_proc where proname in ('ingest_usage','user_can_read_tenant_usage')
) t;
