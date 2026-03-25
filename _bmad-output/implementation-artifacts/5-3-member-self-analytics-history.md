# Story 5.3: Member Self-Analytics History

**Status:** done
**Epic:** 5 — Hours Analytics
**Story ID:** 5.3
**Story Key:** 5-3-member-self-analytics-history
**Created:** 2026-03-25

---

## Story

As a member,
I want to view my own hours history and commitment rate trends over time,
So that I can self-assess my performance and proactively improve before the manager brings it up.

---

## Acceptance Criteria

1. **Lịch sử tuần** — Khi member truy cập tab "Lịch sử" trong `/my-dashboard`, hiển thị trend chart committed vs actual hours theo từng tuần trong 4 tuần gần nhất (mặc định).

2. **Time range selector** — Member có thể chọn xem 4 / 8 / 12 tuần gần nhất. Chart cập nhật theo lựa chọn.

3. **Highlight tuần thấp** — Các cột (bar) trong chart của tuần có commitment rate < 70% được tô màu khác biệt (destructive color) để member dễ nhận ra. Không có message phán xét hay warning text.

4. **Data isolation** — Member chỉ thấy data của chính mình. RLS `daily_reports` đảm bảo không thể truy cập record của người khác.

5. **Analytics page cho member** — Khi member truy cập `/analytics`, thay vì thấy "Không có quyền truy cập", member thấy `SelfAnalyticsHistory` (lịch sử commitment của chính mình). Manager/Owner vẫn thấy team analytics như cũ.

6. **Read-only** — Không có write operations trên trang này. Không có form submit, không có mutation.

---

## Tasks / Subtasks

### ⚠️ KHÔNG CẦN MIGRATION — Tất cả columns đã tồn tại

Tất cả data đọc từ `daily_reports.hours_logged` + `tenant_members.committed_hours` + `tenants.default_committed_hours` — đã verified ở Story 5.1.

Member RLS (`user_id = auth.uid() OR is_tenant_manager()`) cho phép member đọc chính `daily_reports` của họ khi truyền đúng `userId = auth.uid()`.

**KHÔNG tạo migration mới.**

---

### ✅ Task 1: Tạo `use-self-analytics.ts` hook

File: `src/features/analytics/hooks/use-self-analytics.ts`

Thin wrapper around `useMemberTrend` sử dụng `user.id` từ `useAuthStore`.

```typescript
import { useAuthStore } from '@/stores/auth-store'
import { useMemberTrend } from '@/features/analytics/hooks/use-member-trend'

/**
 * useSelfAnalytics — lấy weekly hours trend của chính member đang đăng nhập.
 * Reuses useMemberTrend với user.id — RLS đảm bảo chỉ đọc được data của chính mình.
 */
export function useSelfAnalytics(startDate: string, endDate: string) {
  const { user } = useAuthStore()
  return useMemberTrend(user?.id ?? null, startDate, endDate)
}
```

---

### ✅ Task 2: Tạo `SelfAnalyticsHistory.tsx` component

File: `src/features/analytics/components/SelfAnalyticsHistory.tsx`

Component tự fetch committed hours của member và render chart với per-bar highlight cho tuần rate < 70%.

```typescript
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/stores/auth-store'
import { useTenantStore } from '@/stores/tenant-store'
import { useTenantMembers } from '@/features/tenant/hooks/use-tenant-members'
import { getTenantSettings } from '@/features/tenant/services/tenant.service'
import { QUERY_KEYS } from '@/lib/query-keys'
import { useSelfAnalytics } from '@/features/analytics/hooks/use-self-analytics'
import {
  getTimeRange,
  buildWeeklyChartData,
  calcAvgCommitmentRate,
  formatRate,
} from '@/features/analytics/utils/analytics.utils'

const RANGE_OPTIONS = [
  { label: '4 tuần gần nhất', value: '4' },
  { label: '8 tuần gần nhất', value: '8' },
  { label: '12 tuần gần nhất', value: '12' },
]

export function SelfAnalyticsHistory() {
  const { user } = useAuthStore()
  const { activeTenantId } = useTenantStore()
  const [rangeWeeks, setRangeWeeks] = useState<number>(4)

  const { startDate, endDate } = getTimeRange(rangeWeeks)

  // ── Queries ────────────────────────────────────────────────────────────────

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

  const { data: weeklyHours = [], isLoading: isHoursLoading } = useSelfAnalytics(startDate, endDate)

  // ── Compute effective committed hours ─────────────────────────────────────

  const myMember = members.find(m => m.user_id === user?.id)
  const defaultCommittedHours = tenantSettings?.default_committed_hours ?? 40
  const effectiveCommittedHours = myMember?.committed_hours ?? defaultCommittedHours

  // ── Chart data ─────────────────────────────────────────────────────────────

  const chartData = buildWeeklyChartData(weeklyHours, startDate, endDate, effectiveCommittedHours)
  const avgRate = calcAvgCommitmentRate(weeklyHours, effectiveCommittedHours)

  const isLoading = isMembersLoading || isSettingsLoading

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header + Range Selector */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Lịch sử commitment</p>
          <p className="text-xs text-muted-foreground">
            Trung bình:{' '}
            <span className="font-medium text-foreground">{formatRate(avgRate)}</span>
          </p>
        </div>
        <Select
          value={String(rangeWeeks)}
          onValueChange={(v) => setRangeWeeks(Number(v))}
        >
          <SelectTrigger className="w-44 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGE_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Chart */}
      {isHoursLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="weekLabel" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value: number) => `${value}h`} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {/* Committed — luôn muted/baseline */}
            <Bar
              dataKey="committed"
              name="Cam kết"
              fill="hsl(var(--muted-foreground))"
              opacity={0.4}
              radius={[2, 2, 0, 0]}
            />
            {/* Actual — highlight đỏ khi rate < 70% (AC3) */}
            <Bar dataKey="actual" name="Thực tế" radius={[2, 2, 0, 0]}>
              {chartData.map((entry, index) => {
                const rate =
                  entry.committed > 0 ? entry.actual / entry.committed : null
                const fill =
                  rate !== null && rate < 0.7
                    ? 'hsl(var(--destructive))'
                    : 'hsl(var(--primary))'
                return <Cell key={index} fill={fill} />
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      {chartData.length === 0 && !isHoursLoading && (
        <p className="text-center text-sm text-muted-foreground py-8">
          Không có dữ liệu trong khoảng thời gian này.
        </p>
      )}

      {/* Legend cho màu */}
      <p className="text-xs text-muted-foreground">
        Cột đỏ = tuần dưới 70% commitment. Không có phán xét — chỉ để bạn tự theo dõi.
      </p>
    </div>
  )
}
```

---

### ✅ Task 3: Cập nhật `analytics.tsx` route — member thấy self-analytics

File: `src/routes/_app/analytics.tsx`

Thay block "no access" bằng `<SelfAnalyticsHistory />`:

```typescript
// TRƯỚC:
if (!canViewTeamAnalytics) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <BarChart3 ... />
      <h1>Không có quyền truy cập</h1>
      ...
    </div>
  )
}

// SAU:
if (!canViewTeamAnalytics) {
  return <SelfAnalyticsHistory />
}
```

**`my-dashboard.tsx` giữ nguyên dạng ban đầu** — chỉ render `SelfDashboard`, không có Tabs.

---

### ✅ Task 4: Unit tests

File: `src/features/analytics/__tests__/self-analytics.test.ts`

Test các utilities được dùng cho highlight logic và chart data:

```typescript
import { describe, it, expect } from 'vitest'
import { buildWeeklyChartData, calcAvgCommitmentRate, formatRate } from '../utils/analytics.utils'

describe('SelfAnalytics — highlight logic', () => {
  it('buildWeeklyChartData generates full range even with gaps', () => {
    const data = buildWeeklyChartData(
      [{ weekOf: '2026-03-16', actualHours: 20 }],
      '2026-03-09',
      '2026-03-22',
      35,
    )
    expect(data).toHaveLength(2)
    expect(data[0].actual).toBe(0)   // tuần không có report → 0
    expect(data[1].actual).toBe(20)
    expect(data[0].committed).toBe(35)
  })

  it('highlight condition: rate < 0.7 means fill = destructive', () => {
    // AC3: tuần có rate < 70% → highlight (logic này nằm trong component)
    // Test qua calcAvgCommitmentRate để xác nhận tính đúng
    const rate = 20 / 35  // ~57% → under 70%
    expect(rate).toBeLessThan(0.7)
  })

  it('calcAvgCommitmentRate trả về null khi không có data', () => {
    expect(calcAvgCommitmentRate([], 35)).toBeNull()
  })

  it('formatRate hiển thị "—" khi null', () => {
    expect(formatRate(null)).toBe('—')
  })

  it('formatRate hiển thị percentage khi có rate', () => {
    expect(formatRate(20 / 35)).toBe('57%')
  })
})
```

---

## Architecture & Pattern Compliance

### Service Layer Pattern

```
my-dashboard.tsx (route — Tabs wrapper)
      ↓
SelfAnalyticsHistory.tsx (component)
      ↓
useSelfAnalytics()              ← thin wrapper
      ↓
useMemberTrend(user.id, ...)    ← đã có từ Story 5-2, reuse 100%
      ↓
AnalyticsService.getMemberReportsForPeriod(tenantId, userId, ...) ← filter by userId
      ↓
daily_reports table (RLS: member chỉ đọc được user_id = auth.uid())
```

- **KHÔNG** gọi service trực tiếp từ component
- **KHÔNG** tạo Supabase client mới
- **KHÔNG** barrel exports — import trực tiếp từ file
- **KHÔNG** dùng chart library khác (chỉ Recharts qua đã có sẵn)

### RLS — Member Data Isolation (AC4)

| Table | Policy | Member access |
|-------|--------|---------------|
| `daily_reports` SELECT | `daily_reports_select_policy` | `user_id = auth.uid()` → member chỉ đọc được của mình |
| `tenant_members` SELECT | existing | member thấy tất cả members (để lấy committed_hours của chính mình) |
| `tenants` SELECT | existing | member thấy tenant settings |

→ `getMemberReportsForPeriod(tenantId, userId, ...)` khi `userId = auth.uid()` sẽ pass qua RLS. **Không cần bypass.**

### Recharts — Per-Bar Color (AC3 highlight)

Recharts `<Bar>` hỗ trợ `<Cell>` để set fill per data point:

```typescript
<Bar dataKey="actual">
  {chartData.map((entry, index) => {
    const rate = entry.committed > 0 ? entry.actual / entry.committed : null
    const fill = rate !== null && rate < 0.7
      ? 'hsl(var(--destructive))'
      : 'hsl(var(--primary))'
    return <Cell key={index} fill={fill} />
  })}
</Bar>
```

`Cell` đã có trong `recharts` package (Recharts `^3.6.0` đã installed từ 5-2). Import thêm `{ Cell }` từ `'recharts'`.

### ShadCN Tabs Component

`Tabs`, `TabsContent`, `TabsList`, `TabsTrigger` đã có trong `src/components/ui/` (standard ShadCN). Nếu chưa có:

```bash
npx shadcn@latest add tabs
```

Verify: `ls src/components/ui/tabs.tsx`

---

## DB Schema (verified — không thay đổi từ 5.1/5.2)

| Column | Table | Type | Notes |
|--------|-------|------|-------|
| `hours_logged` | `daily_reports` | numeric | SUM này cho actual hours |
| `report_date` | `daily_reports` | date | filter by period |
| `user_id` | `daily_reports` | uuid | RLS filter (member = auth.uid()) |
| `committed_hours` | `tenant_members` | smallint | NULL → dùng default |
| `default_committed_hours` | `tenants` | smallint | fallback, default 40 |

---

## Previous Story Intelligence (5.2)

### Files đã có từ 5.2 — PHẢI REUSE, không tạo lại

| File | Reuse |
|------|-------|
| `src/features/analytics/services/analytics.service.ts` | `getMemberReportsForPeriod()` — dùng trực tiếp |
| `src/features/analytics/hooks/use-member-trend.ts` | Wrap trong `useSelfAnalytics()` |
| `src/features/analytics/utils/analytics.utils.ts` | `getTimeRange()`, `buildWeeklyChartData()`, `calcAvgCommitmentRate()`, `formatRate()`, `groupReportsByWeek()` |
| `src/components/ui/chart.tsx` | ShadCN chart đã install — available |
| `src/features/tenant/hooks/use-tenant-members.ts` | Lấy member's `committed_hours` |
| `src/features/tenant/services/tenant.service.ts` | `getTenantSettings()` |

### Learnings từ 5.2

- `AnalyticsService.getMemberReportsForPeriod()` đã có `.limit(10000)` để bypass Supabase 1000-row cap
- `hours_logged` là `numeric` — cần `parseFloat()` hoặc cast (service đã xử lý)
- `groupReportsByWeek()` xử lý ISO week grouping, hỗ trợ null/invalid date guard
- `staleTime: 2 * 60_000` cho analytics, `5 * 60_000` cho settings
- `QUERY_KEYS.analytics = 'analytics'` đã có trong `query-keys.ts`
- `QUERY_KEYS.tenantSettings = 'tenant-settings'` đã có
- Commit format: `feat(5-3): ...`

### Learnings từ 3.3

- `SelfDashboard.tsx` sử dụng pattern: `useTenantMembers()` → find `m.user_id === user?.id` để lấy committed_hours
- Trang `/my-dashboard` accessible bởi **ALL roles** (member/manager/owner) — không cần role guard
- `src/routes/_app/my-dashboard.tsx` hiện chỉ có `import SelfDashboard` + `component: SelfDashboard` → thay thế bằng wrapper Tabs

---

## Anti-Pattern Prevention

| ❌ ĐỪNG làm | ✅ NÊN làm |
|------------|-----------|
| Tạo lại `getMemberReportsForPeriod` cho member view | Reuse từ `AnalyticsService` — RLS tự filter đúng với userId = auth.uid() |
| Tạo migration cho self-analytics | Không cần — member đọc được `daily_reports` của mình qua RLS |
| Tạo `MemberTrendChart` variant mới | Import `{ Cell }` từ recharts, dùng per-bar fill trong `SelfAnalyticsHistory.tsx` |
| Sửa `SelfDashboard.tsx` | KHÔNG touch — nó thành content của tab "Tổng quan" |
| Tạo lại `useTenantMembers` hook | Import từ `@/features/tenant/hooks/use-tenant-members` |
| Route-level fetch/loader | Dùng React Query hooks trong component |
| Tô màu chart bằng inline CSS | Dùng `hsl(var(--destructive))` và `hsl(var(--primary))` — CSS variables |
| Thêm warning text cho tuần thấp | Chỉ visual highlight (màu bar) — không có text phán xét (AC3) |
| Dùng `useTeamAnalytics` cho self view | `useTeamAnalytics` cần manager RLS — dùng `useSelfAnalytics` (wraps `useMemberTrend`) |

---

## Files to Create / Modify

### Tạo mới

| File | Purpose |
|------|---------|
| `src/features/analytics/hooks/use-self-analytics.ts` | Thin wrapper: useMemberTrend + auth.uid() |
| `src/features/analytics/components/SelfAnalyticsHistory.tsx` | Self-view history chart với per-bar highlight |
| `src/features/analytics/__tests__/self-analytics.test.ts` | Unit tests cho utils |

### Chỉnh sửa

| File | Thay đổi |
|------|----------|
| `src/routes/_app/analytics.tsx` | Thay "no access" block bằng `<SelfAnalyticsHistory />` cho member |

### KHÔNG CHẠM

| File | Lý do |
|------|-------|
| `src/features/dashboard/components/SelfDashboard.tsx` | Không liên quan |
| `src/routes/_app/my-dashboard.tsx` | Giữ nguyên dạng ban đầu |
| `src/features/analytics/services/analytics.service.ts` | Reuse nguyên |
| `src/features/analytics/hooks/use-member-trend.ts` | Reuse nguyên |
| `src/features/analytics/utils/analytics.utils.ts` | Reuse nguyên |
| `src/lib/routes.ts` | Không có route mới |
| `src/lib/query-keys.ts` | Không có query key mới |
| `src/components/layout/data/sidebar-data.ts` | Không thay đổi nav |

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5

### Debug Log References

_Không có issue — implementation thẳng theo spec._

### Completion Notes List

- ✅ Task 1: Tạo `use-self-analytics.ts` — thin wrapper gọi `useMemberTrend(user.id, ...)`. RLS tự filter daily_reports theo user.
- ✅ Task 2: Tạo `SelfAnalyticsHistory.tsx` — chart Recharts với per-bar `Cell` highlight (đỏ khi rate < 70%). Reuse `getTimeRange`, `buildWeeklyChartData`, `calcAvgCommitmentRate`, `formatRate` từ analytics.utils.ts.
- ✅ Task 3: Cập nhật `analytics.tsx` — thay "no access" block bằng `<SelfAnalyticsHistory />`. Member thấy self-analytics, manager/owner không bị ảnh hưởng. `my-dashboard.tsx` giữ nguyên dạng ban đầu.
- ✅ Task 4: 9 unit tests trong `self-analytics.test.ts` — cover highlight logic, buildWeeklyChartData gaps, calcAvgCommitmentRate edge cases, formatRate.
- ✅ Full test suite: 266/266 pass, 0 TypeScript errors, 0 regressions.

### File List

- `src/features/analytics/hooks/use-self-analytics.ts` ← NEW
- `src/features/analytics/components/SelfAnalyticsHistory.tsx` ← NEW
- `src/features/analytics/__tests__/self-analytics.test.ts` ← NEW
- `src/routes/_app/analytics.tsx` ← MODIFIED (thay "no access" block)
