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

/** Một session của user, dùng trong detail sheet (gộp theo user). */
export interface SessionSummary {
  session_id: string
  model: string | null
  project_name: string | null
  branch: string | null
  started_at: string
  last_seen_at: string
  /** Trạng thái live (chỉ có ý nghĩa cho kỳ hiện tại). */
  status?: TeamStatusValue
  /** Snapshot mới nhất của session này. */
  latest?: UsageSnapshotRow
}

/** Dòng bảng usage gộp theo user (user_id + tenant_id). */
export interface UserUsageRow {
  user_id: string
  tenant_id: string
  email: string | null
  name: string | null
  /** Model của session hoạt động gần nhất. */
  model: string | null
  /** Trạng thái tổng hợp: active nếu có ≥1 session active; null cho kỳ quá khứ. */
  status: TeamStatusValue | null
  sessionCount: number
  /** Tổng context_tokens = Σ latest-per-session của user (dùng tính % share so với team). */
  contextTokens: number
  /** Các session của user trong kỳ (cho detail sheet). */
  sessions: SessionSummary[]
  /** Thời điểm hoạt động gần nhất (max last_seen_at), ISO. */
  lastActivity: string
  /** Snapshot mới nhất trên toàn bộ session của user. */
  latest?: UsageSnapshotRow
}
