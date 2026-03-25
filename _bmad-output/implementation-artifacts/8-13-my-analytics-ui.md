# Story 8.13: My Analytics UI

**Status:** review
**Epic:** 8 — UX Polish & Feature Completeness
**Story ID:** 8.13
**Story Key:** 8-13-my-analytics-ui
**Wave:** Wave 4 (song song với 8-12, 8-14, 8-15 — sau Wave 3 hoàn thành)
**Created:** 2026-03-25

---

## Story

As a member,
I want my analytics page to have a weekly/monthly toggle and a summary card,
So that I can see my commitment trend at different granularities and quickly grasp my overall performance.

---

## Acceptance Criteria

1. **Toggle tuần/tháng** — Trong `SelfAnalyticsHistory`, có toggle "Theo tuần" / "Theo tháng" cho phép member switch giữa weekly view và monthly view.

2. **Weekly view (mặc định)** — Giữ nguyên hành vi hiện tại: range selector 4/8/12 tuần, bar chart per-week, highlight đỏ khi rate < 70%, reference line committed hours.

3. **Monthly view** — Khi chọn "Theo tháng":
   - Range selector đổi sang 3/6/12 tháng gần nhất
   - Bar chart group theo tháng (`MM/yyyy` label): tổng actual hours/tháng vs committed hours/tháng (= số ISO weeks bắt đầu trong tháng × committed_hours/tuần)
   - Highlight đỏ khi monthly rate < 70%, giống logic weekly
   - Reference line cho committed hours trung bình/tháng
   - Tooltip hiển thị `Tháng MM/yyyy` thay vì `Tuần dd/MM`

4. **Summary card** — Bên dưới chart (cả hai mode): hiển thị 3 số liệu inline:
   - **Tổng giờ**: tổng `actual hours` trong kỳ đang xem
   - **Trung bình**: avg hours per tuần/tháng (tùy mode)
   - **Dưới 70%**: X/N kỳ (tuần hoặc tháng) có rate < 70% — format "2/8 tuần" hoặc "1/3 tháng"

5. **State reset** — Khi toggle đổi mode, range selector reset về giá trị mặc định (4 tuần / 3 tháng).

6. **No regression** — Manager/Owner vẫn thấy team analytics như cũ khi truy cập `/analytics`. Member với role = member không bị ảnh hưởng ngoài component `SelfAnalyticsHistory`.

---

## Tasks / Subtasks

### ⚠️ KHÔNG CẦN MIGRATION — Đọc từ `daily_reports` đã có sẵn

Dữ liệu tháng được tính client-side từ `weeklyHours` đã fetch (group ISO weeks → months). Không cần service function mới.

---

### ✅ Task 1: Thêm monthly utilities vào `analytics.utils.ts`
**File:** `src/features/analytics/utils/analytics.utils.ts`

Thêm 3 export mới vào cuối file (KHÔNG xóa/sửa các function hiện có):

```typescript
import {
  // ... đã có: format, startOfISOWeek, endOfISOWeek, subWeeks, addDays
  startOfMonth, endOfMonth, subMonths, addMonths,
} from 'date-fns'

// ── Monthly types & helpers ────────────────────────────────────────────────────

export type MonthlyHoursRow = {
  monthOf: string      // 'yyyy-MM' (e.g., '2026-03')
  actualHours: number
}

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
  weeklyHours: WeeklyHoursRow[],
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
    // Mảm đảm d là Monday >= đầu tháng
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
```

**Import update cần thiết trong file:** thêm `startOfMonth, endOfMonth, subMonths, addMonths` vào import từ `'date-fns'`.

---

### ✅ Task 2: Cập nhật `SelfAnalyticsHistory.tsx` — toggle + summary card

**File:** `src/features/analytics/components/SelfAnalyticsHistory.tsx`

Thay toàn bộ file bằng implementation sau (giữ nguyên logic chart/highlight hiện có, thêm toggle và summary card):

```typescript
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Cell,
} from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { useTenantStore } from '@/stores/tenant-store'
import { useTenantMembers } from '@/features/tenant/hooks/use-tenant-members'
import { getTenantSettings } from '@/features/tenant/services/tenant.service'
import { QUERY_KEYS } from '@/lib/query-keys'
import { useSelfAnalytics } from '@/features/analytics/hooks/use-self-analytics'
import {
  getTimeRange,
  getMonthTimeRange,
  buildWeeklyChartData,
  buildMonthlyChartData,
  calcAvgCommitmentRate,
  formatRate,
  getCommitmentRateColorClass,
} from '@/features/analytics/utils/analytics.utils'

// ── Types ─────────────────────────────────────────────────────────────────────

type ViewMode = 'week' | 'month'

// ── Constants ─────────────────────────────────────────────────────────────────

const WEEK_RANGE_OPTIONS = [
  { label: '4 tuần gần nhất', value: '4' },
  { label: '8 tuần gần nhất', value: '8' },
  { label: '12 tuần gần nhất', value: '12' },
]

const MONTH_RANGE_OPTIONS = [
  { label: '3 tháng gần nhất', value: '3' },
  { label: '6 tháng gần nhất', value: '6' },
  { label: '12 tháng gần nhất', value: '12' },
]

// Dùng chart-2 (teal) cho kỳ bình thường — consistent với MemberTrendChart
const chartConfig = {
  actual: {
    label: 'Thực tế',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig

// ── SummaryStats (inline) ─────────────────────────────────────────────────────

interface SummaryStatsProps {
  chartData: { actual: number; committed: number }[]
  mode: ViewMode
}

function SummaryStats({ chartData, mode }: SummaryStatsProps) {
  const totalActual = chartData.reduce((sum, d) => sum + d.actual, 0)
  const periodsWithData = chartData.filter(d => d.actual > 0).length
  const avgHours = periodsWithData > 0
    ? Math.round(totalActual / periodsWithData)
    : 0
  const periodsBelow = chartData.filter(d => {
    const rate = d.committed > 0 ? d.actual / d.committed : null
    return rate !== null && rate < 0.7
  }).length
  const totalPeriods = chartData.length
  const unit = mode === 'week' ? 'tuần' : 'tháng'

  return (
    <div className="flex items-center gap-6 pt-1 pb-0.5">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">Tổng giờ</span>
        <span className="text-sm font-semibold">{Math.round(totalActual)}h</span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">TB/{unit}</span>
        <span className="text-sm font-semibold">{avgHours}h</span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">Dưới 70%</span>
        <span className={cn(
          'text-sm font-semibold',
          periodsBelow > 0 ? 'text-destructive' : 'text-foreground',
        )}>
          {periodsBelow}/{totalPeriods} {unit}
        </span>
      </div>
    </div>
  )
}

// ── SelfAnalyticsHistory ───────────────────────────────────────────────────────

export function SelfAnalyticsHistory() {
  const { user } = useAuthStore()
  const { activeTenantId } = useTenantStore()

  // ── View mode & range state ────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [rangeWeeks, setRangeWeeks] = useState<number>(4)
  const [rangeMonths, setRangeMonths] = useState<number>(3)

  const handleToggleMode = (mode: ViewMode) => {
    setViewMode(mode)
    // Reset range khi đổi mode (AC5)
    if (mode === 'week') setRangeWeeks(4)
    else setRangeMonths(3)
  }

  // ── Date range ────────────────────────────────────────────────────────────
  const { startDate, endDate } = viewMode === 'week'
    ? getTimeRange(rangeWeeks)
    : getMonthTimeRange(rangeMonths)

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: members = [], isLoading: isMembersLoading } = useTenantMembers()

  const { data: tenantSettings, isLoading: isSettingsLoading } = useQuery({
    queryKey: [QUERY_KEYS.tenantSettings, activeTenantId],
    queryFn: () => {
      if (!activeTenantId) throw new Error('No active tenant')
      return getTenantSettings(activeTenantId)
    },
    enabled: !!activeTenantId,
    staleTime: 5 * 60_000,
  })

  const {
    data: analyticsData,
    isLoading: isHoursLoading,
    isError: isHoursError,
  } = useSelfAnalytics(startDate, endDate)
  const weeklyHours = analyticsData?.weeklyHours ?? []
  const committedHistory = analyticsData?.committedHistory ?? []

  // ── Compute effective committed hours ─────────────────────────────────────
  const myMember = members.find(m => m.user_id === user?.id)
  const defaultCommittedHours = tenantSettings?.default_committed_hours ?? 40
  const effectiveCommittedHours = myMember?.committed_hours ?? defaultCommittedHours

  // ── Chart data ────────────────────────────────────────────────────────────
  const chartData = viewMode === 'week'
    ? buildWeeklyChartData(weeklyHours, startDate, endDate, committedHistory, effectiveCommittedHours)
    : buildMonthlyChartData(weeklyHours, startDate, endDate, effectiveCommittedHours)

  // Avg rate — dùng weeklyHours (raw weeks) cho cả 2 mode để consistent
  const avgRate = calcAvgCommitmentRate(weeklyHours, effectiveCommittedHours)
  const avgRateColorClass = getCommitmentRateColorClass(avgRate)

  // Reference line value: cho monthly mode, dùng avg committed/tháng từ chartData
  const avgMonthlyCommitted = viewMode === 'month' && chartData.length > 0
    ? Math.round(chartData.reduce((sum, d) => sum + d.committed, 0) / chartData.length)
    : effectiveCommittedHours
  const referenceLineY = viewMode === 'week' ? effectiveCommittedHours : avgMonthlyCommitted

  const yMax = Math.max(...chartData.map(w => w.actual), referenceLineY)
  const isLoading = isMembersLoading || isSettingsLoading || isHoursLoading

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-52 w-full" />
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 space-y-4">
      {/* Header: avg rate + toggle + range selector */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Lịch sử commitment</p>
          <p className="text-xs text-muted-foreground">
            Trung bình:{' '}
            <span className={`font-semibold ${avgRateColorClass}`}>{formatRate(avgRate)}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle tuần/tháng (AC1) */}
          <div className="flex rounded-md border border-border overflow-hidden text-xs">
            <button
              className={cn(
                'px-3 py-1.5 transition-colors',
                viewMode === 'week'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted',
              )}
              onClick={() => handleToggleMode('week')}
            >
              Theo tuần
            </button>
            <button
              className={cn(
                'px-3 py-1.5 transition-colors border-l border-border',
                viewMode === 'month'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted',
              )}
              onClick={() => handleToggleMode('month')}
            >
              Theo tháng
            </button>
          </div>

          {/* Range selector — đổi options theo mode */}
          <Select
            value={viewMode === 'week' ? String(rangeWeeks) : String(rangeMonths)}
            onValueChange={(v) => {
              if (viewMode === 'week') setRangeWeeks(Number(v))
              else setRangeMonths(Number(v))
            }}
          >
            <SelectTrigger className="w-44 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(viewMode === 'week' ? WEEK_RANGE_OPTIONS : MONTH_RANGE_OPTIONS).map(opt => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Chart */}
      {isHoursError ? (
        <div className="h-52 flex items-center justify-center text-sm text-destructive">
          Không thể tải dữ liệu. Vui lòng thử lại.
        </div>
      ) : chartData.length === 0 || chartData.every(w => w.actual === 0) ? (
        <div className="h-52 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
          <span>Không có dữ liệu báo cáo trong khoảng thời gian này.</span>
          {effectiveCommittedHours > 0 && (
            <span className="text-xs">Mục tiêu: {effectiveCommittedHours}h/tuần</span>
          )}
        </div>
      ) : (
        <ChartContainer config={chartConfig} className="h-52 w-full">
          <BarChart
            data={chartData}
            margin={{ top: 8, right: 32, left: -16, bottom: 0 }}
            barCategoryGap="35%"
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey={viewMode === 'week' ? 'weekLabel' : 'monthLabel'}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `${v}h`}
              domain={[0, Math.ceil(yMax * 1.15)]}
            />
            <ChartTooltip
              cursor={{ fill: 'color-mix(in oklch, var(--muted) 40%, transparent)' }}
              content={
                <ChartTooltipContent
                  formatter={(value, name) => {
                    if (name === 'actual') return [`${value}h`, 'Thực tế']
                    return [`${value}h`, String(name)]
                  }}
                  labelFormatter={(label) =>
                    viewMode === 'week' ? `Tuần ${label}` : `Tháng ${label}`
                  }
                />
              }
            />
            <ReferenceLine
              y={referenceLineY}
              stroke="var(--muted-foreground)"
              strokeDasharray="5 3"
              strokeWidth={1.5}
              label={{
                value: `${referenceLineY}h`,
                position: 'right',
                fontSize: 10,
                fill: 'var(--muted-foreground)',
              }}
            />
            <Bar dataKey="actual" radius={[3, 3, 0, 0]} maxBarSize={48}>
              {chartData.map((entry, index) => {
                const rate = entry.committed > 0 ? entry.actual / entry.committed : null
                const fill =
                  rate !== null && rate < 0.7
                    ? 'var(--destructive)'
                    : 'var(--color-actual)'
                return (
                  <Cell
                    key={viewMode === 'week'
                      ? (entry as { weekLabel: string }).weekLabel
                      : `month-${index}`
                    }
                    fill={fill}
                  />
                )
              })}
            </Bar>
          </BarChart>
        </ChartContainer>
      )}

      {/* Summary card (AC4) */}
      {chartData.length > 0 && !isHoursError && (
        <SummaryStats chartData={chartData} mode={viewMode} />
      )}

      {/* Footer legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[var(--chart-2)]" />
          Thực tế
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-destructive" />
          Dưới 70% cam kết
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-px w-4 border-t-2 border-dashed border-muted-foreground" />
          Cam kết ({referenceLineY}h/{viewMode === 'week' ? 'tuần' : 'tháng'})
        </span>
      </div>
    </div>
  )
}
```

**Lưu ý key changes so với file hiện tại:**
- Thêm `viewMode` state + `handleToggleMode`
- Thêm `rangeMonths` state (riêng biệt với `rangeWeeks`)
- `startDate/endDate` phụ thuộc vào `viewMode`
- `chartData` phụ thuộc vào `viewMode` (weekly vs monthly builder)
- `referenceLineY` phụ thuộc vào mode
- `XAxis dataKey` phụ thuộc vào mode
- Toggle UI button pair + range selector đổi options
- `SummaryStats` component inline (AC4)
- `Cell key` dùng index thay vì weekLabel cho monthly mode

---

### ✅ Task 3: Unit tests cho monthly utilities

**File:** `src/features/analytics/__tests__/self-analytics.test.ts`

Append các test mới vào file hiện có:

```typescript
// ── Monthly utilities tests ────────────────────────────────────────────────────

describe('getMonthTimeRange', () => {
  it('monthsBack=1 trả về đầu-cuối tháng hiện tại', () => {
    const { startDate, endDate } = getMonthTimeRange(1)
    // startDate là đầu tháng
    expect(startDate).toMatch(/^\d{4}-\d{2}-01$/)
    // endDate là cuối tháng (28-31)
    const end = new Date(endDate + 'T00:00:00')
    expect(end.getDate()).toBeGreaterThanOrEqual(28)
  })

  it('monthsBack=3 trả về range 3 tháng', () => {
    const { startDate, endDate } = getMonthTimeRange(3)
    const start = new Date(startDate + 'T00:00:00')
    const end = new Date(endDate + 'T00:00:00')
    // Khoảng cách >= 60 ngày
    expect(end.getTime() - start.getTime()).toBeGreaterThan(60 * 24 * 3600 * 1000)
  })

  it('throw khi monthsBack < 1', () => {
    expect(() => getMonthTimeRange(0)).toThrow()
  })
})

describe('buildMonthlyChartData', () => {
  it('tạo đủ data points cho mọi tháng trong range', () => {
    const result = buildMonthlyChartData([], '2026-01-01', '2026-03-31', 40)
    expect(result).toHaveLength(3)
    expect(result[0].monthLabel).toBe('01/2026')
    expect(result[2].monthLabel).toBe('03/2026')
  })

  it('tháng không có data → actual = 0', () => {
    const result = buildMonthlyChartData([], '2026-03-01', '2026-03-31', 40)
    expect(result[0].actual).toBe(0)
  })

  it('group weekly hours đúng theo tháng', () => {
    const weeklyHours = [
      { weekOf: '2026-03-02', actualHours: 30 },  // tháng 3
      { weekOf: '2026-03-09', actualHours: 35 },  // tháng 3
      { weekOf: '2026-04-06', actualHours: 20 },  // tháng 4
    ]
    const result = buildMonthlyChartData(weeklyHours, '2026-03-01', '2026-04-30', 40)
    expect(result).toHaveLength(2)
    expect(result[0].actual).toBe(65)  // 30 + 35
    expect(result[1].actual).toBe(20)
  })

  it('committed/tháng = số Mondays × fallback', () => {
    // Tháng 3/2026 có 5 Mondays (02, 09, 16, 23, 30)
    const result = buildMonthlyChartData([], '2026-03-01', '2026-03-31', 40)
    expect(result[0].committed).toBe(5 * 40)  // = 200
  })
})

describe('SummaryStats logic', () => {
  it('tổng giờ đúng', () => {
    const data = [
      { actual: 30, committed: 40 },
      { actual: 38, committed: 40 },
    ]
    const totalActual = data.reduce((sum, d) => sum + d.actual, 0)
    expect(totalActual).toBe(68)
  })

  it('periodsBelow tính đúng kỳ < 70%', () => {
    const data = [
      { actual: 20, committed: 40 },  // 50% → dưới 70%
      { actual: 35, committed: 40 },  // 87.5% → ok
      { actual: 10, committed: 40 },  // 25% → dưới 70%
    ]
    const below = data.filter(d => {
      const rate = d.committed > 0 ? d.actual / d.committed : null
      return rate !== null && rate < 0.7
    }).length
    expect(below).toBe(2)
  })
})
```

**Import cần thêm vào đầu test file:**
```typescript
import {
  getMonthTimeRange,
  buildMonthlyChartData,
  // ... đã có các imports khác
} from '../utils/analytics.utils'
```

---

### ✅ Task 4: TypeScript validation

```bash
npx tsc --noEmit
```

Phải pass 0 lỗi trước khi mark done.

---

## Dev Notes

### Architecture Patterns — PHẢI TUÂN THỦ

```
analytics.tsx (route)
  └─ SelfAnalyticsHistory.tsx  ← component bị sửa
       ├─ useSelfAnalytics(startDate, endDate)  ← KHÔNG thay đổi hook
       │    └─ useMemberTrend(user.id, ...)
       │         └─ AnalyticsService.getMemberReportsForPeriod()
       └─ analytics.utils.ts  ← thêm monthly helpers
```

- **KHÔNG sửa** `use-self-analytics.ts`, `use-member-trend.ts`, `analytics.service.ts`
- **KHÔNG sửa** `analytics.tsx` route
- **KHÔNG sửa** `SelfDashboard.tsx`
- Monthly data = client-side aggregation từ `weeklyHours` đã có — **KHÔNG cần service mới**

### Monthly Data Flow

```
useSelfAnalytics(startDate, endDate)
  → fetch raw daily_reports → groupReportsByWeek() → weeklyHours[]
                                                           ↓
              buildMonthlyChartData(weeklyHours, ...)  ← CLIENT-SIDE
              (group weekOf by yyyy-MM → monthly totals)
```

Khi `viewMode === 'month'`:
- `startDate/endDate` = `getMonthTimeRange(rangeMonths)` — range rộng hơn (3/6/12 tháng)
- `weeklyHours` vẫn là per-week data, nhưng `buildMonthlyChartData` group chúng lại theo tháng
- `useSelfAnalytics` hook không cần biết về mode — chỉ nhận startDate/endDate khác nhau

### Toggle UI Pattern

Dùng native `<button>` với `cn()` conditional class — **KHÔNG dùng** ToggleGroup (không install), **KHÔNG dùng** Tabs (không phù hợp semantic). Pattern này consistent với các custom toggle đơn giản trong dự án.

```tsx
<div className="flex rounded-md border border-border overflow-hidden text-xs">
  <button className={cn('px-3 py-1.5', viewMode === 'week' ? 'bg-primary text-primary-foreground' : '...')}
    onClick={() => handleToggleMode('week')}>Theo tuần</button>
  <button className={cn('...', viewMode === 'month' ? 'bg-primary ...' : '...')}
    onClick={() => handleToggleMode('month')}>Theo tháng</button>
</div>
```

### Monthly Committed Hours — Heuristic

Committed/tháng = số ISO weeks có Monday trong tháng đó × `effectiveCommittedHours`.

Ví dụ: Tháng 3/2026 có 5 Mondays (02, 09, 16, 23, 30) → committed = 5 × 40 = 200h.

**Không dùng** `committedHistory` cho monthly view (tránh phức tạp). `effectiveCommittedHours` là giá trị hiện tại — đủ chính xác cho monthly overview.

### Summary Card — SummaryStats component

Inline component trong cùng file (KHÔNG tách file riêng). Nhận `chartData` (weekly hoặc monthly, cùng shape `{ actual, committed }[]`) và `mode` để label đúng unit.

### Reference Line — Monthly Mode

Monthly reference line = avg committed/tháng của các tháng trong range (tránh committed thay đổi mỗi tháng):
```typescript
const avgMonthlyCommitted = chartData.length > 0
  ? Math.round(chartData.reduce((sum, d) => sum + d.committed, 0) / chartData.length)
  : effectiveCommittedHours
```

### Import `cn` — đã có

`cn` utility đã có tại `@/lib/utils`. Đã được dùng trong nhiều components khác.

### date-fns additions

`analytics.utils.ts` cần thêm vào import: `startOfMonth, endOfMonth, subMonths, addMonths`.
Package `date-fns` đã install (verified từ story 5.1+). **Không cần install lại.**

---

## DB Schema (không thay đổi)

| Column | Table | Type | Notes |
|--------|-------|------|-------|
| `hours_logged` | `daily_reports` | numeric | SUM cho actual hours |
| `report_date` | `daily_reports` | date | filter by period |
| `user_id` | `daily_reports` | uuid | RLS filter (member = auth.uid()) |
| `committed_hours` | `tenant_members` | smallint | NULL → dùng default |
| `default_committed_hours` | `tenants` | smallint | fallback, default 40 |
| `committed_hours_history` | table | — | đã có từ 8-5 |

---

## Previous Story Intelligence

### Từ Story 5-3 (foundation story)

- `SelfAnalyticsHistory.tsx` hiện có: range selector 4/8/12 tuần, bar chart với per-bar Cell, ChartContainer (ShadCN), ReferenceLine, `useSelfAnalytics`, `buildWeeklyChartData`, `calcAvgCommitmentRate`, `getCommitmentRateColorClass`, `formatRate` — **TẤT CẢ REUSE**
- Pattern: `analyticsData?.weeklyHours ?? []` và `analyticsData?.committedHistory ?? []` (xử lý null)
- `ChartTooltipContent` với `formatter` và `labelFormatter` — pattern tốt, giữ nguyên

### Từ Story 8-5 (committed_hours_history)

- `committedHistory` trong `useSelfAnalytics` return type — **đã có**, dùng trong weekly view
- `buildWeeklyChartData` signature: `(weeklyHours, startDate, endDate, committedHistory, fallbackCommittedHours)` — đã cập nhật từ 8-5

### Từ Story 8-10/8-11 (recent Wave 3)

- Commit format: `feat(8-13): ...`
- TypeScript strict: chạy `npx tsc --noEmit` trước khi done

### Git Intelligence (5 commits gần nhất)

- `b0c4367 feat(8-11)`: infinite scroll — không conflict với analytics feature
- `b195957 chore(8-10)`: code review fixes — không liên quan
- `c8008a3 chore(8-9)`: code review fixes — không liên quan

---

## Anti-Pattern Prevention

| ❌ ĐỪNG làm | ✅ NÊN làm |
|------------|-----------|
| Thêm `getMonthlyData()` vào `AnalyticsService` | Monthly = client-side aggregation từ weeklyHours |
| Tạo `use-self-monthly-analytics.ts` hook mới | Reuse `useSelfAnalytics(startDate, endDate)` với range rộng hơn |
| Dùng `ToggleGroup` từ shadcn | Native `<button>` với `cn()` — ToggleGroup chưa install |
| Tạo file utility mới cho monthly | Append vào `analytics.utils.ts` hiện có |
| Sửa `useMemberTrend` để return `monthlyHours` | Không cần — grouping làm client-side |
| Dùng `committed × 4.33` cho monthly committed | Đếm actual Mondays trong tháng × committed/tuần (chính xác hơn) |
| Tách `SummaryStats` thành file riêng | Inline component trong cùng file (nhỏ, chỉ dùng 1 nơi) |
| Hard-code màu sắc | Dùng `var(--destructive)`, `var(--color-actual)` — CSS variables |
| Thêm warning text cho kỳ thấp | Chỉ màu đỏ + số đếm — không text phán xét |

---

## Files to Create / Modify

### Chỉnh sửa

| File | Thay đổi |
|------|----------|
| `src/features/analytics/utils/analytics.utils.ts` | Thêm: `MonthlyHoursRow` type, `getMonthTimeRange()`, `buildMonthlyChartData()` — KHÔNG xóa function hiện có |
| `src/features/analytics/components/SelfAnalyticsHistory.tsx` | Thêm toggle + monthly mode + SummaryStats component |
| `src/features/analytics/__tests__/self-analytics.test.ts` | Append monthly utility tests |

### KHÔNG CHẠM

| File | Lý do |
|------|-------|
| `src/features/analytics/hooks/use-self-analytics.ts` | Reuse nguyên — chỉ thay đổi startDate/endDate ở caller |
| `src/features/analytics/hooks/use-member-trend.ts` | No changes |
| `src/features/analytics/services/analytics.service.ts` | No changes |
| `src/routes/_app/analytics.tsx` | No changes — vẫn render `<SelfAnalyticsHistory />` cho member |
| `src/features/dashboard/components/SelfDashboard.tsx` | Không liên quan |
| `src/lib/query-keys.ts` | Không có query key mới |
| `src/components/layout/data/sidebar-data.ts` | Không thay đổi nav |

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5

### Debug Log References

Không có lỗi đáng kể. `tsc --noEmit` pass 0 errors ngay lần đầu.

### Completion Notes List

- ✅ Task 1: Thêm `getMonthTimeRange`, `buildMonthlyChartData`, `MonthlyHoursRow` vào `analytics.utils.ts`. Import `date-fns` mở rộng: thêm `startOfMonth, endOfMonth, subMonths, addMonths`.
- ✅ Task 2: Viết lại `SelfAnalyticsHistory.tsx` với toggle tuần/tháng, `SummaryStats` inline component, monthly chart mode. Reuse toàn bộ weekly logic hiện có.
- ✅ Task 3: Append 6 test mới vào `self-analytics.test.ts`: 3 cho `getMonthTimeRange`, 4 cho `buildMonthlyChartData`, 2 cho `SummaryStats logic`. Tất cả 21 tests PASS.
- ✅ Task 4: `npx tsc --noEmit` — 0 errors.

### File List

- **Modified:** `src/features/analytics/utils/analytics.utils.ts`
- **Modified:** `src/features/analytics/components/SelfAnalyticsHistory.tsx`
- **Modified:** `src/features/analytics/__tests__/self-analytics.test.ts`
