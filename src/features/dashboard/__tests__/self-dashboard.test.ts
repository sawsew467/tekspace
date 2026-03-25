import { describe, it, expect } from 'vitest'
import { calcCommitmentRate, formatCommitmentRate } from '../utils/dashboard.utils'

// ── calcCommitmentRate ────────────────────────────────────────────────────────

describe('calcCommitmentRate', () => {
  it('tính đúng rate < 1 (22h / 35h)', () => {
    expect(calcCommitmentRate(22, 35)).toBeCloseTo(0.6286, 3)
  })

  it('trả về null khi committedHours = 0', () => {
    expect(calcCommitmentRate(10, 0)).toBeNull()
  })

  it('trả về null khi committedHours < 0', () => {
    expect(calcCommitmentRate(10, -5)).toBeNull()
  })

  it('100% khi actual === committed', () => {
    expect(calcCommitmentRate(40, 40)).toBe(1)
  })

  it('> 100% khi actual > committed (over-commit)', () => {
    expect(calcCommitmentRate(50, 40)).toBeCloseTo(1.25)
  })

  it('0% khi actual = 0', () => {
    expect(calcCommitmentRate(0, 40)).toBe(0)
  })

  it('committed hours rất nhỏ (1h) vẫn tính đúng', () => {
    expect(calcCommitmentRate(1, 1)).toBe(1)
  })
})

// ── formatCommitmentRate ──────────────────────────────────────────────────────

describe('formatCommitmentRate', () => {
  it('"22h / 35h = 63%"', () => {
    expect(formatCommitmentRate(22, 35)).toBe('22h / 35h = 63%')
  })

  it('"40h / 40h = 100%"', () => {
    expect(formatCommitmentRate(40, 40)).toBe('40h / 40h = 100%')
  })

  it('"10h" khi committed = 0 (no negative framing)', () => {
    expect(formatCommitmentRate(10, 0)).toBe('10h')
  })

  it('"0h / 35h = 0%"', () => {
    expect(formatCommitmentRate(0, 35)).toBe('0h / 35h = 0%')
  })

  it('over-commit: "50h / 40h = 125%"', () => {
    expect(formatCommitmentRate(50, 40)).toBe('50h / 40h = 125%')
  })

  it('làm tròn đúng: 22/35 = 62.857... → "63%"', () => {
    const result = formatCommitmentRate(22, 35)
    expect(result).toContain('63%')
  })

  it('F9 — float actual hours được làm tròn: 7.5h → "8h / 35h = 23%"', () => {
    expect(formatCommitmentRate(7.5, 35)).toBe('8h / 35h = 23%')
  })

  it('F8 — negative actual hours được clamp về 0: -5h → "0h / 35h = 0%"', () => {
    expect(formatCommitmentRate(-5, 35)).toBe('0h / 35h = 0%')
  })

  it('F8 — negative actual + committed = 0 → "0h"', () => {
    expect(formatCommitmentRate(-3, 0)).toBe('0h')
  })
})

// ── Anonymous comparison visibility logic ────────────────────────────────────
// Test logic thực sự của showComparison: (member_count ?? 0) >= 4
// member_count = số người KHÁC đã submit (exclude self) — từ RPC get_team_avg_commitment_rate

type TeamAvgResult = { member_count: number; avg_rate: number | null } | undefined

function showComparison(teamAvg: TeamAvgResult): boolean {
  return (teamAvg?.member_count ?? 0) >= 4
}

describe('showComparison (anonymous comparison visibility)', () => {
  it('ẩn khi teamAvg là undefined (đang load hoặc lỗi)', () => {
    expect(showComparison(undefined)).toBe(false)
  })

  it('ẩn khi member_count = 0 (không ai submit ngoài mình)', () => {
    expect(showComparison({ member_count: 0, avg_rate: null })).toBe(false)
  })

  it('ẩn khi member_count = 3 (chưa đủ để ẩn danh)', () => {
    expect(showComparison({ member_count: 3, avg_rate: 0.75 })).toBe(false)
  })

  it('hiển thị khi member_count = 4 (đúng ngưỡng)', () => {
    expect(showComparison({ member_count: 4, avg_rate: 0.75 })).toBe(true)
  })

  it('hiển thị khi member_count = 10 (team lớn)', () => {
    expect(showComparison({ member_count: 10, avg_rate: 0.8 })).toBe(true)
  })

  it('ẩn khi avg_rate là null nhưng member_count < 4', () => {
    expect(showComparison({ member_count: 2, avg_rate: null })).toBe(false)
  })

  it('hiển thị khi avg_rate là null nhưng member_count >= 4 (họ submit nhưng rate = 0/null)', () => {
    expect(showComparison({ member_count: 4, avg_rate: null })).toBe(true)
  })
})

// ── getSelfWeekHours reduction logic ─────────────────────────────────────────

describe('sum hours_logged (reduction logic)', () => {
  // Mirrors getSelfWeekHours: (Number(r.hours_logged) || 0)
  const sumHours = (rows: { hours_logged: number | string | null }[]) =>
    rows.reduce((sum, r) => sum + (Number(r.hours_logged) || 0), 0)

  it('sum 3 ngày = tổng đúng', () => {
    expect(sumHours([
      { hours_logged: 8 },
      { hours_logged: 7.5 },
      { hours_logged: 6 },
    ])).toBe(21.5)
  })

  it('empty array → 0', () => {
    expect(sumHours([])).toBe(0)
  })

  it('string number được convert đúng', () => {
    expect(sumHours([{ hours_logged: '8' }, { hours_logged: '6.5' }])).toBe(14.5)
  })

  it('null value không gây NaN — bị bỏ qua (tính là 0)', () => {
    expect(sumHours([{ hours_logged: 8 }, { hours_logged: null }])).toBe(8)
  })

  it('NaN string không gây NaN — bị bỏ qua (tính là 0)', () => {
    expect(sumHours([{ hours_logged: 'invalid' }, { hours_logged: 6 }])).toBe(6)
  })
})
