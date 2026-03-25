import { describe, it, expect } from 'vitest'
import {
  groupReportsByWeek,
  buildWeeklyChartData,
  calcAvgCommitmentRate,
  formatRate,
  getCommitmentRateColorClass,
  getCurrentWeekRange,
  getTimeRange,
  getCommittedHoursAtDate,
} from '../utils/analytics.utils'

// ── groupReportsByWeek ────────────────────────────────────────────────────────

describe('groupReportsByWeek', () => {
  it('returns empty array for empty input', () => {
    expect(groupReportsByWeek([])).toEqual([])
  })

  it('groups multiple reports in the same week', () => {
    const reports = [
      { report_date: '2026-03-23', hours_logged: 8 }, // Monday
      { report_date: '2026-03-24', hours_logged: 7 }, // Tuesday
      { report_date: '2026-03-25', hours_logged: 6 }, // Wednesday
    ]
    const result = groupReportsByWeek(reports)
    expect(result).toHaveLength(1)
    expect(result[0].weekOf).toBe('2026-03-23') // Monday of the week
    expect(result[0].actualHours).toBe(21)
  })

  it('groups reports from different weeks separately', () => {
    const reports = [
      { report_date: '2026-03-16', hours_logged: 8 }, // Week 1 (Mon)
      { report_date: '2026-03-23', hours_logged: 7 }, // Week 2 (Mon)
    ]
    const result = groupReportsByWeek(reports)
    expect(result).toHaveLength(2)
    expect(result[0].weekOf).toBe('2026-03-16')
    expect(result[1].weekOf).toBe('2026-03-23')
  })

  it('returns result sorted ascending by weekOf', () => {
    const reports = [
      { report_date: '2026-03-23', hours_logged: 5 }, // Week 2
      { report_date: '2026-03-16', hours_logged: 8 }, // Week 1
    ]
    const result = groupReportsByWeek(reports)
    expect(result[0].weekOf).toBe('2026-03-16')
    expect(result[1].weekOf).toBe('2026-03-23')
  })

  it('handles Sunday belonging to previous ISO week', () => {
    // 2026-03-22 is Sunday → ISO week starts 2026-03-16
    const reports = [
      { report_date: '2026-03-22', hours_logged: 4 }, // Sunday → belongs to prev week
      { report_date: '2026-03-23', hours_logged: 6 }, // Monday → new week
    ]
    const result = groupReportsByWeek(reports)
    expect(result).toHaveLength(2)
    expect(result[0].weekOf).toBe('2026-03-16') // Sunday 22 belongs here
    expect(result[1].weekOf).toBe('2026-03-23') // Monday 23 starts new week
  })
})

// ── getCommittedHoursAtDate ───────────────────────────────────────────────────

describe('getCommittedHoursAtDate', () => {
  const history = [
    { effective_from: '2026-01-06', effective_to: '2026-03-16', committed_hours: 40 },
    { effective_from: '2026-03-16', effective_to: null, committed_hours: 32 },
  ]

  it('trả về giá trị đúng theo tuần — trước khi đổi', () => {
    expect(getCommittedHoursAtDate(history, '2026-03-09', 40)).toBe(40)
  })

  it('trả về giá trị đúng theo tuần — tuần đổi (effective_from = weekStart)', () => {
    expect(getCommittedHoursAtDate(history, '2026-03-16', 40)).toBe(32)
  })

  it('trả về giá trị đúng theo tuần — sau khi đổi', () => {
    expect(getCommittedHoursAtDate(history, '2026-03-23', 40)).toBe(32)
  })

  it('trả về fallback khi history rỗng', () => {
    expect(getCommittedHoursAtDate([], '2026-03-23', 40)).toBe(40)
  })

  it('trả về fallback khi không có record nào bao gồm weekStart', () => {
    // weekStart trước tất cả records
    expect(getCommittedHoursAtDate(history, '2026-01-01', 40)).toBe(40)
  })

  it('record với effective_to = ngày trước weekStart không áp dụng', () => {
    // effective_to = '2026-03-16' → không áp dụng cho weekStart = '2026-03-16'
    // vì effective_to > weekStart phải đúng (> không phải >=)
    const singleRecord = [{ effective_from: '2026-01-06', effective_to: '2026-03-16', committed_hours: 40 }]
    expect(getCommittedHoursAtDate(singleRecord, '2026-03-16', 99)).toBe(99)
  })
})

// ── buildWeeklyChartData ──────────────────────────────────────────────────────

describe('buildWeeklyChartData', () => {
  it('generates data point for every week in range', () => {
    // Range: 4 weeks (Mon 2026-03-02 → Sun 2026-03-29)
    const result = buildWeeklyChartData([], '2026-03-02', '2026-03-29', [], 40)
    expect(result).toHaveLength(4)
  })

  it('sets actual to 0 for weeks with no reports', () => {
    const result = buildWeeklyChartData([], '2026-03-23', '2026-03-29', [], 40)
    expect(result).toHaveLength(1)
    expect(result[0].actual).toBe(0)
    expect(result[0].committed).toBe(40)
  })

  it('merges actual hours from weeklyHours data', () => {
    const weeklyHours = [{ weekOf: '2026-03-23', actualHours: 35 }]
    const result = buildWeeklyChartData(weeklyHours, '2026-03-23', '2026-03-29', [], 40)
    expect(result[0].actual).toBe(35)
    expect(result[0].committed).toBe(40)
  })

  it('formats week labels as dd/MM', () => {
    const result = buildWeeklyChartData([], '2026-03-23', '2026-03-29', [], 40)
    expect(result[0].weekLabel).toBe('23/03')
  })

  it('generates correct number of weeks for 4-week range', () => {
    const { startDate, endDate } = getTimeRange(4)
    const result = buildWeeklyChartData([], startDate, endDate, [], 40)
    expect(result).toHaveLength(4)
  })

  it('dùng committed hours lịch sử đúng cho từng tuần', () => {
    const history = [
      { effective_from: '2026-01-01', effective_to: '2026-03-16', committed_hours: 40 },
      { effective_from: '2026-03-16', effective_to: null, committed_hours: 32 },
    ]
    const result = buildWeeklyChartData(
      [],
      '2026-03-09',
      '2026-03-22',
      history,
      40,
    )
    expect(result).toHaveLength(2)
    expect(result[0].committed).toBe(40) // tuần 09/03 — trước khi đổi
    expect(result[1].committed).toBe(32) // tuần 16/03 — sau khi đổi
  })

  it('fallback committed khi history rỗng', () => {
    const result = buildWeeklyChartData([], '2026-03-23', '2026-03-29', [], 35)
    expect(result[0].committed).toBe(35)
  })
})

// ── calcAvgCommitmentRate ─────────────────────────────────────────────────────

describe('calcAvgCommitmentRate', () => {
  it('returns null for empty weekly data', () => {
    expect(calcAvgCommitmentRate([], 40)).toBeNull()
  })

  it('returns null when committedHoursPerWeek is 0', () => {
    const data = [{ weekOf: '2026-03-23', actualHours: 35 }]
    expect(calcAvgCommitmentRate(data, 0)).toBeNull()
  })

  it('returns null when committedHoursPerWeek is negative', () => {
    const data = [{ weekOf: '2026-03-23', actualHours: 35 }]
    expect(calcAvgCommitmentRate(data, -1)).toBeNull()
  })

  it('calculates correct rate for single week (35/40 = 0.875)', () => {
    const data = [{ weekOf: '2026-03-23', actualHours: 35 }]
    const rate = calcAvgCommitmentRate(data, 40)
    expect(rate).toBeCloseTo(0.875)
  })

  it('calculates correct average across multiple weeks', () => {
    // Week1: 20h, Week2: 40h → total 60 / (40 * 2) = 0.75
    const data = [
      { weekOf: '2026-03-16', actualHours: 20 },
      { weekOf: '2026-03-23', actualHours: 40 },
    ]
    const rate = calcAvgCommitmentRate(data, 40)
    expect(rate).toBeCloseTo(0.75)
  })

  it('allows rate > 1.0 when actual > committed', () => {
    const data = [{ weekOf: '2026-03-23', actualHours: 50 }]
    const rate = calcAvgCommitmentRate(data, 40)
    expect(rate).toBeCloseTo(1.25)
  })
})

// ── formatRate ────────────────────────────────────────────────────────────────

describe('formatRate', () => {
  it('returns "—" for null', () => {
    expect(formatRate(null)).toBe('—')
  })

  it('formats 0.875 as "88%"', () => {
    expect(formatRate(0.875)).toBe('88%')
  })

  it('formats 0.75 as "75%"', () => {
    expect(formatRate(0.75)).toBe('75%')
  })

  it('formats 1.0 as "100%"', () => {
    expect(formatRate(1.0)).toBe('100%')
  })

  it('formats 0.0 as "0%"', () => {
    expect(formatRate(0.0)).toBe('0%')
  })

  it('rounds 0.6357 to "64%"', () => {
    expect(formatRate(0.6357)).toBe('64%')
  })
})

// ── getCommitmentRateColorClass ───────────────────────────────────────────────

describe('getCommitmentRateColorClass', () => {
  it('returns muted for null rate', () => {
    expect(getCommitmentRateColorClass(null)).toContain('muted')
  })

  it('returns destructive for rate < 0.70', () => {
    expect(getCommitmentRateColorClass(0.69)).toContain('destructive')
    expect(getCommitmentRateColorClass(0.0)).toContain('destructive')
  })

  it('returns amber for rate 0.70–0.84', () => {
    const cls70 = getCommitmentRateColorClass(0.70)
    expect(cls70).toContain('amber')
    const cls84 = getCommitmentRateColorClass(0.84)
    expect(cls84).toContain('amber')
  })

  it('returns default foreground for rate >= 0.85', () => {
    const cls = getCommitmentRateColorClass(0.85)
    expect(cls).toContain('foreground')
    expect(cls).not.toContain('destructive')
    expect(cls).not.toContain('amber')
  })

  it('handles rate exactly at 0.70 boundary → amber', () => {
    const cls = getCommitmentRateColorClass(0.70)
    expect(cls).toContain('amber')
  })

  it('handles rate exactly at 0.85 boundary → foreground', () => {
    const cls = getCommitmentRateColorClass(0.85)
    expect(cls).toContain('foreground')
  })
})

// ── getCurrentWeekRange ───────────────────────────────────────────────────────

describe('getCurrentWeekRange', () => {
  it('returns weekStart as Monday (ISO week)', () => {
    const { weekStart } = getCurrentWeekRange()
    const d = new Date(weekStart + 'T00:00:00')
    expect(d.getDay()).toBe(1) // Monday = 1
  })

  it('returns weekEnd as Sunday', () => {
    const { weekEnd } = getCurrentWeekRange()
    const d = new Date(weekEnd + 'T00:00:00')
    expect(d.getDay()).toBe(0) // Sunday = 0
  })

  it('weekEnd is 6 days after weekStart', () => {
    const { weekStart, weekEnd } = getCurrentWeekRange()
    const startMs = new Date(weekStart + 'T00:00:00').getTime()
    const endMs = new Date(weekEnd + 'T00:00:00').getTime()
    expect(endMs - startMs).toBe(6 * 24 * 60 * 60 * 1000)
  })
})

// ── getTimeRange ──────────────────────────────────────────────────────────────

describe('getTimeRange', () => {
  it('returns 4 weeks for weeksBack=4', () => {
    const { startDate, endDate } = getTimeRange(4)
    const result = buildWeeklyChartData([], startDate, endDate, [], 40)
    expect(result).toHaveLength(4)
  })

  it('returns 8 weeks for weeksBack=8', () => {
    const { startDate, endDate } = getTimeRange(8)
    const result = buildWeeklyChartData([], startDate, endDate, [], 40)
    expect(result).toHaveLength(8)
  })

  it('returns 12 weeks for weeksBack=12', () => {
    const { startDate, endDate } = getTimeRange(12)
    const result = buildWeeklyChartData([], startDate, endDate, [], 40)
    expect(result).toHaveLength(12)
  })

  it('endDate is Sunday of current week', () => {
    const { endDate } = getTimeRange(4)
    const d = new Date(endDate + 'T00:00:00')
    expect(d.getDay()).toBe(0) // Sunday
  })
})
