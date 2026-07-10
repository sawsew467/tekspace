import { describe, it, expect } from 'vitest'
import {
  getPeriodRange,
  shiftPeriod,
  isCurrentOrFuturePeriod,
  formatPeriodLabel,
  getWindowRange,
  getPeriodCommittedMultiplier,
  buildDailyChartData,
  buildYearlyChartData,
  getGranularityUnit,
  type Period,
} from '../utils/analytics.utils'

// ── getPeriodRange ────────────────────────────────────────────────────────────

describe('getPeriodRange', () => {
  it('day → same start/end', () => {
    expect(getPeriodRange({ granularity: 'day', anchor: '2026-07-10' })).toEqual({
      start: '2026-07-10',
      end: '2026-07-10',
    })
  })

  it('week → ISO week Mon–Sun containing anchor', () => {
    // 2026-07-10 is a Friday
    expect(getPeriodRange({ granularity: 'week', anchor: '2026-07-10' })).toEqual({
      start: '2026-07-06', // Monday
      end: '2026-07-12', // Sunday
    })
  })

  it('month → full calendar month', () => {
    expect(getPeriodRange({ granularity: 'month', anchor: '2026-02-15' })).toEqual({
      start: '2026-02-01',
      end: '2026-02-28',
    })
  })

  it('year → full calendar year', () => {
    expect(getPeriodRange({ granularity: 'year', anchor: '2026-07-10' })).toEqual({
      start: '2026-01-01',
      end: '2026-12-31',
    })
  })
})

// ── shiftPeriod ───────────────────────────────────────────────────────────────

describe('shiftPeriod', () => {
  it('day ±1', () => {
    expect(shiftPeriod({ granularity: 'day', anchor: '2026-07-10' }, -1).anchor).toBe('2026-07-09')
    expect(shiftPeriod({ granularity: 'day', anchor: '2026-07-10' }, 1).anchor).toBe('2026-07-11')
  })

  it('week ±1 shifts by 7 days', () => {
    expect(shiftPeriod({ granularity: 'week', anchor: '2026-07-10' }, -1).anchor).toBe('2026-07-03')
  })

  it('month back keeps landing in the correct month even at month-end anchor', () => {
    // 2026-03-31 back one month should resolve to a February date (clamped), not skip to March
    const prev = shiftPeriod({ granularity: 'month', anchor: '2026-03-31' }, -1)
    expect(getPeriodRange(prev)).toEqual({ start: '2026-02-01', end: '2026-02-28' })
  })

  it('year ±1', () => {
    expect(shiftPeriod({ granularity: 'year', anchor: '2026-07-10' }, -1).anchor).toBe('2025-07-10')
  })
})

// ── isCurrentOrFuturePeriod ───────────────────────────────────────────────────

describe('isCurrentOrFuturePeriod', () => {
  const now = new Date('2026-07-10T09:00:00')

  it('true for the period containing now', () => {
    expect(isCurrentOrFuturePeriod({ granularity: 'week', anchor: '2026-07-10' }, now)).toBe(true)
  })

  it('true for a future period', () => {
    expect(isCurrentOrFuturePeriod({ granularity: 'month', anchor: '2026-09-01' }, now)).toBe(true)
  })

  it('false for a past period', () => {
    expect(isCurrentOrFuturePeriod({ granularity: 'month', anchor: '2026-05-01' }, now)).toBe(false)
  })
})

// ── formatPeriodLabel ─────────────────────────────────────────────────────────

describe('formatPeriodLabel', () => {
  it('day', () => {
    expect(formatPeriodLabel({ granularity: 'day', anchor: '2026-07-10' })).toBe('10/07/2026')
  })

  it('week', () => {
    expect(formatPeriodLabel({ granularity: 'week', anchor: '2026-07-10' })).toBe(
      'Tuần 06/07–12/07/2026',
    )
  })

  it('month', () => {
    expect(formatPeriodLabel({ granularity: 'month', anchor: '2026-07-10' })).toBe('07/2026')
  })

  it('year', () => {
    expect(formatPeriodLabel({ granularity: 'year', anchor: '2026-07-10' })).toBe('2026')
  })
})

// ── getWindowRange ────────────────────────────────────────────────────────────

describe('getWindowRange', () => {
  it('day window of 14 buckets ends at anchor day', () => {
    const { start, end } = getWindowRange('day', '2026-07-10', 14)
    expect(end).toBe('2026-07-10')
    expect(start).toBe('2026-06-27') // 13 days earlier
  })

  it('week window of 4 buckets spans 4 ISO weeks', () => {
    const { start, end } = getWindowRange('week', '2026-07-10', 4)
    expect(end).toBe('2026-07-12') // Sunday of anchor week
    expect(start).toBe('2026-06-15') // Monday 3 weeks earlier
  })

  it('throws for bucketCount < 1', () => {
    expect(() => getWindowRange('week', '2026-07-10', 0)).toThrow()
  })
})

// ── buildDailyChartData ───────────────────────────────────────────────────────

describe('buildDailyChartData', () => {
  it('fills every day in range with 0 for gaps', () => {
    const result = buildDailyChartData([], '2026-07-06', '2026-07-12', 8)
    expect(result).toHaveLength(7)
    expect(result.every(d => d.actual === 0)).toBe(true)
  })

  it('label formatted dd/MM and sums per day', () => {
    const reports = [
      { report_date: '2026-07-06', hours_logged: 4 },
      { report_date: '2026-07-06', hours_logged: 4 },
    ]
    const result = buildDailyChartData(reports, '2026-07-06', '2026-07-06', 8)
    expect(result[0].label).toBe('06/07')
    expect(result[0].actual).toBe(8)
  })

  it('committed applies to weekdays only, 0 on weekend', () => {
    // 2026-07-11 = Saturday, 2026-07-12 = Sunday
    const result = buildDailyChartData([], '2026-07-10', '2026-07-12', 8)
    expect(result[0].committed).toBe(8) // Fri
    expect(result[1].committed).toBe(0) // Sat
    expect(result[2].committed).toBe(0) // Sun
  })
})

// ── buildYearlyChartData ──────────────────────────────────────────────────────

describe('buildYearlyChartData', () => {
  it('one bucket per year, gaps filled with 0 actual', () => {
    const result = buildYearlyChartData([], '2024-01-01', '2026-12-31', 40)
    expect(result.map(r => r.label)).toEqual(['2024', '2025', '2026'])
    expect(result.every(r => r.actual === 0)).toBe(true)
  })

  it('sums weekly hours into the matching year', () => {
    const weekly = [
      { weekOf: '2025-03-03', actualHours: 40 },
      { weekOf: '2025-03-10', actualHours: 35 },
      { weekOf: '2026-01-05', actualHours: 20 },
    ]
    const result = buildYearlyChartData(weekly, '2025-01-01', '2026-12-31', 40)
    expect(result.find(r => r.label === '2025')?.actual).toBe(75)
    expect(result.find(r => r.label === '2026')?.actual).toBe(20)
  })

  it('committed = weeks-in-year × weekly committed (≈52)', () => {
    const result = buildYearlyChartData([], '2026-01-01', '2026-12-31', 40)
    const committed = result[0].committed
    expect(committed).toBeGreaterThanOrEqual(52 * 40)
    expect(committed).toBeLessThanOrEqual(53 * 40)
  })
})

// ── getPeriodCommittedMultiplier ──────────────────────────────────────────────

describe('getPeriodCommittedMultiplier', () => {
  it('week → 1', () => {
    expect(getPeriodCommittedMultiplier({ granularity: 'week', anchor: '2026-07-10' })).toBe(1)
  })

  it('day weekday → 1/5, weekend → 0', () => {
    // 2026-07-10 Friday, 2026-07-11 Saturday
    expect(getPeriodCommittedMultiplier({ granularity: 'day', anchor: '2026-07-10' })).toBeCloseTo(0.2)
    expect(getPeriodCommittedMultiplier({ granularity: 'day', anchor: '2026-07-11' })).toBe(0)
  })

  it('month → ISO weeks starting in month (4–5)', () => {
    const m = getPeriodCommittedMultiplier({ granularity: 'month', anchor: '2026-07-10' })
    expect(m).toBeGreaterThanOrEqual(4)
    expect(m).toBeLessThanOrEqual(5)
  })

  it('year → ISO weeks starting in year (52–53)', () => {
    const y = getPeriodCommittedMultiplier({ granularity: 'year', anchor: '2026-07-10' })
    expect(y).toBeGreaterThanOrEqual(52)
    expect(y).toBeLessThanOrEqual(53)
  })
})

// ── getGranularityUnit ────────────────────────────────────────────────────────

describe('getGranularityUnit', () => {
  it('maps to Vietnamese unit labels', () => {
    expect(getGranularityUnit('day')).toBe('ngày')
    expect(getGranularityUnit('week')).toBe('tuần')
    expect(getGranularityUnit('month')).toBe('tháng')
    expect(getGranularityUnit('year')).toBe('năm')
  })
})

// ── round-trip: shift then range stays consistent ─────────────────────────────

describe('shift + range round-trip', () => {
  it('shifting week forward then back returns same range', () => {
    const p: Period = { granularity: 'week', anchor: '2026-07-10' }
    const back = shiftPeriod(shiftPeriod(p, 1), -1)
    expect(getPeriodRange(back)).toEqual(getPeriodRange(p))
  })
})
