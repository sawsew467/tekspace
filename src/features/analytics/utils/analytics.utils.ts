import { format, startOfISOWeek, endOfISOWeek, subWeeks, addDays, startOfMonth, endOfMonth, subMonths, addMonths, startOfYear, endOfYear, addYears } from 'date-fns'
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
    const weekCount = countISOWeekStarts(currentMonth, monthEnd)

    result.push({
      monthLabel,
      actual: actualByMonth.get(monthKey) ?? 0,
      committed: weekCount * fallbackCommittedHours,
    })

    currentMonth = addMonths(currentMonth, 1)
  }

  return result
}

// ── Period model (Ngày/Tuần/Tháng/Năm + điều hướng kỳ) ──────────────────────────

/**
 * Granularity — mức gom thời gian dùng chung cho bảng nhóm và chart cá nhân.
 */
export type Granularity = 'day' | 'week' | 'month' | 'year'

/**
 * Period — một kỳ thời gian. anchor là 'yyyy-MM-dd' bất kỳ nằm trong kỳ;
 * range thực tế suy ra qua getPeriodRange (không phụ thuộc ngày cụ thể của anchor).
 */
export type Period = { granularity: Granularity; anchor: string }

/** Số ngày làm việc/tuần — dùng quy đổi committed hàng tuần sang committed/ngày. */
export const WORKDAYS_PER_WEEK = 5

/** parseAnchor — 'yyyy-MM-dd' → Date tại local midnight (tránh lệch UTC). */
function parseAnchor(anchor: string): Date {
  return new Date(anchor + 'T00:00:00')
}

/**
 * countISOWeekStarts — số tuần ISO (thứ Hai) bắt đầu trong khoảng [rangeStart, rangeEnd].
 * Dùng để quy đổi committed hàng tuần sang committed cho tháng/năm.
 */
function countISOWeekStarts(rangeStart: Date, rangeEnd: Date): number {
  let count = 0
  let d = startOfISOWeek(rangeStart)
  if (d < rangeStart) d = addDays(d, 7) // Monday đầu tiên >= rangeStart
  while (d <= rangeEnd) {
    count++
    d = addDays(d, 7)
  }
  return count
}

/**
 * getPeriodCommittedMultiplier — hệ số quy đổi committed hàng tuần sang tổng committed của kỳ.
 * week → 1; day → 1/số ngày làm việc (0 nếu T7/CN); month/year → số ISO week bắt đầu trong kỳ.
 * Nhân với committed hàng tuần của member để có mẫu số tỷ lệ đúng theo mức gom.
 */
export function getPeriodCommittedMultiplier(period: Period): number {
  switch (period.granularity) {
    case 'week':
      return 1
    case 'day': {
      const dow = parseAnchor(period.anchor).getDay() // 0=CN, 6=T7
      return dow === 0 || dow === 6 ? 0 : 1 / WORKDAYS_PER_WEEK
    }
    case 'month':
    case 'year': {
      const { start, end } = getPeriodRange(period)
      return countISOWeekStarts(parseAnchor(start), parseAnchor(end))
    }
  }
}

const GRANULARITY_UNIT: Record<Granularity, string> = {
  day: 'ngày',
  week: 'tuần',
  month: 'tháng',
  year: 'năm',
}

/** getGranularityUnit — nhãn đơn vị tiếng Việt cho một granularity (dùng cho legend/tooltip). */
export function getGranularityUnit(g: Granularity): string {
  return GRANULARITY_UNIT[g]
}

/**
 * getPeriodRange — suy ra { start, end } dạng 'yyyy-MM-dd' cho kỳ chứa anchor.
 * day → chính ngày đó; week → ISO week (Mon–Sun); month/year → calendar.
 */
export function getPeriodRange(period: Period): { start: string; end: string } {
  const d = parseAnchor(period.anchor)
  const fmt = (x: Date) => format(x, 'yyyy-MM-dd')
  switch (period.granularity) {
    case 'day':
      return { start: fmt(d), end: fmt(d) }
    case 'week':
      return { start: fmt(startOfISOWeek(d)), end: fmt(endOfISOWeek(d)) }
    case 'month':
      return { start: fmt(startOfMonth(d)), end: fmt(endOfMonth(d)) }
    case 'year':
      return { start: fmt(startOfYear(d)), end: fmt(endOfYear(d)) }
  }
}

/**
 * shiftPeriod — lùi (dir=-1) hoặc tiến (dir=1) một đơn vị theo granularity.
 * date-fns clamp cuối tháng nên không nhảy sai tháng khi anchor là ngày 29–31.
 */
export function shiftPeriod(period: Period, dir: -1 | 1): Period {
  const d = parseAnchor(period.anchor)
  let next: Date
  switch (period.granularity) {
    case 'day':
      next = addDays(d, dir)
      break
    case 'week':
      next = addDays(d, dir * 7)
      break
    case 'month':
      next = addMonths(d, dir)
      break
    case 'year':
      next = addYears(d, dir)
      break
  }
  return { granularity: period.granularity, anchor: format(next, 'yyyy-MM-dd') }
}

/**
 * isCurrentOrFuturePeriod — true nếu kỳ chứa anchor là kỳ hiện tại hoặc tương lai.
 * Dùng để disable nút "tiến" (không cho vượt kỳ hiện tại).
 */
export function isCurrentOrFuturePeriod(period: Period, now: Date = new Date()): boolean {
  const nowPeriod: Period = { granularity: period.granularity, anchor: format(now, 'yyyy-MM-dd') }
  return getPeriodRange(period).start >= getPeriodRange(nowPeriod).start
}

/**
 * formatPeriodLabel — nhãn hiển thị cho kỳ:
 * day → 'dd/MM/yyyy'; week → 'Tuần dd/MM–dd/MM/yyyy'; month → 'MM/yyyy'; year → 'yyyy'.
 */
export function formatPeriodLabel(period: Period): string {
  const d = parseAnchor(period.anchor)
  switch (period.granularity) {
    case 'day':
      return format(d, 'dd/MM/yyyy')
    case 'week':
      return `Tuần ${format(startOfISOWeek(d), 'dd/MM')}–${format(endOfISOWeek(d), 'dd/MM/yyyy')}`
    case 'month':
      return format(d, 'MM/yyyy')
    case 'year':
      return format(d, 'yyyy')
  }
}

/**
 * getWindowRange — range 'yyyy-MM-dd' bao đúng `bucketCount` kỳ, kết thúc tại kỳ chứa anchor.
 * Dùng cho chart trend: hiển thị N bucket gần nhất tính từ anchor lùi về quá khứ.
 */
export function getWindowRange(
  granularity: Granularity,
  anchor: string,
  bucketCount: number,
): { start: string; end: string } {
  if (bucketCount < 1) throw new Error('getWindowRange: bucketCount phải >= 1')
  const endPeriod: Period = { granularity, anchor }
  let startPeriod: Period = endPeriod
  for (let i = 0; i < bucketCount - 1; i++) {
    startPeriod = shiftPeriod(startPeriod, -1)
  }
  return {
    start: getPeriodRange(startPeriod).start,
    end: getPeriodRange(endPeriod).end,
  }
}

/**
 * buildDailyChartData — tổng hợp raw daily reports theo từng ngày trong range.
 * Tạo đủ data point cho mọi ngày (kể cả ngày không có report = 0h).
 * committed/ngày chỉ áp cho ngày làm việc (T2–T6); T7/CN = 0 để đường cam kết hợp lý.
 * Label 'dd/MM'.
 */
export function buildDailyChartData(
  reports: { report_date: string; hours_logged: number }[],
  startDate: string,
  endDate: string,
  committedPerWorkday: number,
): { label: string; actual: number; committed: number }[] {
  const actualByDay = new Map<string, number>()
  for (const r of reports) {
    if (!r.report_date) continue
    actualByDay.set(r.report_date, (actualByDay.get(r.report_date) ?? 0) + r.hours_logged)
  }

  const result: { label: string; actual: number; committed: number }[] = []
  let current = parseAnchor(startDate)
  const end = parseAnchor(endDate)
  while (current <= end) {
    const key = format(current, 'yyyy-MM-dd')
    const dow = current.getDay() // 0=CN, 6=T7
    const isWorkday = dow !== 0 && dow !== 6
    result.push({
      label: format(current, 'dd/MM'),
      actual: actualByDay.get(key) ?? 0,
      committed: isWorkday ? committedPerWorkday : 0,
    })
    current = addDays(current, 1)
  }
  return result
}

/**
 * buildYearlyChartData — tổng hợp weeklyHours theo calendar year.
 * Committed/năm = số ISO week bắt đầu trong năm × committed hàng tuần (≈52).
 * Tạo đủ data point cho mọi năm trong range. Label 'yyyy'.
 */
export function buildYearlyChartData(
  weeklyHours: { weekOf: string; actualHours: number }[],
  startDate: string,
  endDate: string,
  fallbackCommittedHours: number,
): { label: string; actual: number; committed: number }[] {
  const actualByYear = new Map<string, number>()
  for (const w of weeklyHours) {
    const yearKey = w.weekOf.substring(0, 4)
    actualByYear.set(yearKey, (actualByYear.get(yearKey) ?? 0) + w.actualHours)
  }

  const result: { label: string; actual: number; committed: number }[] = []
  let currentYear = startOfYear(parseAnchor(startDate))
  const endYearStart = startOfYear(parseAnchor(endDate))

  while (currentYear <= endYearStart) {
    const yearKey = format(currentYear, 'yyyy')
    const yearEnd = endOfYear(currentYear)
    const weekCount = countISOWeekStarts(currentYear, yearEnd)

    result.push({
      label: yearKey,
      actual: actualByYear.get(yearKey) ?? 0,
      committed: weekCount * fallbackCommittedHours,
    })

    currentYear = addYears(currentYear, 1)
  }

  return result
}
