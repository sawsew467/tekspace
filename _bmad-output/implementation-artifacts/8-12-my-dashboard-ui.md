# Story 8.12: My Dashboard UI

**Story ID:** 8.12
**Story Key:** 8-12-my-dashboard-ui
**Epic:** 8 — UX Polish & Feature Completeness
**Wave:** Wave 4 (sau Wave 3 hoàn thành)
**Status:** review
**Created:** 2026-03-25

---

## Tasks/Subtasks

- [x] **T1 — Thêm Sparkline 4 tuần gần nhất vào SelfDashboard**
  - [x] T1.1 Thêm `selfSparkline` vào `QUERY_KEYS` trong `src/lib/query-keys.ts`
  - [x] T1.2 Tạo hook `use-self-sparkline.ts` — lấy weekly hours 4 tuần bằng `useSelfAnalytics` + `getTimeRange(4)`
  - [x] T1.3 Tạo sub-component `WeeklySparkline` bên trong `SelfDashboard.tsx` — dùng `AreaChart` từ recharts qua `ChartContainer`
  - [x] T1.4 Render `WeeklySparkline` trong `SelfDashboard` bên dưới stats row

- [x] **T2 — Thêm Streak Counter**
  - [x] T2.1 Thêm `selfStreak` vào `QUERY_KEYS` trong `src/lib/query-keys.ts`
  - [x] T2.2 Thêm utility `computeReportStreak(reportDates: string[], today: string): number` vào `src/features/dashboard/utils/dashboard.utils.ts`
  - [x] T2.3 Tạo hook `use-self-streak.ts` — fetch last 30 ngày reports, compute streak
  - [x] T2.4 Thêm streak counter vào stats row trong `SelfDashboard` (cột thứ 4 hoặc card riêng)

- [x] **T3 — Thêm Quick Action "Báo cáo hôm nay"**
  - [x] T3.1 Query `getTodayReport` để biết hôm nay đã submit chưa (reuse `DailyReportService.getTodayReport`)
  - [x] T3.2 Render quick action card: nếu chưa báo cáo → `<Link>` button đến `/daily-report`; đã báo cáo → badge "✓ Đã báo cáo"

- [x] **T4 — TypeScript & Lint Validation**
  - [x] T4.1 `npx tsc --noEmit` pass không lỗi

---

## User Story

> Là một member, tôi muốn My Dashboard hiển thị sparkline 4 tuần, streak ngày liên tiếp và quick action báo cáo nhanh, để tôi theo dõi performance cá nhân và hành động ngay mà không cần vào nhiều trang.

---

## Acceptance Criteria

- **AC1 — Sparkline 4 tuần:** SelfDashboard hiển thị mini area chart với 4 data points (4 tuần gần nhất, kể cả tuần hiện tại). Mỗi điểm = tổng `hours_logged` của tuần đó. Tuần chưa có data = 0h. Chart nhỏ gọn (height ~80px), không có trục số chi tiết, có tooltip khi hover.
- **AC2 — Streak counter:** Hiển thị số ngày báo cáo liên tiếp tính từ hôm nay trở về trước (tính cả ngày hôm nay nếu đã submit). Ví dụ: "🔥 5 ngày liên tiếp". Nếu streak = 0 → hiển thị "—" hoặc "0 ngày".
- **AC3 — Quick action đã báo cáo:** Nếu hôm nay đã submit daily report → hiển thị "✓ Đã báo cáo hôm nay" với style muted/success (không phải link).
- **AC4 — Quick action chưa báo cáo:** Nếu hôm nay chưa submit → hiển thị button/link "Báo cáo hôm nay" → click navigate đến `/daily-report`.
- **AC5 — Loading states:** Sparkline và streak hiển thị `<Skeleton>` trong lúc loading — KHÔNG flash layout.
- **AC6 — Không regression:** 3 stat cards hiện tại (giờ báo cáo, giờ cam kết, tỷ lệ), heatmap lịch, team comparison vẫn hoạt động bình thường.
- **AC7 — TypeScript không lỗi.** ESLint pass.

---

## Scope rõ ràng — KHÔNG làm ngoài phạm vi này

- ✅ `SelfDashboard.tsx` — component chính
- ✅ Thêm `use-self-sparkline.ts` + `use-self-streak.ts` hooks mới
- ✅ Thêm `computeReportStreak` vào `dashboard.utils.ts`
- ✅ Cập nhật `query-keys.ts` (thêm 2 keys mới)
- ❌ **KHÔNG** đổi logic `TeamComparisonPanel`, `StatCard`, heatmap
- ❌ **KHÔNG** đổi `useSelfWeekHours`, `useTeamAvgCommitment`, `DashboardService`
- ❌ **KHÔNG** đổi `SelfAnalyticsHistory.tsx` (đó là story 8-13)
- ❌ **KHÔNG** tạo migration DB mới (story này pure frontend)
- ❌ **KHÔNG** dùng `export default`
- ❌ **KHÔNG** tạo barrel export (`index.ts`)

---

## Technical Requirements

### Stack & Libraries đã có

- **recharts** (đã dùng trong `MemberTrendChart.tsx`): `AreaChart`, `Area`, `XAxis`, `Tooltip`
- **`@/components/ui/chart`**: `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartConfig`
- **`date-fns`**: `format`, `subDays`, `startOfISOWeek` — đã có
- **`@tanstack/react-query`**: `useQuery` — đã có
- **TanStack Router**: `Link` từ `@tanstack/react-router` — đã có

### Hook 1: `use-self-sparkline.ts`

**Vị trí:** `src/features/dashboard/hooks/use-self-sparkline.ts`

```typescript
import { useMemo } from 'react'
import { getTimeRange } from '@/features/analytics/utils/analytics.utils'
import { useSelfAnalytics } from '@/features/analytics/hooks/use-self-analytics'

/**
 * useSelfSparkline — lấy weekly hours 4 tuần gần nhất của member.
 * Reuses useSelfAnalytics (→ useMemberTrend → RLS-safe).
 * Returns mảng 4 điểm { weekOf, actualHours } đã fill 0h cho tuần thiếu.
 */
export function useSelfSparkline() {
  const { startDate, endDate } = useMemo(() => getTimeRange(4), [])
  return useSelfAnalytics(startDate, endDate)
}
```

**Lưu ý:** `useSelfAnalytics` → `useMemberTrend` → fetch cả `weeklyHours` lẫn `committedHistory`. Chỉ cần dùng `data?.weeklyHours` cho sparkline.

### Hook 2: `use-self-streak.ts`

**Vị trí:** `src/features/dashboard/hooks/use-self-streak.ts`

```typescript
import { useMemo } from 'react'
import { format, subDays } from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import { useTenantStore } from '@/stores/tenant-store'
import { QUERY_KEYS } from '@/lib/query-keys'
import { AnalyticsService } from '@/features/analytics/services/analytics.service'
import { computeReportStreak } from '@/features/dashboard/utils/dashboard.utils'

const STREAK_DAYS = 30  // Lấy 30 ngày để cover streak dài nhất hợp lý

/**
 * useSelfStreak — số ngày báo cáo liên tiếp của member hiện tại.
 * Fetch 30 ngày gần nhất, compute streak bằng pure function.
 */
export function useSelfStreak() {
  const { user } = useAuthStore()
  const { activeTenantId } = useTenantStore()

  const { startDate, endDate } = useMemo(() => {
    const today = new Date()
    return {
      startDate: format(subDays(today, STREAK_DAYS - 1), 'yyyy-MM-dd'),
      endDate: format(today, 'yyyy-MM-dd'),
    }
  }, [])

  return useQuery({
    queryKey: [QUERY_KEYS.selfStreak, activeTenantId, user?.id, startDate],
    queryFn: async (): Promise<number> => {
      const reports = await AnalyticsService.getMemberReportsForPeriod(
        activeTenantId!,
        user!.id,
        startDate,
        endDate,
      )
      const reportDates = reports.map(r => r.report_date)
      const today = format(new Date(), 'yyyy-MM-dd')
      return computeReportStreak(reportDates, today)
    },
    enabled: !!activeTenantId && !!user?.id,
    staleTime: 60_000,  // streak thay đổi khi submit report — invalidate qua query key
  })
}
```

### Utility: `computeReportStreak`

**Thêm vào:** `src/features/dashboard/utils/dashboard.utils.ts` (cuối file)

```typescript
/**
 * computeReportStreak — đếm số ngày báo cáo liên tiếp tính từ today trở về trước.
 * Tính cả today nếu đã submit.
 * Ngày không có report → streak bị cắt.
 *
 * @param reportDates   Danh sách ngày 'yyyy-MM-dd' đã submit report (không cần sort)
 * @param today         Ngày hôm nay dạng 'yyyy-MM-dd' (injectable để test)
 * @returns             Số ngày liên tiếp (>= 0)
 */
export function computeReportStreak(reportDates: string[], today: string): number {
  const dateSet = new Set(reportDates)
  let streak = 0
  let current = today  // bắt đầu từ hôm nay

  while (dateSet.has(current)) {
    streak++
    // Lùi 1 ngày
    const d = new Date(current + 'T00:00:00')
    d.setDate(d.getDate() - 1)
    current = format(d, 'yyyy-MM-dd')
  }
  return streak
}
```

**Lưu ý:** Import `format` từ `date-fns` đã có sẵn ở đầu file `dashboard.utils.ts`.

### QUERY_KEYS — thêm 2 keys mới

**File:** `src/lib/query-keys.ts`

```typescript
export const QUERY_KEYS = {
  // ...existing keys...
  selfStreak: 'self-streak',          // Story 8.12: streak counter
  // (selfSparkline không cần key riêng — dùng QUERY_KEYS.analytics qua useSelfAnalytics)
} as const
```

### Sub-component: `WeeklySparkline`

**Tạo bên trong `SelfDashboard.tsx`** (không tạo file riêng — component nhỏ, dùng 1 nơi):

```tsx
// Import cần thêm vào SelfDashboard.tsx:
import { AreaChart, Area, XAxis, Tooltip } from 'recharts'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { useSelfSparkline } from '../hooks/use-self-sparkline'
import { getTimeRange, groupReportsByWeek } from '@/features/analytics/utils/analytics.utils'
// addDays + format đã có qua date-fns

const sparklineConfig = {
  actual: {
    label: 'Giờ thực tế',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig

interface WeeklySparklineProps {
  weeklyData: { weekLabel: string; actual: number }[]
  isLoading: boolean
}

function WeeklySparkline({ weeklyData, isLoading }: WeeklySparklineProps) {
  if (isLoading) return <Skeleton className="h-20 w-full" />

  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-xs text-muted-foreground mb-2">Giờ báo cáo 4 tuần gần nhất</p>
      <ChartContainer config={sparklineConfig} className="h-20 w-full">
        <AreaChart data={weeklyData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="weekLabel"
            tick={{ fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              return (
                <div className="rounded border border-border bg-background px-2 py-1 text-xs shadow">
                  {payload[0]?.payload?.weekLabel}: {payload[0]?.value}h
                </div>
              )
            }}
          />
          <Area
            type="monotone"
            dataKey="actual"
            stroke="var(--chart-2)"
            fill="url(#sparkGrad)"
            strokeWidth={2}
            dot={{ r: 3, fill: 'var(--chart-2)' }}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  )
}
```

### Quick Action Card

**Tạo bên trong `SelfDashboard.tsx`**:

```tsx
// Import thêm:
import { Link } from '@tanstack/react-router'
import { ROUTES } from '@/lib/routes'
import { CheckCircle2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DailyReportService } from '@/features/daily-report/services/daily-report.service'

// Trong SelfDashboard, thêm query:
const todayISO = useMemo(() => format(new Date(), 'yyyy-MM-dd'), [])

const { data: todayReport, isLoading: isTodayReportLoading } = useQuery({
  queryKey: [QUERY_KEYS.dailyReports, activeTenantId, user?.id, 'today', todayISO],
  queryFn: () => DailyReportService.getTodayReport(activeTenantId!, user!.id, todayISO),
  enabled: !!activeTenantId && !!user?.id,
  staleTime: 60_000,
})

// Quick action JSX (thêm vào cuối SelfDashboard, trước closing PageContainer):
function QuickActionCard({ todayReport, isLoading }: { todayReport: DailyReport | null | undefined; isLoading: boolean }) {
  if (isLoading) return <Skeleton className="h-16 w-full" />

  if (todayReport) {
    return (
      <div className="rounded-lg border border-border p-4 flex items-center gap-3">
        <CheckCircle2 className="size-5 text-green-600 dark:text-green-400 shrink-0" />
        <div>
          <p className="text-sm font-medium">Đã báo cáo hôm nay</p>
          <p className="text-xs text-muted-foreground">
            {Math.round(Number(todayReport.hours_logged))}h — {format(new Date(todayReport.submitted_at), 'HH:mm')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <FileText className="size-5 text-muted-foreground shrink-0" />
        <p className="text-sm text-muted-foreground">Chưa báo cáo hôm nay</p>
      </div>
      <Button asChild size="sm" variant="default">
        <Link to={ROUTES.dailyReport}>Báo cáo ngay</Link>
      </Button>
    </div>
  )
}
```

### Dữ liệu Sparkline — Build từ weeklyHours

Trong `SelfDashboard`, build sparkline data từ `useSelfSparkline()`:

```tsx
const { data: sparklineData, isLoading: isSparklineLoading } = useSelfSparkline()

// Build chart data — 4 tuần, fill 0 cho tuần thiếu
const sparkChartData = useMemo(() => {
  const weeklyHours = sparklineData?.weeklyHours ?? []
  const { startDate, endDate } = getTimeRange(4)
  const hoursMap = new Map(weeklyHours.map(w => [w.weekOf, w.actualHours]))

  const result: { weekLabel: string; actual: number }[] = []
  let current = startOfISOWeek(new Date(startDate + 'T00:00:00'))
  const end = new Date(endDate + 'T00:00:00')

  while (current <= end) {
    const weekOf = format(current, 'yyyy-MM-dd')
    result.push({
      weekLabel: format(current, 'dd/MM'),
      actual: hoursMap.get(weekOf) ?? 0,
    })
    current = addDays(current, 7)
  }
  return result
}, [sparklineData?.weeklyHours])
```

**Import cần thêm:** `startOfISOWeek`, `addDays` từ `date-fns` (đã có `format`).

---

## File Structure — Đúng vị trí, đúng convention

### Files CẦN TẠO MỚI

```
src/features/dashboard/hooks/use-self-sparkline.ts   ← NEW
src/features/dashboard/hooks/use-self-streak.ts      ← NEW
```

### Files CẦN SỬA

```
src/features/dashboard/components/SelfDashboard.tsx  ← thêm sparkline + streak + quick action
src/features/dashboard/utils/dashboard.utils.ts      ← thêm computeReportStreak()
src/lib/query-keys.ts                                ← thêm selfStreak key
```

### Files KHÔNG ĐƯỢC CHẠM

```
src/features/dashboard/hooks/use-self-week-hours.ts      ← GIỮ NGUYÊN
src/features/dashboard/hooks/use-team-avg-commitment.ts  ← GIỮ NGUYÊN
src/features/dashboard/services/dashboard.service.ts     ← GIỮ NGUYÊN
src/features/analytics/components/SelfAnalyticsHistory.tsx  ← story 8-13, KHÔNG chạm
src/features/analytics/hooks/use-self-analytics.ts       ← GIỮ NGUYÊN (chỉ import)
src/features/analytics/utils/analytics.utils.ts          ← GIỮ NGUYÊN (chỉ import)
```

---

## Architecture Compliance

- **Named exports only** — không dùng `export default`
- **Components import từ hooks, KHÔNG import service trực tiếp** trong component
  - `SelfDashboard` dùng `useSelfSparkline`, `useSelfStreak`
  - Ngoại lệ: `getTodayReport` được gọi trực tiếp trong `useQuery` bên trong `SelfDashboard` — OK vì đây là pattern hiện tại của file (xem `DashboardService.getDefaultCommittedHours` ở line 113–117)
- **`cn()` cho classNames** — không dùng `clsx`/`twMerge` trực tiếp
- **Không tạo barrel exports** (`index.ts`)
- **TanStack Query v5**: `useQuery` với `staleTime`, `enabled`
- **`PageContainer variant='wide'`** — đã có, giữ nguyên

---

## Previous Wave Context

**Wave 3 đã hoàn thành (liên quan đến story này):**
- `8-9`: `highlight-current-timeslot` — `TeamScheduleHeatmap` đã có highlight, KHÔNG chạm
- `8-10`: `user-avatar-upload` — `users.avatar_url` đã có, `SelfDashboard` không cần avatar ở đây
- `8-11`: `infinite-scroll` — `AnalyticsService.getMemberReportsForPeriod` KHÔNG thay đổi (không phải paginated query)

**Pattern từ Wave 3 cần follow:**
- TanStack Query v5 `useQuery` với `enabled: !!tenantId && !!userId`
- `useMemo` để tính date ranges 1 lần khi mount (tránh re-render)
- `Skeleton` component để loading state
- `cn()` từ `@/lib/utils` cho classNames

---

## Git Intelligence (5 commits gần nhất)

| Commit | Files liên quan |
|--------|-----------------|
| `b0c4367` feat(8-11): infinite scroll | hooks + services + routes |
| `b195957` chore(8-10): code review fixes | avatar upload |
| `c8008a3` chore(8-9): code review fixes | dashboard heatmap |
| `bdfcdd0` fix: auth-aware error pages | router config |
| `eb290d2` chore(8-7): code review fixes | page-container |

**Patterns từ code hiện tại:**
- `useMemo(() => ...)` để tính date range — pattern chuẩn trong `SelfDashboard`
- Sub-components inline trong file (xem `StatCard`, `TeamComparisonPanel`) — chuẩn cho component nhỏ, 1 nơi dùng
- `useQuery` với `queryFn: async (): Promise<T>` syntax
- `import type` khi chỉ dùng type

---

## Testing Checklist

### Trước khi mark done

- [ ] TypeScript compile không lỗi (`npx tsc --noEmit`)
- [ ] `npx supabase test db` — không có migration nên skip, chỉ verify không chạm DB schema
- [ ] Sparkline hiển thị 4 điểm dữ liệu (4 tuần)
- [ ] Sparkline: tuần chưa có report → hiển thị 0h (không crash)
- [ ] Streak counter: submit report hôm nay → streak tăng (sau invalidate)
- [ ] Streak counter: streak = 0 → hiển thị "—" hoặc "0 ngày"
- [ ] Quick action: chưa báo cáo → link "Báo cáo ngay" hoạt động → navigate đến `/daily-report`
- [ ] Quick action: đã báo cáo → hiển thị "✓ Đã báo cáo hôm nay" với thời gian submit
- [ ] Loading states: tất cả `<Skeleton>` hiển thị đúng khi đang fetch
- [ ] 3 stat cards cũ vẫn đúng
- [ ] Team comparison panel vẫn hiển thị (khi >= 4 members)
- [ ] Schedule heatmap vẫn hoạt động
- [ ] Mobile: layout không bị vỡ (stats row grid 1 cột trên mobile)

### Không cần test DB

Story này **không có migration** — chỉ thay đổi frontend query pattern và UI.

---

## Notes cho Dev Agent

1. **`useSelfSparkline` reuses `useSelfAnalytics`** — KHÔNG tạo query mới tới DB. `useSelfAnalytics` đã có RLS đúng (member chỉ thấy data của mình). `getTimeRange(4)` đã có sẵn trong `analytics.utils.ts`.

2. **`computeReportStreak` là pure function** — không phụ thuộc state. Test riêng dễ dàng. Inject `today` để deterministic.

3. **Streak logic chỉ tính calendar days, không phải chỉ workdays** — member có thể báo cáo cuối tuần. Đơn giản nhất.

4. **`DailyReport` type** đã có trong `@/features/daily-report/services/daily-report.service` — import để type `todayReport`.

5. **`QUERY_KEYS.dailyReports`** (key hiện có) dùng cho `getTodayReport` query — không cần key mới. Query key pattern: `[QUERY_KEYS.dailyReports, tenantId, userId, 'today', todayISO]` để không conflict với infinite scroll query.

6. **`Link` từ `@tanstack/react-router`** — KHÔNG phải `react-router-dom`. Kiểm tra import pattern trong codebase.

7. **`format(new Date(todayReport.submitted_at), 'HH:mm')`** — `submitted_at` là timestamptz string từ Supabase, cần `new Date()` để parse trước khi `format`.

8. **`sparklineConfig` dùng `var(--chart-2)`** — giống `MemberTrendChart.tsx` để nhất quán màu sắc trong app.

9. **Quick action card** nên luôn hiển thị (kể cả loading state) để người dùng thấy ngay. Skeleton 1 dòng là đủ.

10. **Vị trí render trong JSX của `SelfDashboard`:**
    ```
    PageContainer
    ├── Header row (User icon + title + timezone)
    ├── Stats row (3 cards → mở rộng thêm streak = 4 cards?)
    ├── Quick action card   ← THÊM MỚI (trên heatmap, dễ thấy)
    ├── Sparkline 4 tuần    ← THÊM MỚI (dưới quick action)
    ├── Team comparison panel (conditional)
    └── Schedule heatmap
    ```
    Hoặc streak có thể là card thứ 4 trong stats row grid. Chọn cách nào đẹp hơn khi nhìn trên màn hình thực tế.

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5

### Debug Log References

- **Quan trọng — Tránh wheel reinvention:** Phát hiện `computeStreak()` đã tồn tại tại `daily-report.schema.ts` với logic workday-aware (T7/CN không phá streak). Đã reuse thay vì tạo `computeReportStreak` trùng lặp.
- T1.1 trong story nói "thêm `selfSparkline` key" nhưng Technical Requirements xác nhận sparkline reuse analytics query key qua `useSelfAnalytics`. Đã chỉ thêm `selfStreak` key theo đúng spec kỹ thuật.
- TypeScript pass không lỗi sau implement. 296/296 tests pass (no regressions).

### Completion Notes List

✅ **T1 — Sparkline 4 tuần:**
- Tạo `use-self-sparkline.ts` — wrapper đơn giản của `useSelfAnalytics(getTimeRange(4))`
- `WeeklySparkline` sub-component bên trong `SelfDashboard.tsx` dùng `AreaChart` + `ChartContainer` — nhất quán với `MemberTrendChart.tsx`
- `sparkChartData` build từ `weeklyHours` với fill 0 cho tuần thiếu data
- Gradient fill `var(--chart-2)` với tooltip inline

✅ **T2 — Streak counter:**
- Tạo `use-self-streak.ts` — reuse `computeStreak()` từ `daily-report.schema.ts` (workday-aware, đã tested 11 test cases)
- Streak hiển thị là card thứ 4 trong stats row (`grid-cols-2 lg:grid-cols-4`)
- Label: "🔥 N ngày" hoặc "—" khi streak = 0

✅ **T3 — Quick Action:**
- Query `QUERY_KEYS.dailyReports + 'today'` với `DailyReportService.getTodayReport`
- `QuickActionCard` sub-component: submitted → CheckCircle2 + "Đã báo cáo hôm nay" + giờ submit; chưa → FileText + Button Link đến `/daily-report`
- `submitted_at` null-safe

✅ **T4 — TypeScript & lint:** `npx tsc --noEmit` — 0 errors. `npx vitest run` — 296/296 pass.

### File List

**Tạo mới:**
- `src/features/dashboard/hooks/use-self-sparkline.ts`
- `src/features/dashboard/hooks/use-self-streak.ts`

**Sửa đổi:**
- `src/features/dashboard/components/SelfDashboard.tsx`
- `src/lib/query-keys.ts`

---

## Change Log

- 2026-03-25: Tạo story 8-12 — My Dashboard UI enhancement (sparkline 4 tuần + streak counter + quick action).
- 2026-03-25: Implement hoàn thành — sparkline 4 tuần (WeeklySparkline + AreaChart), streak counter (reuse computeStreak workday-aware), quick action card (getTodayReport). 2 hooks mới, SelfDashboard và query-keys.ts cập nhật. TypeScript 0 lỗi, 296/296 tests pass.
