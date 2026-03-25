# Story 5.2: Team Hours Analytics Dashboard

**Status:** review
**Epic:** 5 — Hours Analytics
**Story ID:** 5.2
**Story Key:** 5-2-team-hours-analytics-dashboard
**Created:** 2026-03-25
**Updated:** 2026-03-25

---

## Story

As a Manager or Owner,
I want to see hours analytics for the whole team and drill down into individual members over time,
So that I have objective data for performance conversations instead of relying on gut feeling.

---

## Acceptance Criteria

1. **Team Overview** — Khi Manager/Owner truy cập `/analytics`, hiển thị bảng team overview với tất cả active members: tên, committed hours, actual hours (tuần hiện tại), commitment rate (%). Visual indicator rõ ràng cho members có rate < 70% (màu đỏ/amber).

2. **Per-Member Drill-down** — Manager chọn một member và time range (4 tuần / 8 tuần / 12 tuần). Hiển thị trend chart: committed vs actual hours theo từng tuần trong range đã chọn. Hiển thị average commitment rate trong period dưới dạng số.

3. **Data Calculation** — Actual hours tính từ `SUM(daily_reports.hours_logged)` trong period. Chỉ reports có status `submitted` (i.e., tồn tại trong DB — DB không có separate "status" field, mọi record đều là submitted). Committed hours dùng `effectiveCommittedHours = member.committed_hours ?? tenant.default_committed_hours`.

4. **Chart Library** — Charts implement bằng **Recharts qua ShadCN chart component** (`src/components/ui/chart.tsx`). Nếu chưa có file này → install trước: `npx shadcn@latest add chart`. Không dùng chart library khác.

5. **Read-Only** — Trang analytics không có write operations. Không có form submit, không có mutation.

6. **Permission Gate** — Chỉ Manager/Owner mới truy cập được analytics overview của cả team. Nếu member role truy cập route này → redirect hoặc hiển thị "Không có quyền truy cập."

---

## Tasks / Subtasks

### ⚠️ KHÔNG CẦN MIGRATION — Tất cả columns đã tồn tại

**MCP đã verify:**
- `daily_reports.hours_logged` — `numeric`, NOT NULL, default 0 ✅
- `daily_reports.report_date` — `date`, NOT NULL ✅
- `daily_reports.user_id` — `uuid`, NOT NULL ✅
- `tenant_members.committed_hours` — `smallint`, nullable ✅
- `tenants.default_committed_hours` — `smallint`, NOT NULL, default 40 ✅
- RLS `daily_reports_select_policy` — Manager/Owner thấy tất cả reports trong tenant ✅

**KHÔNG tạo migration mới.**

---

### Task 0: Install ShadCN chart component (nếu chưa có)

Kiểm tra `src/components/ui/chart.tsx`. Nếu không tồn tại:

```bash
npx shadcn@latest add chart
```

File sẽ được tạo tại `src/components/ui/chart.tsx`. Recharts (`^3.6.0`) đã có trong `package.json` — không cần install thêm.

- [x] **Task 0 DONE** — `src/components/ui/chart.tsx` đã được install

---

### Task 1: Tạo `analytics.service.ts`

File: `src/features/analytics/services/analytics.service.ts`

```typescript
import { supabase } from '@/lib/supabase-browser'

export type MemberHoursRow = {
  userId: string
  totalHours: number
}

export type WeeklyHoursRow = {
  weekOf: string       // 'yyyy-MM-dd' (Monday ISO week start)
  actualHours: number
}

export const AnalyticsService = {
  /**
   * Lấy tổng hours_logged của TỪNG MEMBER trong tenant cho một khoảng ngày.
   * Dùng cho team overview (tuần hiện tại) — manager thấy tất cả qua RLS.
   * Client-side aggregation thay vì RPC để tránh migration.
   */
  getTeamHoursForPeriod: async (
    tenantId: string,
    periodStart: string,  // 'yyyy-MM-dd'
    periodEnd: string,    // 'yyyy-MM-dd'
  ): Promise<MemberHoursRow[]> => {
    const { data, error } = await supabase
      .from('daily_reports')
      .select('user_id, hours_logged')
      .eq('tenant_id', tenantId)
      .gte('report_date', periodStart)
      .lte('report_date', periodEnd)

    if (error) throw error

    // Client-side aggregation: group by user_id
    const map = new Map<string, number>()
    for (const row of data ?? []) {
      const prev = map.get(row.user_id) ?? 0
      map.set(row.user_id, prev + Number(row.hours_logged))
    }
    return Array.from(map.entries()).map(([userId, totalHours]) => ({ userId, totalHours }))
  },

  /**
   * Lấy hours_logged của một member theo từng tuần trong khoảng thời gian.
   * Dùng cho per-member trend chart.
   * weekOf = ISO week start (Monday) của report_date — tính client-side.
   */
  getMemberWeeklyHours: async (
    tenantId: string,
    userId: string,
    startDate: string,  // 'yyyy-MM-dd' (Monday, bắt đầu range)
    endDate: string,    // 'yyyy-MM-dd' (Sunday, kết thúc range)
  ): Promise<WeeklyHoursRow[]> => {
    const { data, error } = await supabase
      .from('daily_reports')
      .select('report_date, hours_logged')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .gte('report_date', startDate)
      .lte('report_date', endDate)
      .order('report_date', { ascending: true })

    if (error) throw error

    // Group by ISO week start (Monday)
    const weekMap = new Map<string, number>()
    for (const row of data ?? []) {
      const weekStart = getISOWeekStart(row.report_date)
      const prev = weekMap.get(weekStart) ?? 0
      weekMap.set(weekStart, prev + Number(row.hours_logged))
    }
    return Array.from(weekMap.entries())
      .map(([weekOf, actualHours]) => ({ weekOf, actualHours }))
      .sort((a, b) => a.weekOf.localeCompare(b.weekOf))
  },
}

/** Helper: tính Monday (ISO week start) cho một ngày 'yyyy-MM-dd' */
function getISOWeekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getUTCDay() // 0=Sun, 1=Mon, ...6=Sat
  const diff = day === 0 ? -6 : 1 - day  // Mon=0 offset
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}
```

---

### Task 2: Tạo `use-team-analytics.ts` hook

File: `src/features/analytics/hooks/use-team-analytics.ts`

```typescript
import { useQuery } from '@tanstack/react-query'
import { useTenantStore } from '@/stores/tenant-store'
import { QUERY_KEYS } from '@/lib/query-keys'
import { AnalyticsService } from '@/features/analytics/services/analytics.service'

/**
 * useTeamAnalytics — lấy tổng hours của từng member trong một tuần.
 * Dùng cho team overview table.
 * staleTime 2 phút — analytics không thay đổi realtime.
 */
export function useTeamAnalytics(weekStart: string, weekEnd: string) {
  const { activeTenantId } = useTenantStore()
  return useQuery({
    queryKey: [QUERY_KEYS.analytics, 'team-overview', activeTenantId, weekStart],
    queryFn: () =>
      AnalyticsService.getTeamHoursForPeriod(activeTenantId!, weekStart, weekEnd),
    enabled: !!activeTenantId && !!weekStart,
    staleTime: 2 * 60_000,
  })
}
```

---

### Task 3: Tạo `use-member-trend.ts` hook

File: `src/features/analytics/hooks/use-member-trend.ts`

```typescript
import { useQuery } from '@tanstack/react-query'
import { useTenantStore } from '@/stores/tenant-store'
import { QUERY_KEYS } from '@/lib/query-keys'
import { AnalyticsService } from '@/features/analytics/services/analytics.service'

/**
 * useMemberTrend — lấy weekly hours của một member trong range đã chọn.
 * Disabled khi userId chưa được chọn.
 * staleTime 2 phút.
 */
export function useMemberTrend(userId: string | null, startDate: string, endDate: string) {
  const { activeTenantId } = useTenantStore()
  return useQuery({
    queryKey: [QUERY_KEYS.analytics, 'member-trend', activeTenantId, userId, startDate],
    queryFn: () =>
      AnalyticsService.getMemberWeeklyHours(activeTenantId!, userId!, startDate, endDate),
    enabled: !!activeTenantId && !!userId && !!startDate,
    staleTime: 2 * 60_000,
  })
}
```

---

### Task 4: Tạo `analytics.utils.ts`

File: `src/features/analytics/utils/analytics.utils.ts`

```typescript
import { format, startOfISOWeek, endOfISOWeek, subWeeks } from 'date-fns'

/**
 * getTimeRange — tính startDate và endDate cho N tuần gần nhất (kể cả tuần hiện tại).
 * Trả về { startDate, endDate } dạng 'yyyy-MM-dd'.
 */
export function getTimeRange(weeksBack: number): { startDate: string; endDate: string } {
  const now = new Date()
  const weekStart = startOfISOWeek(subWeeks(now, weeksBack - 1))
  const weekEnd = endOfISOWeek(now)
  return {
    startDate: format(weekStart, 'yyyy-MM-dd'),
    endDate: format(weekEnd, 'yyyy-MM-dd'),
  }
}

/**
 * getCurrentWeekRange — tuần hiện tại.
 */
export function getCurrentWeekRange(): { weekStart: string; weekEnd: string } {
  const now = new Date()
  return {
    weekStart: format(startOfISOWeek(now), 'yyyy-MM-dd'),
    weekEnd: format(endOfISOWeek(now), 'yyyy-MM-dd'),
  }
}

/**
 * calcAvgCommitmentRate — tính average commitment rate từ weekly data.
 * Chỉ tính các tuần có committed > 0. Trả về null nếu không có data.
 */
export function calcAvgCommitmentRate(
  weeklyData: { weekOf: string; actualHours: number }[],
  committedHoursPerWeek: number,
): number | null {
  if (!committedHoursPerWeek || committedHoursPerWeek <= 0) return null
  if (weeklyData.length === 0) return null
  const totalActual = weeklyData.reduce((sum, w) => sum + w.actualHours, 0)
  const totalCommitted = committedHoursPerWeek * weeklyData.length
  return totalActual / totalCommitted
}

/**
 * buildWeeklyChartData — merge weekly hours data với committed hours per week.
 * Tạo đủ data points cho mọi tuần trong range (kể cả tuần member không có report = 0h).
 */
export function buildWeeklyChartData(
  weeklyHours: { weekOf: string; actualHours: number }[],
  startDate: string,
  endDate: string,
  committedHoursPerWeek: number,
): { weekLabel: string; actual: number; committed: number }[] {
  // Build map của data đã có
  const hoursMap = new Map(weeklyHours.map(w => [w.weekOf, w.actualHours]))

  // Generate tất cả các tuần trong range
  const result: { weekLabel: string; actual: number; committed: number }[] = []
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  let current = startOfISOWeek(start)

  while (current <= end) {
    const weekOf = format(current, 'yyyy-MM-dd')
    const weekLabel = format(current, 'dd/MM')
    result.push({
      weekLabel,
      actual: hoursMap.get(weekOf) ?? 0,
      committed: committedHoursPerWeek,
    })
    current = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000)
  }
  return result
}

/**
 * getCommitmentRateColor — Tailwind class dựa trên rate.
 * < 70% → destructive/amber, >= 70% → default.
 */
export function getCommitmentRateColor(rate: number | null): string {
  if (rate === null) return 'text-muted-foreground'
  if (rate < 0.7) return 'text-destructive font-medium'
  if (rate < 0.85) return 'text-amber-600 dark:text-amber-400 font-medium'
  return 'text-foreground'
}

export function formatRate(rate: number | null): string {
  if (rate === null) return '—'
  return `${Math.round(rate * 100)}%`
}
```

---

### Task 5: Tạo `TeamAnalyticsOverview.tsx`

File: `src/features/analytics/components/TeamAnalyticsOverview.tsx`

Hiển thị bảng team overview với committed/actual/rate cho tuần hiện tại.

```typescript
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import type { TenantMemberWithUser } from '@/features/tenant/services/tenant.service'
import { calcCommitmentRate } from '@/features/dashboard/utils/dashboard.utils'
import { formatRate, getCommitmentRateColor } from '@/features/analytics/utils/analytics.utils'

interface MemberAnalyticsRowProps {
  member: TenantMemberWithUser
  actualHours: number
  defaultCommittedHours: number
  onClick: (memberId: string, userId: string) => void
  isSelected: boolean
}

function MemberAnalyticsRow({ member, actualHours, defaultCommittedHours, onClick, isSelected }: MemberAnalyticsRowProps) {
  const committedHours = member.committed_hours ?? defaultCommittedHours
  const rate = calcCommitmentRate(actualHours, committedHours)
  const rateColor = getCommitmentRateColor(rate)
  const name = member.users.full_name || member.users.email?.split('@')[0] || 'Member'

  return (
    <tr
      className={`border-b border-border cursor-pointer transition-colors hover:bg-muted/50 ${isSelected ? 'bg-muted' : ''}`}
      onClick={() => onClick(member.id, member.user_id)}
    >
      <td className="py-3 px-4">
        <span className="font-medium text-sm">{name}</span>
        {(member.role === 'owner' || member.role === 'manager') && (
          <Badge variant="secondary" className="ml-2 text-xs">{member.role}</Badge>
        )}
      </td>
      <td className="py-3 px-4 text-sm text-right">{committedHours}h</td>
      <td className="py-3 px-4 text-sm text-right">{actualHours}h</td>
      <td className={`py-3 px-4 text-sm text-right ${rateColor}`}>
        {formatRate(rate)}
      </td>
    </tr>
  )
}

interface TeamAnalyticsOverviewProps {
  members: TenantMemberWithUser[]
  hoursMap: Map<string, number>  // userId → totalHours
  defaultCommittedHours: number
  isLoading: boolean
  selectedUserId: string | null
  onSelectMember: (memberId: string, userId: string) => void
}

export function TeamAnalyticsOverview({
  members,
  hoursMap,
  defaultCommittedHours,
  isLoading,
  selectedUserId,
  onSelectMember,
}: TeamAnalyticsOverviewProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-muted/50 border-b border-border">
            <th className="py-2 px-4 text-left text-xs font-medium text-muted-foreground">Thành viên</th>
            <th className="py-2 px-4 text-right text-xs font-medium text-muted-foreground">Cam kết</th>
            <th className="py-2 px-4 text-right text-xs font-medium text-muted-foreground">Thực tế</th>
            <th className="py-2 px-4 text-right text-xs font-medium text-muted-foreground">Tỷ lệ</th>
          </tr>
        </thead>
        <tbody>
          {members.map(member => (
            <MemberAnalyticsRow
              key={member.id}
              member={member}
              actualHours={hoursMap.get(member.user_id) ?? 0}
              defaultCommittedHours={defaultCommittedHours}
              onClick={onSelectMember}
              isSelected={selectedUserId === member.user_id}
            />
          ))}
        </tbody>
      </table>
      {members.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">Chưa có thành viên nào.</p>
      )}
    </div>
  )
}
```

---

### Task 6: Tạo `MemberTrendChart.tsx`

File: `src/features/analytics/components/MemberTrendChart.tsx`

Chart committed vs actual hours theo tuần dùng ShadCN `BarChart` (Recharts).

```typescript
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import { calcAvgCommitmentRate, formatRate } from '@/features/analytics/utils/analytics.utils'

interface MemberTrendChartProps {
  memberName: string
  chartData: { weekLabel: string; actual: number; committed: number }[]
  committedHoursPerWeek: number
  isLoading: boolean
}

export function MemberTrendChart({
  memberName,
  chartData,
  committedHoursPerWeek,
  isLoading,
}: MemberTrendChartProps) {
  if (isLoading) {
    return <Skeleton className="h-64 w-full" />
  }

  const weeklyHoursForCalc = chartData.map(d => ({ weekOf: d.weekLabel, actualHours: d.actual }))
  const avgRate = calcAvgCommitmentRate(weeklyHoursForCalc, committedHoursPerWeek)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{memberName}</p>
        <p className="text-sm text-muted-foreground">
          Avg: <span className="font-medium text-foreground">{formatRate(avgRate)}</span>
        </p>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="weekLabel" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip formatter={(value: number) => `${value}h`} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="committed" name="Cam kết" fill="hsl(var(--muted-foreground))" opacity={0.4} radius={[2, 2, 0, 0]} />
          <Bar dataKey="actual" name="Thực tế" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      {chartData.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">Không có dữ liệu trong khoảng thời gian này.</p>
      )}
    </div>
  )
}
```

> **Note:** Nếu ShadCN `chart.tsx` đã được install, có thể wrap trong `ChartContainer` với `ChartConfig` để consistent với design system. Nhưng bare Recharts với CSS variables là acceptable.

---

### Task 7: Cập nhật `analytics.tsx` route

File: `src/routes/_app/analytics.tsx`

**Thay thế hoàn toàn** placeholder hiện tại với full implementation:

```typescript
import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { BarChart3 } from 'lucide-react'
import { format, startOfISOWeek, endOfISOWeek } from 'date-fns'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/stores/auth-store'
import { useTenantStore } from '@/stores/tenant-store'
import { useTenantMembers } from '@/features/tenant/hooks/use-tenant-members'
import { getTenantSettings } from '@/features/tenant/services/tenant.service'
import { useQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/lib/query-keys'
import { useTeamAnalytics } from '@/features/analytics/hooks/use-team-analytics'
import { useMemberTrend } from '@/features/analytics/hooks/use-member-trend'
import { TeamAnalyticsOverview } from '@/features/analytics/components/TeamAnalyticsOverview'
import { MemberTrendChart } from '@/features/analytics/components/MemberTrendChart'
import {
  getTimeRange, getCurrentWeekRange, buildWeeklyChartData,
} from '@/features/analytics/utils/analytics.utils'

// Time range options
const RANGE_OPTIONS = [
  { label: '4 tuần gần nhất', value: '4' },
  { label: '8 tuần gần nhất', value: '8' },
  { label: '12 tuần gần nhất', value: '12' },
]

export const Route = createFileRoute('/_app/analytics')({
  head: () => ({
    meta: [{ title: 'Analytics — TekSpace' }],
  }),
  component: AnalyticsPage,
})

function AnalyticsPage() {
  const { user } = useAuthStore()
  const { activeTenantId } = useTenantStore()

  // Selected member for drill-down (userId)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [rangeWeeks, setRangeWeeks] = useState<number>(4)

  // Current week range for overview
  const { weekStart, weekEnd } = getCurrentWeekRange()
  const { startDate: trendStart, endDate: trendEnd } = getTimeRange(rangeWeeks)

  // ── Queries ──────────────────────────────────────────────────────────────

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

  const defaultCommittedHours = tenantSettings?.default_committed_hours ?? 40

  const { data: teamHours = [], isLoading: isTeamHoursLoading } = useTeamAnalytics(weekStart, weekEnd)

  const selectedMember = members.find(m => m.user_id === selectedUserId) ?? null
  const selectedMemberCommitted = selectedMember?.committed_hours ?? defaultCommittedHours

  const { data: memberTrend = [], isLoading: isTrendLoading } = useMemberTrend(
    selectedUserId,
    trendStart,
    trendEnd,
  )

  // Build hoursMap for team overview
  const hoursMap = new Map(teamHours.map(r => [r.userId, r.totalHours]))

  // Build chart data
  const chartData = selectedUserId
    ? buildWeeklyChartData(memberTrend, trendStart, trendEnd, selectedMemberCommitted)
    : []

  // Permission check — chỉ manager/owner
  const myMember = members.find(m => m.user_id === user?.id)
  const canViewTeamAnalytics = myMember?.role === 'owner' || myMember?.role === 'manager'

  const isLoading = isMembersLoading || isSettingsLoading

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!canViewTeamAnalytics) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <BarChart3 className="text-muted-foreground mb-4 h-12 w-12" />
        <h1 className="text-xl font-semibold">Không có quyền truy cập</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Chỉ Manager và Owner mới xem được analytics của team.
        </p>
      </div>
    )
  }

  const selectedMemberName = selectedMember
    ? selectedMember.users.full_name || selectedMember.users.email?.split('@')[0] || 'Member'
    : null

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BarChart3 className="size-5 text-muted-foreground shrink-0" />
        <h1 className="text-lg font-semibold">Analytics</h1>
        <span className="text-xs text-muted-foreground ml-1">
          Tuần {format(new Date(weekStart), 'dd/MM')}–{format(new Date(weekEnd), 'dd/MM/yyyy')}
        </span>
      </div>

      {/* Team Overview — AC1 */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Team Overview — Tuần này
        </h2>
        <TeamAnalyticsOverview
          members={members}
          hoursMap={hoursMap}
          defaultCommittedHours={defaultCommittedHours}
          isLoading={isTeamHoursLoading}
          selectedUserId={selectedUserId}
          onSelectMember={(memberId, userId) => {
            setSelectedMemberId(memberId)
            setSelectedUserId(userId)
          }}
        />
        <p className="text-xs text-muted-foreground mt-2">
          Click vào thành viên để xem trend theo thời gian.
        </p>
      </section>

      {/* Per-Member Drill-down — AC2 */}
      {selectedUserId && selectedMemberName && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Trend — {selectedMemberName}
            </h2>
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
          <MemberTrendChart
            memberName={selectedMemberName}
            chartData={chartData}
            committedHoursPerWeek={selectedMemberCommitted}
            isLoading={isTrendLoading}
          />
        </section>
      )}
    </div>
  )
}
```

---

## Architecture & Pattern Compliance

### Service Layer Pattern (PHẢI tuân theo)

```
analytics.tsx route
      ↓
useTeamAnalytics() / useMemberTrend()  ← React Query useQuery
      ↓
AnalyticsService.getTeamHoursForPeriod() / getMemberWeeklyHours()  ← Supabase client
      ↓
daily_reports table (RLS: manager thấy tất cả)
```

- **KHÔNG** gọi service trực tiếp từ component
- **KHÔNG** tạo Supabase client mới — `import { supabase } from '@/lib/supabase-browser'`
- **KHÔNG** barrel exports — import trực tiếp từ file

### RLS Facts (verified via MCP)

| Table | Policy | Access |
|-------|--------|--------|
| `daily_reports` SELECT | `daily_reports_select_policy` | `(tenant_id = current_tenant_id()) AND (user_id = auth.uid() OR is_tenant_manager())` |
| `tenant_members` SELECT | existing | manager/owner thấy tất cả members |
| `tenants` SELECT | existing | manager/owner thấy tenant settings |

→ Manager/Owner có thể query `daily_reports` của cả tenant. Không cần RPC hay service-role bypass.

### Naming Conventions

- Service: `AnalyticsService` (class-style namespace, consistent với `DailyReportService`, `DashboardService`)
- Hook: `use-team-analytics.ts`, `use-member-trend.ts` (kebab-case file)
- Component: `TeamAnalyticsOverview.tsx`, `MemberTrendChart.tsx` (PascalCase)
- Utils: `analytics.utils.ts` (kebab-case)
- Query keys: `[QUERY_KEYS.analytics, 'team-overview', tenantId, weekStart]` — namespace by sub-type

### Existing Utilities — PHẢI REUSE (không duplicate)

```typescript
// dashboard.utils.ts — ĐỪNG tạo lại
import { calcCommitmentRate } from '@/features/dashboard/utils/dashboard.utils'
// Dùng cho team overview table row

// tenant.service.ts — ĐỪNG tạo lại
import { getTenantSettings, getMembers } from '@/features/tenant/services/tenant.service'

// hooks đã có — ĐỪNG tạo lại
import { useTenantMembers } from '@/features/tenant/hooks/use-tenant-members'
```

### Feature Folder Structure

```
src/features/analytics/
  services/
    analytics.service.ts       ← NEW
  hooks/
    use-team-analytics.ts      ← NEW
    use-member-trend.ts        ← NEW
  components/
    TeamAnalyticsOverview.tsx  ← NEW
    MemberTrendChart.tsx       ← NEW
  utils/
    analytics.utils.ts         ← NEW
```

---

## DB Schema (verified via MCP)

### `daily_reports` (relevant columns)

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | uuid | NO | PK |
| `tenant_id` | uuid | NO | RLS filter |
| `user_id` | uuid | NO | join với members |
| `report_date` | date | NO | filter by period |
| `hours_logged` | numeric | NO | default 0 — SUM này |
| `is_late` | boolean | NO | không ảnh hưởng analytics |
| `submitted_at` | timestamptz | NO | — |

**Note quan trọng:** `daily_reports` KHÔNG có separate "status" field. Mọi record trong bảng đều là "submitted". AC3 note "chỉ reports có status submitted" — nghĩa là mọi row đều count. Không cần filter thêm.

### `tenant_members` (relevant columns)

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `committed_hours` | smallint | YES | NULL → fallback `tenants.default_committed_hours` |

### Committed Hours Logic (từ Story 5.1)

```typescript
effectiveCommittedHours(member) =
  member.committed_hours ?? tenant.default_committed_hours
```

---

## Previous Story Intelligence (Story 5.1)

### Files đã tạo trong 5.1 (không touch trừ khi cần)

| File | Notes |
|------|-------|
| `src/features/tenant/hooks/use-update-member-committed-hours.ts` | Mutation hook |
| `src/features/tenant/components/SetCommittedHoursDialog.tsx` | Dialog |
| `src/routes/_app/analytics.tsx` | **Placeholder → Story này thay thế** |
| `src/features/tenant/services/tenant.service.ts` | Đã có `updateMemberCommittedHours()` + `getTenantSettings()` |
| `src/features/tenant/components/MemberList.tsx` | Đã có `defaultCommittedHours` prop + committed display |

### Learnings từ 5.1

- `updateMemberCommittedHours()` signature: `(memberId: string, tenantId: string, committedHours: number | null)` — khác với story spec ban đầu, đã có thêm `tenantId` parameter
- `QUERY_KEYS.analytics = 'analytics'` đã có trong `query-keys.ts`
- pgTAP test file hiện có: `supabase/tests/rls_policies.test.sql` (62 tests)
- Commit format: `feat(5-2): ...`

---

## Git Context (Recent Commits)

```
e2df99f chore(5-1): code review fixes — committed hours configuration
93577cf feat(3-2): realtime who-is-online & timezone view + code review fixes
32cf6aa feat(3-1): team overview dashboard + code review fixes
```

**Patterns từ recent work:**
- Route components import hooks trực tiếp (không wrapper)
- `staleTime: 2 * 60_000` (2 phút) cho analytics data, `5 * 60_000` cho settings
- Skeleton loading trong cùng component (không separate loading page)
- `usePermissions()` pattern từ `src/lib/permissions.ts` cho role check — nhưng trong analytics chỉ cần check `myMember.role` trực tiếp vì đã query members
- `format(date, 'dd/MM')` từ date-fns cho week labels

---

## Anti-Pattern Prevention

| ❌ ĐỪNG làm | ✅ NÊN làm |
|------------|-----------|
| Tạo Supabase RPC mới cho aggregation | Client-side aggregation (data volume nhỏ) |
| Import Recharts trực tiếp mà không check ShadCN chart | Check `src/components/ui/chart.tsx`, install nếu chưa có |
| Tạo migration cho analytics | Không cần — chỉ đọc data hiện có |
| Dùng chart library khác (Chart.js, ApexCharts) | Recharts qua ShadCN chart component |
| Tạo lại `calcCommitmentRate` | Import từ `@/features/dashboard/utils/dashboard.utils` |
| Tạo lại `useTenantMembers` hook | Import từ `@/features/tenant/hooks/use-tenant-members` |
| Tạo `index.ts` barrel export | Import trực tiếp từ file |
| Route-level fetch (loader) | Dùng React Query hooks trong component |
| Query `daily_reports` với `.eq('status', 'submitted')` | Không có status field — mọi row đều là submitted |
| Hard-code week labels (VD: "Tuần 1") | Dùng `date-fns format(date, 'dd/MM')` từ actual dates |

---

## Files to Create / Modify

### Tạo mới (nếu chưa có)

| File | Purpose |
|------|---------|
| `src/components/ui/chart.tsx` | ShadCN chart component (`npx shadcn@latest add chart`) |
| `src/features/analytics/services/analytics.service.ts` | Data fetching service |
| `src/features/analytics/hooks/use-team-analytics.ts` | Team overview query hook |
| `src/features/analytics/hooks/use-member-trend.ts` | Member trend query hook |
| `src/features/analytics/components/TeamAnalyticsOverview.tsx` | Team overview table |
| `src/features/analytics/components/MemberTrendChart.tsx` | Per-member trend chart |
| `src/features/analytics/utils/analytics.utils.ts` | Date/calc utilities |

### Chỉnh sửa

| File | Thay đổi |
|------|---------|
| `src/routes/_app/analytics.tsx` | **Thay thế hoàn toàn** placeholder với full page implementation |

### KHÔNG cần chỉnh sửa

| File | Lý do |
|------|-------|
| `supabase/migrations/` | Không cần migration mới |
| `src/lib/query-keys.ts` | `QUERY_KEYS.analytics` đã có |
| `src/lib/routes.ts` | Route đã có |
| `src/features/tenant/services/tenant.service.ts` | Service đủ dùng |
| `src/features/tenant/hooks/use-tenant-members.ts` | Hook đủ dùng |
| `src/features/dashboard/utils/dashboard.utils.ts` | Utilities đủ dùng (reuse) |

---

## Testing Requirements

### pgTAP Test

Không cần test migration mới. Story này là **read-only** — RLS policy `daily_reports_select_policy` đã được test từ Story 4.1+. Không cần thêm pgTAP test.

**Chạy verify toàn bộ test suite trước khi mark done:**
```bash
npx supabase test db
```
Tất cả phải pass (62 hiện tại).

### TypeScript Check
```bash
npx tsc --noEmit
```
0 lỗi.

### Manual Test Checklist

1. **Team Overview** — Login là Manager → `/analytics` → bảng hiện members với committed/actual/rate cho tuần này
2. **Visual Indicator** — Member có rate < 70% → text màu đỏ; 70-84% → amber; >= 85% → default
3. **Click drill-down** — Click vào member → chart area hiện bên dưới với trend 4 tuần
4. **Time range switch** — Đổi range sang 8/12 tuần → chart cập nhật đúng tuần
5. **Member không có report** — Tuần không có report → hiển thị 0h trong chart (không crash)
6. **Permission** — Login là member (role='member') → thấy "Không có quyền truy cập" message
7. **Loading state** — Skeleton hiện khi đang fetch

---

## Notes / Clarifications

- **Story 5.3 (member self-analytics)** sẽ implement trang analytics của member riêng — story này chỉ là manager view. Không cần tích hợp member view vào trang này.
- **Actual hours calculation** (AC3): Epics nói "chỉ reports có status submitted" — trong DB không có status field riêng, mọi record = submitted. Không cần filter gì thêm.
- **committed hours cho drill-down**: Dùng giá trị tại thời điểm hiện tại, không lưu historical committed hours per week (out of scope).
- **ShadCN chart vs bare Recharts**: Story yêu cầu "ShadcnUI chart component". Nếu `chart.tsx` chưa tồn tại sau `npx shadcn@latest add chart`, hãy dùng bare Recharts như trong task 6 (vẫn đúng requirement về library).

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-5 (2026-03-25)

### Debug Log References

- Task 0: `npx shadcn@latest add chart` — installed `src/components/ui/chart.tsx`, skipped existing `card.tsx`
- Service refactored: split `getMemberWeeklyHours` into `getMemberReportsForPeriod` + client-side `groupReportsByWeek` util để separation of concerns tốt hơn
- `useMemberTrend` hook gọi service → groupReportsByWeek → trả về `WeeklyHoursRow[]`
- `MemberTrendChart` dùng `ChartContainer/ChartTooltipContent/ChartLegend` từ ShadCN chart.tsx
- TypeScript: 0 errors; Vitest: 251/251 pass; pgTAP: 63/63 pass

### Completion Notes List

- ✅ Task 0: ShadCN chart component installed (`src/components/ui/chart.tsx`)
- ✅ Task 1: `AnalyticsService` tạo với `getTeamHoursForPeriod` + `getMemberReportsForPeriod` (client-side aggregation, không cần migration)
- ✅ Task 2: `useTeamAnalytics` hook — query team hours cho current week
- ✅ Task 3: `useMemberTrend` hook — query + aggregate weekly hours cho selected member
- ✅ Task 4: `analytics.utils.ts` — `groupReportsByWeek`, `buildWeeklyChartData`, `calcAvgCommitmentRate`, `formatRate`, `getCommitmentRateColorClass`, `getCurrentWeekRange`, `getTimeRange`
- ✅ Task 5: `TeamAnalyticsOverview` — bảng với 4 cột, color indicators, click-to-select, keyboard accessible
- ✅ Task 6: `MemberTrendChart` — ShadCN `ChartContainer` + Recharts `BarChart`, avg rate header, empty state
- ✅ Task 7: `analytics.tsx` route — full page, permission gate (AC6), team overview (AC1), drill-down + range select (AC2)
- ✅ Tests: 35 unit tests cho analytics.utils, toàn bộ 251 Vitest + 63 pgTAP pass
- ✅ `calcCommitmentRate` reused từ `dashboard.utils.ts` (không duplicate)
- ✅ Toggle behavior: click lại member đang selected → deselect

### File List

- `src/components/ui/chart.tsx` (NEW — installed by shadcn)
- `src/features/analytics/services/analytics.service.ts` (NEW)
- `src/features/analytics/hooks/use-team-analytics.ts` (NEW)
- `src/features/analytics/hooks/use-member-trend.ts` (NEW)
- `src/features/analytics/utils/analytics.utils.ts` (NEW)
- `src/features/analytics/components/TeamAnalyticsOverview.tsx` (NEW)
- `src/features/analytics/components/MemberTrendChart.tsx` (NEW)
- `src/features/analytics/__tests__/analytics.test.ts` (NEW)
- `src/routes/_app/analytics.tsx` (MODIFIED — replaced placeholder with full implementation)
