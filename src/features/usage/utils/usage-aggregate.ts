// Pure aggregation helpers cho usage dashboard. Không side effect, không async.

import { format } from 'date-fns'
import type { Granularity } from '@/lib/period'
import type {
  UsageSnapshotRow,
  TeamStatusValue,
  SessionSummary,
  UserUsageRow,
} from '@/lib/usage-types'

/** Input session cho groupByUser — UsageTeamStatusRow thỏa mãn shape này (status optional). */
export interface SessionInput {
  session_id: string
  user_id: string
  tenant_id: string
  email: string | null
  name: string | null
  model: string | null
  project_name: string | null
  branch: string | null
  started_at: string
  last_seen_at: string
  status?: TeamStatusValue
}

/**
 * latestPerSession — snapshot mới nhất (created_at lớn nhất) theo session_id.
 * So sánh created_at trực tiếp → không phụ thuộc thứ tự input (tránh footgun).
 */
export function latestPerSession(snapshots: UsageSnapshotRow[]): Map<string, UsageSnapshotRow> {
  const map = new Map<string, UsageSnapshotRow>()
  for (const snap of snapshots) {
    if (!snap.session_id) continue
    const existing = map.get(snap.session_id)
    if (!existing || snap.created_at > existing.created_at) {
      map.set(snap.session_id, snap)
    }
  }
  return map
}

/** Ưu tiên trạng thái tổng hợp: active > idle > offline. */
function mergeStatus(a: TeamStatusValue | null, b: TeamStatusValue | undefined): TeamStatusValue | null {
  const rank: Record<TeamStatusValue, number> = { active: 3, idle: 2, offline: 1 }
  if (b === undefined) return a
  if (a === null) return b
  return rank[b] > rank[a] ? b : a
}

/**
 * groupByUser — gộp các session theo user_id thành 1 dòng/user.
 * latestBySession: map từ latestPerSession(...) để đính snapshot mới nhất mỗi session.
 * Trả về sort theo lastActivity DESC.
 */
export function groupByUser(
  sessions: SessionInput[],
  latestBySession: Map<string, UsageSnapshotRow>,
): UserUsageRow[] {
  const byUser = new Map<string, UserUsageRow>()

  for (const s of sessions) {
    const latest = latestBySession.get(s.session_id)
    const summary: SessionSummary = {
      session_id: s.session_id,
      model: s.model,
      project_name: s.project_name,
      branch: s.branch,
      started_at: s.started_at,
      last_seen_at: s.last_seen_at,
      status: s.status,
      latest,
    }

    let row = byUser.get(s.user_id)
    if (!row) {
      row = {
        user_id: s.user_id,
        tenant_id: s.tenant_id,
        email: s.email,
        name: s.name,
        model: s.model,
        status: null,
        sessionCount: 0,
        contextTokens: 0,
        sessions: [],
        lastActivity: s.last_seen_at,
        latest: undefined,
      }
      byUser.set(s.user_id, row)
    }

    row.sessions.push(summary)
    row.sessionCount += 1
    row.contextTokens += latest?.context_tokens ?? 0
    row.email = row.email ?? s.email
    row.name = row.name ?? s.name
    row.status = mergeStatus(row.status, s.status)

    // lastActivity = max(last_seen_at); model theo session hoạt động gần nhất
    if (s.last_seen_at > row.lastActivity) {
      row.lastActivity = s.last_seen_at
      row.model = s.model
    }

    // latest snapshot toàn user = snapshot có created_at mới nhất
    if (latest && (!row.latest || latest.created_at > row.latest.created_at)) {
      row.latest = latest
    }
  }

  return Array.from(byUser.values()).sort((a, b) => b.lastActivity.localeCompare(a.lastActivity))
}

// ── Chart data ──────────────────────────────────────────────────────────────────

export interface UsageChartPoint {
  label: string
  context_tokens: number
}

/**
 * buildUsageChartData — team context_tokens theo bucket thời gian.
 * day → bucket theo phút (HH:mm); week/month → bucket theo ngày (dd/MM), giờ local (viewer).
 *
 * context_tokens là giá trị tuyệt đối (kích thước context tại thời điểm), KHÔNG cộng dồn.
 * Trong mỗi bucket lấy snapshot MỚI NHẤT của từng session rồi cộng → tránh đếm trùng
 * khi một session bắn nhiều snapshot trong cùng bucket (khớp semantics của tổng latest-per-session).
 */
export function buildUsageChartData(
  snapshots: UsageSnapshotRow[],
  granularity: Granularity,
): UsageChartPoint[] {
  if (snapshots.length === 0) return []

  const sorted = [...snapshots].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )

  const byMinute = granularity === 'day'
  // bucketKey → (session_id → latest snapshot trong bucket đó)
  const bucketSessions = new Map<string, Map<string, UsageSnapshotRow>>()
  const order: string[] = []
  for (const snap of sorted) {
    const d = new Date(snap.created_at)
    let key: string
    if (byMinute) {
      d.setSeconds(0, 0)
      key = format(d, 'HH:mm')
    } else {
      key = format(d, 'dd/MM')
    }
    let sessMap = bucketSessions.get(key)
    if (!sessMap) {
      sessMap = new Map()
      bucketSessions.set(key, sessMap)
      order.push(key) // giữ thứ tự thời gian (input đã sort tăng dần)
    }
    // sorted tăng dần → ghi đè để giữ snapshot mới nhất/session trong bucket
    sessMap.set(snap.session_id, snap)
  }

  return order.map((label) => {
    let sum = 0
    for (const snap of bucketSessions.get(label)!.values()) sum += snap.context_tokens ?? 0
    return { label, context_tokens: sum }
  })
}

// ── Timestamp bounds ─────────────────────────────────────────────────────────────

/**
 * periodToTimestampBounds — chuyển range ngày ('yyyy-MM-dd') sang cận timestamp UTC
 * [startISO, endExclusiveISO) để query cột `created_at` (timestamptz).
 *
 * QUAN TRỌNG: dùng NỬA ĐÊM THEO GIỜ LOCAL của viewer (parse 'yyyy-MM-ddT00:00:00' cho ra
 * Date tại local midnight) rồi serialize qua toISOString() để ra đúng instant UTC.
 * Nếu ghép chuỗi naive '...T00:00:00' và gửi thẳng, Postgres hiểu là UTC → lệch theo offset
 * (VD Asia/Saigon +7h) làm mất hoạt động 00:00–07:00 local. Bucket chart cũng dùng giờ local
 * → hai bên thống nhất một định nghĩa "ngày".
 */
export function periodToTimestampBounds(
  start: string,
  end: string,
): { startISO: string; endExclusiveISO: string } {
  const startDate = new Date(start + 'T00:00:00') // local midnight
  const endDate = new Date(end + 'T00:00:00') // local midnight
  endDate.setDate(endDate.getDate() + 1) // exclusive = ngày kế tiếp
  return {
    startISO: startDate.toISOString(),
    endExclusiveISO: endDate.toISOString(),
  }
}
