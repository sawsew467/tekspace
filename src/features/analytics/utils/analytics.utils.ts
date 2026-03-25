import { format, startOfISOWeek, endOfISOWeek, subWeeks, addDays, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns'
import type { WeeklyHoursRow, CommittedHoursHistoryRow } from '@/features/analytics/services/analytics.service'

// ── Date range helpers ─────────────────────────────────────────────────────────

/**
 * getCurrentWeekRange — tuần ISO hiện tại (Mon–Sun).
 * Trả về { weekStart, weekEnd } dạng 'yyyy-MM-dd'.
 */
export function getCurrentWeekRange(): { weekStart: string; weekEnd: string } {
  const now = new Date()
  return {
    weekStart: format(startOfISOWeek(now), 'yyyy-MM-dd'),
    weekEnd: format(endOfISOWeek(now), 'yyyy-MM-dd'),
  }
}

/**
 * getTimeRange — tính startDate và endDate cho N tuần gần nhất (kể cả tuần hiện tại).
 * Trả về { startDate, endDate } dạng 'yyyy-MM-dd'.
 *
 * Ví dụ: weeksBack=4 → Monday 4 tuần trước → Sunday tuần này.
 */
export function getTimeRange(weeksBack: number): { startDate: string; endDate: string } {
  if (weeksBack < 1) throw new Error('getTimeRange: weeksBack phải >= 1')
  const now = new Date()
  const weekStart = startOfISOWeek(subWeeks(now, weeksBack - 1))
  const weekEnd = endOfISOWeek(now)
  return {
    startDate: format(weekStart, 'yyyy-MM-dd'),
    endDate: format(weekEnd, 'yyyy-MM-dd'),
  }
}

// ── Aggregation helpers ────────────────────────────────────────────────────────

/**
 * groupReportsByWeek — group daily report rows theo ISO week start (Monday).
 * Tính tổng hours_logged của mỗi tuần.
 * Trả về array đã sort theo weekOf ascending.
 */
export function groupReportsByWeek(
  reports: { report_date: string; hours_logged: number }[],
): WeeklyHoursRow[] {
  const weekMap = new Map<string, number>()
  for (const r of reports) {
    if (!r.report_date) continue // guard: bỏ qua row với ngày null/undefined
    const d = new Date(r.report_date + 'T00:00:00')
    if (isNaN(d.getTime())) continue // guard: bỏ qua ngày không hợp lệ
    const weekStart = format(startOfISOWeek(d), 'yyyy-MM-dd')
    const prev = weekMap.get(weekStart) ?? 0
    weekMap.set(weekStart, prev + r.hours_logged)
  }
  return Array.from(weekMap.entries())
    .map(([weekOf, actualHours]) => ({ weekOf, actualHours }))
    .sort((a, b) => a.weekOf.localeCompare(b.weekOf))
}

// ── Chart data builder ─────────────────────────────────────────────────────────

/**
 * getCommittedHoursAtDate — tìm committed hours có hiệu lực tại một ngày cụ thể.
 * Lookup: effective_from <= weekStart AND (effective_to IS NULL OR effective_to > weekStart)
 * Trả về fallbackHours nếu không tìm thấy record nào phù hợp.
 */
export function getCommittedHoursAtDate(
  history: CommittedHoursHistoryRow[],
  weekStart: string,       // 'yyyy-MM-dd'
  fallbackHours: number,   // member.committed_hours ?? tenant.default_committed_hours
): number {
  const record = history.find((r) =>
    r.effective_from <= weekStart &&
    (r.effective_to === null || r.effective_to > weekStart)
  )
  return record?.committed_hours ?? fallbackHours
}

/**
 * buildWeeklyChartData — merge weekly hours data với committed hours per week.
 * Tạo đủ data points cho mọi tuần trong range (kể cả tuần không có report = 0h).
 * Label hiển thị dạng "dd/MM" (ví dụ "17/03").
 * Mỗi tuần dùng committed hours có hiệu lực tại week_start (từ history).
 */
export function buildWeeklyChartData(
  weeklyHours: WeeklyHoursRow[],
  startDate: string,
  endDate: string,
  committedHoursHistory: CommittedHoursHistoryRow[],
  fallbackCommittedHours: number,  // member.committed_hours ?? tenant.default_committed_hours
): { weekLabel: string; actual: number; committed: number }[] {
  const hoursMap = new Map(weeklyHours.map(w => [w.weekOf, w.actualHours]))

  const result: { weekLabel: string; actual: number; committed: number }[] = []
  let current = startOfISOWeek(new Date(startDate + 'T00:00:00'))
  const end = new Date(endDate + 'T00:00:00')

  while (current <= end) {
    const weekOf = format(current, 'yyyy-MM-dd')
    const weekLabel = format(current, 'dd/MM')
    result.push({
      weekLabel,
      actual: hoursMap.get(weekOf) ?? 0,
      committed: getCommittedHoursAtDate(committedHoursHistory, weekOf, fallbackCommittedHours),
    })
    current = addDays(current, 7)
  }
  return result
}

// ── Commitment rate helpers ────────────────────────────────────────────────────

/**
 * calcCommitmentRate — tính tỷ lệ actual / committed cho một member trong một period.
 * Trả về null nếu committedHours <= 0 (tránh chia 0).
 * Không giới hạn trên: member có thể vượt 100%.
 */
export function calcCommitmentRate(actualHours: number, committedHours: number): number | null {
  if (committedHours <= 0) return null
  return actualHours / committedHours
}

/**
 * calcAvgCommitmentRate — tính average commitment rate từ weekly data.
 * Chỉ tính nếu có ít nhất 1 tuần data và committedHours > 0.
 * Trả về null nếu không đủ điều kiện tính.
 *
 * NOTE: Dùng tổng actual / tổng committed (không phải average of rates per week)
 * để tránh distortion từ tuần có committed = 0.
 */
export function calcAvgCommitmentRate(
  weeklyData: WeeklyHoursRow[],
  committedHoursPerWeek: number,
): number | null {
  if (!committedHoursPerWeek || committedHoursPerWeek <= 0) return null
  if (weeklyData.length === 0) return null
  const totalActual = weeklyData.reduce((sum, w) => sum + w.actualHours, 0)
  const totalCommitted = committedHoursPerWeek * weeklyData.length
  return totalActual / totalCommitted
}

/**
 * formatRate — format tỷ lệ thành chuỗi dạng "63%".
 * Trả về "—" nếu rate là null.
 */
export function formatRate(rate: number | null): string {
  if (rate === null) return '—'
  return `${Math.round(rate * 100)}%`
}

/**
 * getCommitmentRateColorClass — Tailwind class dựa trên commitment rate.
 * < 70%  → text-destructive (đỏ)
 * 70–84% → text-amber-600 dark:text-amber-400 (vàng)
 * ≥ 85%  → text-foreground (mặc định)
 * null   → text-muted-foreground (chưa có data)
 */
export function getCommitmentRateColorClass(rate: number | null): string {
  if (rate === null) return 'text-muted-foreground'
  if (rate < 0.7) return 'text-destructive font-semibold'
  if (rate < 0.85) return 'text-amber-600 dark:text-amber-400 font-semibold'
  return 'text-foreground'
}

// ── Monthly types & helpers ────────────────────────────────────────────────────

/**
 * getMonthTimeRange — tính startDate và endDate cho N tháng gần nhất (kể cả tháng hiện tại).
 * startDate = đầu tháng (N-1) tháng trước; endDate = cuối tháng hiện tại.
 */
export function getMonthTimeRange(monthsBack: number): { startDate: string; endDate: string } {
  if (monthsBack < 1) throw new Error('getMonthTimeRange: monthsBack phải >= 1')
  const now = new Date()
  return {
    startDate: format(startOfMonth(subMonths(now, monthsBack - 1)), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(now), 'yyyy-MM-dd'),
  }
}

/**
 * buildMonthlyChartData — tổng hợp weeklyHours theo calendar month.
 * Group theo month của weekOf (yyyy-MM = 7 ký tự đầu của weekOf).
 * Committed/tháng = số ISO weeks bắt đầu trong tháng × fallbackCommittedHours.
 * Tạo đủ data point cho mọi tháng trong range (kể cả tháng không có data = 0h).
 * Label hiển thị dạng 'MM/yyyy' (ví dụ '03/2026').
 */
export function buildMonthlyChartData(
  weeklyHours: { weekOf: string; actualHours: number }[],
  startDate: string,
  endDate: string,
  fallbackCommittedHours: number,
): { monthLabel: string; actual: number; committed: number }[] {
  // Group actual hours by month (weekOf 'yyyy-MM-dd' → substring(0,7) = 'yyyy-MM')
  const actualByMonth = new Map<string, number>()
  for (const w of weeklyHours) {
    const monthKey = w.weekOf.substring(0, 7)
    actualByMonth.set(monthKey, (actualByMonth.get(monthKey) ?? 0) + w.actualHours)
  }

  const result: { monthLabel: string; actual: number; committed: number }[] = []
  let currentMonth = startOfMonth(new Date(startDate + 'T00:00:00'))
  const endMonth = startOfMonth(new Date(endDate + 'T00:00:00'))

  while (currentMonth <= endMonth) {
    const monthKey = format(currentMonth, 'yyyy-MM')
    const monthLabel = format(currentMonth, 'MM/yyyy')
    const monthEnd = endOfMonth(currentMonth)

    // Count ISO weeks (Mondays) starting in this calendar month
    let weekCount = 0
    let d = startOfISOWeek(currentMonth)
    // Đảm bảo d là Monday >= đầu tháng
    if (d < currentMonth) d = addDays(d, 7)
    while (d <= monthEnd) {
      weekCount++
      d = addDays(d, 7)
    }

    result.push({
      monthLabel,
      actual: actualByMonth.get(monthKey) ?? 0,
      committed: weekCount * fallbackCommittedHours,
    })

    currentMonth = addMonths(currentMonth, 1)
  }

  return result
}
