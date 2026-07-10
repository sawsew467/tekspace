import { supabase } from '@/lib/supabase-browser'
import type {
  UsageTeamStatusRow,
  UsageSnapshotRow,
  ClaudeSessionRow,
} from '@/lib/usage-types'

// Generated Database type chưa gồm các bảng usage-tracking (migration chưa regenerate
// against cloud). Cast qua `unknown` chỉ ở ranh giới query; call-site vẫn dùng type local.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as { from: (t: string) => any }

const SNAPSHOT_FIELDS =
  'id, session_id, user_id, tenant_id, context_percent, context_tokens, lines_added, lines_removed, five_hour_pct, seven_day_pct, created_at'

/** Team status (view) của tenant hiện tại — status live theo last_seen_at. */
export async function fetchTeamStatus(tenantId: string): Promise<UsageTeamStatusRow[]> {
  const { data, error } = await db.from('usage_team_status')
    .select('session_id, user_id, name, email, tenant_id, model, project_hash, project_name, branch, started_at, last_seen_at, status')
    .eq('tenant_id', tenantId)
    .order('last_seen_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as UsageTeamStatusRow[]
}

/** Snapshots trong khoảng [startISO, endExclusiveISO) — dùng cho mọi kỳ (kể cả hôm nay). */
export async function fetchSnapshotsForPeriod(
  tenantId: string,
  startISO: string,
  endExclusiveISO: string,
): Promise<UsageSnapshotRow[]> {
  const { data, error } = await db.from('usage_snapshots')
    .select(SNAPSHOT_FIELDS)
    .eq('tenant_id', tenantId)
    .gte('created_at', startISO)
    .lt('created_at', endExclusiveISO)
    .order('created_at', { ascending: false })
    .limit(20000) // vượt default 1000-row cap cho kỳ tháng
  if (error) throw new Error(error.message)
  return (data ?? []) as UsageSnapshotRow[]
}

/** Sessions có hoạt động giao với kỳ (overlap started_at < endExclusive AND last_seen_at >= start). */
export async function fetchSessionsForPeriod(
  tenantId: string,
  startISO: string,
  endExclusiveISO: string,
): Promise<ClaudeSessionRow[]> {
  const { data, error } = await db.from('claude_sessions')
    .select('session_id, user_id, tenant_id, model, project_hash, project_name, branch, started_at, last_seen_at')
    .eq('tenant_id', tenantId)
    .lt('started_at', endExclusiveISO)
    .gte('last_seen_at', startISO)
    .order('last_seen_at', { ascending: false })
    .limit(10000)
  if (error) throw new Error(error.message)
  return (data ?? []) as ClaudeSessionRow[]
}

/** Lịch sử snapshot của một session (detail). */
export async function fetchSnapshotHistory(sessionId: string): Promise<UsageSnapshotRow[]> {
  const { data, error } = await db.from('usage_snapshots')
    .select(SNAPSHOT_FIELDS)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw new Error(error.message)
  return (data ?? []) as UsageSnapshotRow[]
}
