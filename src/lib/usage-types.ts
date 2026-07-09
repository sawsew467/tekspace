// Local TypeScript types for usage-tracking tables.
// The generated supabase-types.ts does NOT yet include these (migration not applied to cloud).
// These types mirror the DB contract in supabase/migrations/20260709000001_claude_usage_tracking.sql.

export interface DeviceTokenRow {
  id: string
  user_id: string
  tenant_id: string
  token_hash: string
  token_prefix: string
  label: string
  last_used_at: string | null
  created_at: string
  revoked_at: string | null
}

export interface ClaudeSessionRow {
  session_id: string
  user_id: string
  tenant_id: string
  model: string
  project_hash: string
  project_name: string | null
  branch: string | null
  started_at: string
  last_seen_at: string
}

export interface UsageSnapshotRow {
  id: number
  session_id: string
  user_id: string
  tenant_id: string
  context_percent: number
  context_tokens: number
  lines_added: number
  lines_removed: number
  five_hour_pct: number | null
  seven_day_pct: number | null
  created_at: string
}

/** View: usage_team_status — status derived server-side */
export type TeamStatusValue = 'active' | 'idle' | 'offline'

export interface UsageTeamStatusRow {
  session_id: string
  user_id: string
  name: string | null
  email: string | null
  tenant_id: string
  model: string
  project_hash: string
  project_name: string | null
  branch: string | null
  started_at: string
  last_seen_at: string
  status: TeamStatusValue
}

/** Enriched row for the usage dashboard team table */
export interface TeamTableRow extends UsageTeamStatusRow {
  /** Latest snapshot for this session (may be undefined if no snapshots yet) */
  latest?: UsageSnapshotRow
  /** Display name — populated from auth metadata where available */
  display_name?: string
}
