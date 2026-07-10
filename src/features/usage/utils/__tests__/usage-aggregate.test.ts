import { describe, it, expect } from 'vitest'
import {
  latestPerSession,
  groupByUser,
  buildUsageChartData,
  periodToTimestampBounds,
  type SessionInput,
} from '../usage-aggregate'
import type { UsageSnapshotRow } from '@/lib/usage-types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function snap(partial: Partial<UsageSnapshotRow> & { session_id: string; created_at: string }): UsageSnapshotRow {
  return {
    id: Math.floor(Math.random() * 1e9),
    user_id: 'u',
    tenant_id: 't',
    context_percent: 0,
    context_tokens: 0,
    lines_added: 0,
    lines_removed: 0,
    five_hour_pct: null,
    seven_day_pct: null,
    ...partial,
  }
}

function session(partial: Partial<SessionInput> & { session_id: string; user_id: string }): SessionInput {
  return {
    tenant_id: 't',
    email: null,
    name: null,
    model: null,
    project_name: null,
    branch: null,
    started_at: '2026-07-10T08:00:00.000Z',
    last_seen_at: '2026-07-10T09:00:00.000Z',
    ...partial,
  }
}

// ── latestPerSession ──────────────────────────────────────────────────────────

describe('latestPerSession', () => {
  it('picks the first (newest) snapshot per session for desc-ordered input', () => {
    const snaps = [
      snap({ session_id: 's1', created_at: '2026-07-10T09:00:00Z', context_tokens: 100 }),
      snap({ session_id: 's1', created_at: '2026-07-10T08:00:00Z', context_tokens: 50 }),
      snap({ session_id: 's2', created_at: '2026-07-10T07:00:00Z', context_tokens: 20 }),
    ]
    const map = latestPerSession(snaps)
    expect(map.get('s1')?.context_tokens).toBe(100)
    expect(map.get('s2')?.context_tokens).toBe(20)
    expect(map.size).toBe(2)
  })

  it('empty input → empty map', () => {
    expect(latestPerSession([]).size).toBe(0)
  })
})

// ── groupByUser ───────────────────────────────────────────────────────────────

describe('groupByUser', () => {
  it('collapses multiple sessions of one user into a single row', () => {
    const sessions = [
      session({ session_id: 's1', user_id: 'u1', email: 'a@x.com', last_seen_at: '2026-07-10T09:00:00Z' }),
      session({ session_id: 's2', user_id: 'u1', last_seen_at: '2026-07-10T10:00:00Z', model: 'opus' }),
    ]
    const latest = latestPerSession([
      snap({ session_id: 's1', created_at: '2026-07-10T09:00:00Z', context_tokens: 100 }),
      snap({ session_id: 's2', created_at: '2026-07-10T10:00:00Z', context_tokens: 200 }),
    ])
    const rows = groupByUser(sessions, latest)
    expect(rows).toHaveLength(1)
    expect(rows[0].sessionCount).toBe(2)
    expect(rows[0].email).toBe('a@x.com')
    expect(rows[0].lastActivity).toBe('2026-07-10T10:00:00Z')
    expect(rows[0].model).toBe('opus') // model của session hoạt động gần nhất
    expect(rows[0].latest?.context_tokens).toBe(200) // snapshot mới nhất toàn user
    expect(rows[0].contextTokens).toBe(300) // Σ latest-per-session (100 + 200)
  })

  it('aggregates status active > idle > offline', () => {
    const sessions = [
      session({ session_id: 's1', user_id: 'u1', status: 'idle' }),
      session({ session_id: 's2', user_id: 'u1', status: 'active' }),
    ]
    const rows = groupByUser(sessions, new Map())
    expect(rows[0].status).toBe('active')
  })

  it('status null when no session carries a live status (historical)', () => {
    const rows = groupByUser([session({ session_id: 's1', user_id: 'u1' })], new Map())
    expect(rows[0].status).toBeNull()
  })

  it('sorts users by lastActivity desc', () => {
    const sessions = [
      session({ session_id: 's1', user_id: 'old', last_seen_at: '2026-07-01T00:00:00Z' }),
      session({ session_id: 's2', user_id: 'new', last_seen_at: '2026-07-10T00:00:00Z' }),
    ]
    const rows = groupByUser(sessions, new Map())
    expect(rows[0].user_id).toBe('new')
    expect(rows[1].user_id).toBe('old')
  })
})

// ── buildUsageChartData ───────────────────────────────────────────────────────

describe('buildUsageChartData', () => {
  it('day → minute buckets, sums latest-per-session', () => {
    const snaps = [
      snap({ session_id: 's1', created_at: '2026-07-10T09:00:10Z', context_tokens: 100 }),
      snap({ session_id: 's2', created_at: '2026-07-10T09:00:40Z', context_tokens: 50 }),
    ]
    const data = buildUsageChartData(snaps, 'day')
    expect(data).toHaveLength(1) // cùng phút
    expect(data[0].context_tokens).toBe(150)
  })

  it('dedups repeated snapshots of one session within a bucket (no double-count)', () => {
    const snaps = [
      snap({ session_id: 's1', created_at: '2026-07-10T09:00:10Z', context_tokens: 100 }),
      snap({ session_id: 's1', created_at: '2026-07-10T09:00:40Z', context_tokens: 120 }),
    ]
    const data = buildUsageChartData(snaps, 'day')
    expect(data).toHaveLength(1)
    expect(data[0].context_tokens).toBe(120) // chỉ snapshot mới nhất của s1, không cộng 100+120
  })

  it('week/month → day buckets (dd/MM)', () => {
    const snaps = [
      snap({ session_id: 's1', created_at: '2026-07-09T09:00:00Z', context_tokens: 100 }),
      snap({ session_id: 's2', created_at: '2026-07-10T09:00:00Z', context_tokens: 50 }),
    ]
    const data = buildUsageChartData(snaps, 'week')
    expect(data).toHaveLength(2)
    expect(data.map((d) => d.label)).toEqual(['09/07', '10/07'])
  })

  it('empty input → []', () => {
    expect(buildUsageChartData([], 'day')).toEqual([])
  })
})

// ── periodToTimestampBounds ───────────────────────────────────────────────────

describe('periodToTimestampBounds', () => {
  // Tz-agnostic: cận = nửa đêm LOCAL của viewer, serialize sang UTC instant.
  it('start = local midnight của start; end = local midnight ngày sau end (UTC instants)', () => {
    const { startISO, endExclusiveISO } = periodToTimestampBounds('2026-07-06', '2026-07-12')
    expect(startISO).toBe(new Date('2026-07-06T00:00:00').toISOString())
    expect(endExclusiveISO).toBe(new Date('2026-07-13T00:00:00').toISOString())
  })

  it('single day → khoảng đúng 24h', () => {
    const { startISO, endExclusiveISO } = periodToTimestampBounds('2026-07-10', '2026-07-10')
    expect(startISO).toBe(new Date('2026-07-10T00:00:00').toISOString())
    const spanHours = (new Date(endExclusiveISO).getTime() - new Date(startISO).getTime()) / 3_600_000
    expect(spanHours).toBe(24)
  })
})
