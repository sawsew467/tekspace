// Shared period model — Ngày/Tuần/Tháng/Năm + điều hướng kỳ.
// Dùng chung cho analytics (report hours) và usage (Claude usage). Thuần, không side effect.

import {
  format,
  startOfISOWeek,
  endOfISOWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  addDays,
  addMonths,
  addYears,
} from 'date-fns'

/** Granularity — mức gom thời gian. */
export type Granularity = 'day' | 'week' | 'month' | 'year'

/**
 * Period — một kỳ thời gian. anchor là 'yyyy-MM-dd' bất kỳ nằm trong kỳ;
 * range thực tế suy ra qua getPeriodRange (không phụ thuộc ngày cụ thể của anchor).
 */
export type Period = { granularity: Granularity; anchor: string }

/** parseAnchor — 'yyyy-MM-dd' → Date tại local midnight (tránh lệch UTC). */
function parseAnchor(anchor: string): Date {
  return new Date(anchor + 'T00:00:00')
}

const GRANULARITY_UNIT: Record<Granularity, string> = {
  day: 'ngày',
  week: 'tuần',
  month: 'tháng',
  year: 'năm',
}

/** getGranularityUnit — nhãn đơn vị tiếng Việt cho một granularity. */
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
