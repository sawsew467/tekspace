import { describe, it, expect } from 'vitest'
import {
  buildWeeklyChartData,
  calcAvgCommitmentRate,
  formatRate,
  getTimeRange,
  getCommitmentRateColorClass,
} from '../utils/analytics.utils'

describe('SelfAnalytics — highlight logic', () => {
  it('buildWeeklyChartData generates full range even with gaps', () => {
    // 2026-03-09 (Mon) và 2026-03-16 (Mon) → 2 tuần
    const data = buildWeeklyChartData(
      [{ weekOf: '2026-03-16', actualHours: 20 }],
      '2026-03-09',
      '2026-03-22',
      35,
    )
    expect(data).toHaveLength(2)
    expect(data[0].actual).toBe(0) // tuần 09/03 không có report → 0
    expect(data[1].actual).toBe(20) // tuần 16/03 → 20h
    expect(data[0].committed).toBe(35)
    expect(data[1].committed).toBe(35)
  })

  it('buildWeeklyChartData formats weekLabel as dd/MM', () => {
    const data = buildWeeklyChartData([], '2026-03-16', '2026-03-22', 35)
    expect(data).toHaveLength(1)
    expect(data[0].weekLabel).toBe('16/03')
  })

  it('getCommitmentRateColorClass: < 70% → destructive', () => {
    // AC3: tuần có rate < 70% → highlight đỏ (Bar Cell fill = var(--destructive))
    expect(getCommitmentRateColorClass(20 / 35)).toBe('text-destructive font-semibold') // ~57%
    expect(getCommitmentRateColorClass(0.699)).toBe('text-destructive font-semibold')   // vừa dưới ngưỡng
  })

  it('getCommitmentRateColorClass: 70–84% → amber', () => {
    expect(getCommitmentRateColorClass(0.7)).toBe('text-amber-600 dark:text-amber-400 font-semibold')  // đúng ngưỡng 70%
    expect(getCommitmentRateColorClass(0.8)).toBe('text-amber-600 dark:text-amber-400 font-semibold')
  })

  it('getCommitmentRateColorClass: ≥ 85% → foreground bình thường', () => {
    expect(getCommitmentRateColorClass(0.85)).toBe('text-foreground')
    expect(getCommitmentRateColorClass(1.0)).toBe('text-foreground')
    expect(getCommitmentRateColorClass(1.2)).toBe('text-foreground')  // vượt 100% vẫn bình thường
  })

  it('getCommitmentRateColorClass: null → muted (chưa có data)', () => {
    expect(getCommitmentRateColorClass(null)).toBe('text-muted-foreground')
  })

  it('calcAvgCommitmentRate trả về null khi không có data', () => {
    expect(calcAvgCommitmentRate([], 35)).toBeNull()
  })

  it('calcAvgCommitmentRate trả về null khi committedHours = 0', () => {
    expect(calcAvgCommitmentRate([{ weekOf: '2026-03-16', actualHours: 20 }], 0)).toBeNull()
  })

  it('calcAvgCommitmentRate tính đúng tổng actual / tổng committed', () => {
    const weekly = [
      { weekOf: '2026-03-09', actualHours: 20 },
      { weekOf: '2026-03-16', actualHours: 35 },
    ]
    // totalActual = 55, totalCommitted = 35 * 2 = 70 → 55/70 ≈ 0.786
    const rate = calcAvgCommitmentRate(weekly, 35)
    expect(rate).not.toBeNull()
    expect(rate!).toBeCloseTo(55 / 70, 5)
  })

  it('formatRate hiển thị "—" khi null', () => {
    expect(formatRate(null)).toBe('—')
  })

  it('formatRate hiển thị percentage khi có rate', () => {
    expect(formatRate(20 / 35)).toBe('57%')
    expect(formatRate(1.0)).toBe('100%')
    expect(formatRate(0.7)).toBe('70%')
  })

  it('getTimeRange với weeksBack=4 trả về đủ 4 tuần', () => {
    const { startDate, endDate } = getTimeRange(4)
    const start = new Date(startDate + 'T00:00:00')
    const end = new Date(endDate + 'T00:00:00')
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    // 4 tuần = 27 ngày (Mon→Sun, 4 ISO weeks)
    expect(diffDays).toBe(27)
  })
})
