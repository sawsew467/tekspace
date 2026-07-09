-- Migration: dedupe usage snapshots by content (replaces the 150ms time dampener).
--
-- Why: usage-sync fires on BOTH Stop and SubagentStop. Within one turn those two
-- events read the same statusline tmp file (statusline has not re-rendered between
-- them), so they POST an IDENTICAL payload. They can be seconds apart, so the old
-- 150ms window did not coalesce them -> duplicate rows in the session history.
--
-- Fix: skip the insert when the incoming snapshot is identical to the session's
-- most recent snapshot (same context tokens/percent/lines). This records only
-- changes, robust to any timing or retry. CREATE OR REPLACE only — additive/safe.

create or replace function public.ingest_usage(p_token_hash text, p_payload jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid;
  v_tenant uuid;
  v_sid    text := p_payload ->> 'session_id';
  v_last   public.usage_snapshots%rowtype;
begin
  select user_id, tenant_id into v_uid, v_tenant
  from public.device_tokens
  where token_hash = p_token_hash and revoked_at is null;

  if v_uid is null then
    return false;  -- invalid or revoked token
  end if;

  -- Authorization freshness: reject if the token owner is no longer an active
  -- member of the token's tenant (offboarding without explicit revoke).
  if not exists (
    select 1 from public.tenant_members
    where user_id = v_uid and tenant_id = v_tenant and status = 'active'
  ) then
    return false;
  end if;

  update public.device_tokens set last_used_at = now() where token_hash = p_token_hash;

  if v_sid is null or v_sid = '' then
    return true;   -- token valid but no snapshot to store
  end if;

  insert into public.claude_sessions as s
    (session_id, user_id, tenant_id, model, project_hash, project_name, branch, last_seen_at)
  values (
    v_sid, v_uid, v_tenant,
    p_payload ->> 'model', p_payload ->> 'project_hash',
    p_payload ->> 'project_name', p_payload ->> 'branch', now()
  )
  on conflict (session_id) do update set
    last_seen_at = greatest(s.last_seen_at, now()),   -- RT-13 monotonic
    model        = coalesce(excluded.model, s.model),
    project_hash = coalesce(excluded.project_hash, s.project_hash),
    project_name = coalesce(excluded.project_name, s.project_name),
    branch       = coalesce(excluded.branch, s.branch);

  -- Content dedupe: skip if identical to the session's latest snapshot
  -- (Stop + SubagentStop of the same turn read the same tmp -> identical payload).
  select * into v_last
  from public.usage_snapshots
  where session_id = v_sid
  order by created_at desc
  limit 1;

  if found
     and v_last.context_tokens  is not distinct from (p_payload ->> 'context_tokens')::int
     and v_last.context_percent is not distinct from (p_payload ->> 'context_percent')::int
     and v_last.lines_added     is not distinct from (p_payload ->> 'lines_added')::int
     and v_last.lines_removed   is not distinct from (p_payload ->> 'lines_removed')::int
  then
    return true;  -- no change since last snapshot -> dedupe
  end if;

  insert into public.usage_snapshots
    (session_id, user_id, tenant_id, context_percent, context_tokens,
     lines_added, lines_removed, five_hour_pct, seven_day_pct)
  values (
    v_sid, v_uid, v_tenant,
    (p_payload ->> 'context_percent')::int,
    (p_payload ->> 'context_tokens')::int,
    (p_payload ->> 'lines_added')::int,
    (p_payload ->> 'lines_removed')::int,
    (p_payload ->> 'five_hour_pct')::int,
    (p_payload ->> 'seven_day_pct')::int
  );
  return true;
end;
$$;
