-- Migration: Claude usage tracking (device tokens, sessions, snapshots)
--
-- PRODUCTION-SAFE / ADDITIVE ONLY:
--   * Creates 3 NEW tables + 1 helper fn + 2 RPCs + 1 view. No ALTER on existing
--     tables. Does NOT touch custom_access_token_hook / users / tenants / members.
--   * Realtime publication ADD is wrapped in an idempotent DO block.
--
-- Identity reuses public.users / public.tenants / public.tenant_members.
-- A device token is bound to one tenant (the creator's active_tenant_id).
--
-- Red-team decisions baked in:
--   RT-1  realtime read uses a membership helper on auth.uid() (NOT current_tenant_id,
--         which is NULL under Realtime) so team-wide read works live without leaking.
--   RT-4  usage_snapshots gets REPLICA IDENTITY FULL (server-side filter needs it).
--   RT-6  create_device_token: self-service + per-user cap; revoke: owner OR manager.
--   RT-7  client-facing writes go only through the Edge Function (service_role);
--         authenticated clients have NO insert/update policy here.
--   RT-15 device_tokens SELECT is scoped to the owner (user_id = auth.uid()).

create extension if not exists pgcrypto with schema extensions;

-- ============================================================================
-- Tables
-- ============================================================================

create table public.device_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id)   on delete cascade,
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  token_hash   text not null unique,          -- sha256(raw token) hex; raw never stored
  token_prefix text not null,                 -- e.g. 'cku_a1b2c3d4' for display
  label        text,
  last_used_at timestamptz,
  created_at   timestamptz not null default now(),
  revoked_at   timestamptz
);
create index idx_device_tokens_user on public.device_tokens(user_id);
-- Fast auth lookup on the hot path (only live tokens).
create index idx_device_tokens_hash_live on public.device_tokens(token_hash) where revoked_at is null;

create table public.claude_sessions (
  session_id   text primary key,
  user_id      uuid not null references public.users(id)   on delete cascade,
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  model        text,
  project_hash text,
  project_name text,
  branch       text,
  started_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index idx_claude_sessions_tenant on public.claude_sessions(tenant_id, last_seen_at desc);

create table public.usage_snapshots (
  id             bigint generated always as identity primary key,
  session_id     text references public.claude_sessions(session_id) on delete cascade,
  user_id        uuid not null references public.users(id)   on delete cascade,
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  context_percent int,
  context_tokens  int,
  lines_added     int,
  lines_removed   int,
  five_hour_pct   int,   -- nullable: not every account has quota data
  seven_day_pct   int,   -- nullable
  created_at      timestamptz not null default now()
);
create index idx_usage_snapshots_tenant_created on public.usage_snapshots(tenant_id, created_at desc);
create index idx_usage_snapshots_user_created   on public.usage_snapshots(user_id, created_at desc);

-- ============================================================================
-- RLS helper (RT-1): can the caller read usage for this tenant?
-- Resolves membership via auth.uid() (available under Realtime) instead of
-- current_tenant_id() (a custom JWT claim that is NULL in the Realtime context).
-- ============================================================================
create or replace function public.user_can_read_tenant_usage(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tenant_members
    where user_id = auth.uid()
      and tenant_id = p_tenant_id
      and status = 'active'
  );
$$;

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.device_tokens   enable row level security;
alter table public.claude_sessions enable row level security;
alter table public.usage_snapshots enable row level security;

-- device_tokens: owner-only visibility (RT-15). Create/revoke via RPC below.
create policy device_tokens_select_own on public.device_tokens
  for select using (user_id = auth.uid());

-- claude_sessions / usage_snapshots: team-wide read within the tenant (RT-1).
-- No INSERT/UPDATE policy for authenticated → only the Edge Function
-- (service_role, bypasses RLS) writes these (RT-7).
create policy claude_sessions_select_team on public.claude_sessions
  for select using (public.user_can_read_tenant_usage(tenant_id));

create policy usage_snapshots_select_team on public.usage_snapshots
  for select using (public.user_can_read_tenant_usage(tenant_id));

-- Coarse SELECT grants (RLS still gates rows). Explicit so the Phase 2 dashboard
-- reads work regardless of the project's default-privilege configuration.
grant select on public.device_tokens, public.claude_sessions, public.usage_snapshots to authenticated;

-- ============================================================================
-- RPCs: token lifecycle (RT-6)
-- ============================================================================

-- Self-service create, bound to the caller's active tenant, per-user cap of 10
-- live tokens. Returns the raw token exactly once; only sha256 + prefix persist.
create or replace function public.create_device_token(p_label text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_tenant uuid := public.current_tenant_id();
  v_raw    text;
  v_live   int;
begin
  if v_uid is null or v_tenant is null then
    raise exception 'not authenticated';
  end if;
  if not exists (
    select 1 from public.tenant_members
    where user_id = v_uid and tenant_id = v_tenant and status = 'active'
  ) then
    raise exception 'not an active member of the current tenant';
  end if;

  select count(*) into v_live from public.device_tokens
    where user_id = v_uid and tenant_id = v_tenant and revoked_at is null;
  if v_live >= 10 then
    raise exception 'device token limit reached (10 active); revoke one first';
  end if;

  v_raw := 'cku_' || encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.device_tokens (user_id, tenant_id, token_hash, token_prefix, label)
  values (
    v_uid,
    v_tenant,
    encode(extensions.digest(v_raw, 'sha256'), 'hex'),
    left(v_raw, 12),
    nullif(btrim(coalesce(p_label, '')), '')
  );
  return v_raw;
end;
$$;

-- Revoke: the token owner, OR a manager/owner of the token's tenant (RT-6).
create or replace function public.revoke_device_token(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.device_tokens%rowtype;
begin
  select * into v_row from public.device_tokens where id = p_id;
  if v_row.id is null then
    raise exception 'token not found';
  end if;
  if v_row.user_id <> v_uid
     and not (v_row.tenant_id = public.current_tenant_id() and public.is_tenant_manager()) then
    raise exception 'not authorized to revoke this token';
  end if;
  update public.device_tokens set revoked_at = now()
    where id = p_id and revoked_at is null;
end;
$$;

revoke execute on function public.create_device_token(text) from anon;
revoke execute on function public.revoke_device_token(uuid) from anon;
grant  execute on function public.create_device_token(text) to authenticated;
grant  execute on function public.revoke_device_token(uuid) to authenticated;

-- ============================================================================
-- Ingest RPC (called by the Edge Function with service_role).
-- Resolves the token, upserts the session with a MONOTONIC last_seen_at guard
-- (RT-13: concurrent SubagentStop must not push last_seen_at backwards), then
-- inserts a snapshot. A light dampener coalesces sub-150ms duplicate writes.
-- Returns false for an invalid/revoked token so the caller can answer 401.
-- ============================================================================
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
begin
  select user_id, tenant_id into v_uid, v_tenant
  from public.device_tokens
  where token_hash = p_token_hash and revoked_at is null;

  if v_uid is null then
    return false;  -- invalid or revoked token
  end if;

  -- Authorization freshness: reject if the token owner is no longer an active
  -- member of the token's tenant (offboarding without explicit revoke). Mirrors
  -- the read side, which also gates on active membership.
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

  -- Flood dampener: skip if a snapshot for this session landed < 150ms ago.
  if exists (
    select 1 from public.usage_snapshots
    where session_id = v_sid and created_at > now() - interval '150 milliseconds'
  ) then
    return true;
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

-- service_role only (Edge Function). Never expose to client roles.
revoke execute on function public.ingest_usage(text, jsonb) from anon, authenticated, public;
grant  execute on function public.ingest_usage(text, jsonb) to service_role;

-- ============================================================================
-- Server-side status view (RT-13): derive Active/Idle/Offline from the DB clock,
-- never the viewer's clock. security_invoker so the caller's RLS still applies.
-- ============================================================================
create view public.usage_team_status
with (security_invoker = on) as
select
  s.session_id,
  s.user_id,
  s.tenant_id,
  s.model,
  s.project_hash,
  s.project_name,
  s.branch,
  s.started_at,
  s.last_seen_at,
  case
    when now() - s.last_seen_at < interval '2 minutes'  then 'active'
    when now() - s.last_seen_at < interval '10 minutes' then 'idle'
    else 'offline'
  end as status
from public.claude_sessions s;

grant select on public.usage_team_status to authenticated;

-- ============================================================================
-- Realtime (RT-4): filtered subscriptions need full row image in the WAL.
-- ============================================================================
alter table public.usage_snapshots replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.usage_snapshots;
exception
  when duplicate_object then null;  -- already added on a prior run
end
$$;
