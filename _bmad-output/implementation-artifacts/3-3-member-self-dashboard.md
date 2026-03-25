# Story 3.3: Member Self-Dashboard

**Status:** review
**Epic:** 3 — Team Visibility & Self-Dashboard
**Story ID:** 3.3
**Story Key:** 3-3-member-self-dashboard
**Created:** 2026-03-25

---

## Story

As a member,
I want to view my own schedule, hours, commitment rate, and see how I compare anonymously to the team,
So that I can self-assess and proactively adjust my effort without waiting for manager feedback.

---

## Acceptance Criteria

### AC1 — Hiển thị lịch tuần hiện tại của member

**Given** member truy cập `/my-dashboard`
**When** page load
**Then** hiển thị heatmap lịch làm việc tuần hiện tại của chính member
**And** không có week navigation — chỉ hiển thị current week

### AC2 — Hiển thị total hours + commitment rate

**Given** member xem My Dashboard
**When** page load
**Then** hiển thị actual hours logged tuần này (SUM `hours_logged` từ `daily_reports` trong tuần hiện tại)
**And** hiển thị committed hours = `tenant_members.committed_hours ?? tenants.default_committed_hours`
**And** hiển thị commitment rate: `actual / committed × 100%`, format: `"22h / 35h = 63%"`

### AC3 — Không có negative framing

**Given** actual hours < committed hours
**When** hiển thị commitment rate
**Then** chỉ hiển thị data trung thực — không có warning badge, màu đỏ nổi bật, hay negative wording

### AC4 — Anonymous comparison khi team ≥ 4 active members

**Given** tenant có ≥ 4 active members
**When** member xem My Dashboard
**Then** hiển thị team average commitment rate tuần này
**And** server trả về CHỈ aggregate data (jsonb: `{ member_count, avg_rate }`) — không expose individual records
**And** member thấy mình đang ở đâu so với team average (ví dụ: "Bạn: 63% | Trung bình nhóm: 75%")

### AC5 — Ẩn anonymous comparison khi team < 4 active members

**Given** tenant có < 4 active members
**When** member xem My Dashboard
**Then** phần anonymous comparison bị ẩn hoàn toàn — không hiển thị partial data

---

## Tasks / Subtasks

- [x] **Task 1: DB Migration — RPC `get_team_avg_commitment_rate`** (AC4, AC5)
  - [x] Tạo `supabase/migrations/20260325000005_get_team_avg_commitment_rate.sql`
  - [x] SECURITY DEFINER SET search_path = '' (bắt buộc — member RLS chặn đọc daily_reports của người khác)
  - [x] Returns jsonb: `{ "member_count": int, "avg_rate": float | null }`
  - [x] GRANT EXECUTE TO authenticated
  - [x] Apply: `npx supabase db push --local`

- [x] **Task 2: Thêm service methods** (AC2, AC4)
  - [x] Thêm `getSelfWeekHours(tenantId, userId, weekStart, weekEnd)` vào `DailyReportService`
  - [x] Thêm `getDefaultCommittedHours(tenantId)` vào `DashboardService`

- [x] **Task 3: Tạo 2 hooks mới** (AC2, AC4)
  - [x] `src/features/dashboard/hooks/use-self-week-hours.ts`
  - [x] `src/features/dashboard/hooks/use-team-avg-commitment.ts`

- [x] **Task 4: Tạo `SelfDashboard.tsx`** (AC1–AC5)
  - [x] Reuse `TeamScheduleHeatmap` với mySlots + [myMemberObj]
  - [x] Reuse `TimezoneSelector` từ `@/features/settings/components/TimezoneSelector`
  - [x] Stats cards: actual hours, committed hours, commitment rate (AC2, AC3)
  - [x] Team comparison panel — chỉ render khi `member_count >= 4` (AC4, AC5)
  - [x] Thêm 2 pure functions vào `dashboard.utils.ts`: `calcCommitmentRate`, `formatCommitmentRate`

- [x] **Task 5: Route + navigation** (accessibility)
  - [x] Tạo `src/routes/_app/my-dashboard.tsx`
  - [x] Cập nhật `src/lib/routes.ts`: thêm `myDashboard: '/my-dashboard'`
  - [x] Cập nhật `src/lib/query-keys.ts`: thêm `selfWeekHours`, `teamAvgCommitment`
  - [x] Cập nhật `src/components/layout/data/sidebar-data.ts`: thêm "My Dashboard" nav item

- [x] **Task 6: Tests** (AC2, AC3, AC4, AC5)
  - [x] Tạo `src/features/dashboard/__tests__/self-dashboard.test.ts`
  - [x] Test `calcCommitmentRate` + `formatCommitmentRate` pure functions
  - [x] Test anonymous comparison visibility logic (`>= 4` vs `< 4`)
  - [x] `npx supabase test db` — xác nhận RPC function hoạt động

---

## Dev Notes

### Kiến trúc tổng quan

Story 3.3 tạo **mới** trang `/my-dashboard` (`SelfDashboard`) — **KHÔNG sửa** `TeamDashboard`.
1 DB migration mới (RPC function). Accessible bởi **ALL roles** (member/manager/owner) — không cần role guard.
Toàn bộ "anonymous comparison" là server-side aggregate — client chỉ nhận jsonb `{ member_count, avg_rate }`.

### ⚠️ Files tạo mới vs modify

```
TẠO MỚI:
supabase/migrations/20260325_get_team_avg_commitment_rate.sql
src/routes/_app/my-dashboard.tsx
src/features/dashboard/components/SelfDashboard.tsx
src/features/dashboard/hooks/use-self-week-hours.ts
src/features/dashboard/hooks/use-team-avg-commitment.ts
src/features/dashboard/__tests__/self-dashboard.test.ts

MODIFY (chỉ thêm, không xóa gì):
src/features/daily-report/services/daily-report.service.ts   ← thêm getSelfWeekHours()
src/features/dashboard/services/dashboard.service.ts         ← thêm getDefaultCommittedHours()
src/features/dashboard/utils/dashboard.utils.ts              ← thêm 2 pure functions
src/lib/routes.ts                                            ← thêm myDashboard
src/lib/query-keys.ts                                        ← thêm 2 keys
src/components/layout/data/sidebar-data.ts                   ← thêm nav item

KHÔNG CHẠM:
src/features/dashboard/components/TeamDashboard.tsx          ← không sửa
src/features/dashboard/hooks/use-team-week-slots.ts          ← không sửa
src/features/dashboard/__tests__/dashboard.test.ts           ← không sửa (57 tests cũ)
```

---

### Task 1 — Migration SQL chi tiết

```sql
-- File: supabase/migrations/20260325_get_team_avg_commitment_rate.sql
-- RPC trả về team average commitment rate (server-side aggregate — không expose individual data)
-- SECURITY DEFINER bắt buộc: member RLS chỉ cho đọc user_id = auth.uid() trong daily_reports,
-- nhưng function cần đọc toàn bộ team để tính aggregate.

CREATE OR REPLACE FUNCTION public.get_team_avg_commitment_rate(
  p_week_start date,
  p_week_end date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid;
  v_member_count integer;
  v_avg_rate numeric;
BEGIN
  v_tenant_id := public.current_tenant_id();

  SELECT
    COUNT(DISTINCT tm.user_id)::integer,
    AVG(
      COALESCE(dr.actual_hours, 0)::numeric /
      NULLIF(
        COALESCE(tm.committed_hours::numeric, t.default_committed_hours::numeric, 40),
        0
      )
    )
  INTO v_member_count, v_avg_rate
  FROM public.tenant_members tm
  JOIN public.tenants t ON t.id = tm.tenant_id AND t.id = v_tenant_id
  LEFT JOIN (
    SELECT user_id, SUM(hours_logged) AS actual_hours
    FROM public.daily_reports
    WHERE tenant_id = v_tenant_id
      AND report_date BETWEEN p_week_start AND p_week_end
    GROUP BY user_id
  ) dr ON dr.user_id = tm.user_id
  WHERE tm.tenant_id = v_tenant_id
    AND tm.status = 'active';

  RETURN jsonb_build_object(
    'member_count', COALESCE(v_member_count, 0),
    'avg_rate',     v_avg_rate   -- NULL nếu không ai có committed_hours > 0
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_avg_commitment_rate(date, date) TO authenticated;
```

> ⚠️ Checklist RLS bắt buộc cho migration:
> - [x] Không `ALTER TABLE` (function only — không cần RLS trên function)
> - [x] `SECURITY DEFINER SET search_path = ''` — đúng pattern bắt buộc
> - [x] Tenant isolation: dùng `public.current_tenant_id()` internally
> - [x] Không trả về individual records — chỉ jsonb aggregate

---

### Task 2 — Service methods

#### DailyReportService.getSelfWeekHours (thêm vào cuối object)

```typescript
// src/features/daily-report/services/daily-report.service.ts

getSelfWeekHours: async (
  tenantId: string,
  userId: string,
  weekStart: string,  // 'yyyy-MM-dd' (Monday)
  weekEnd: string,    // 'yyyy-MM-dd' (Sunday)
): Promise<number> => {
  const { data, error } = await supabase
    .from('daily_reports')
    .select('hours_logged')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .gte('report_date', weekStart)
    .lte('report_date', weekEnd)
  if (error) throw error
  return (data ?? []).reduce((sum, r) => sum + Number(r.hours_logged), 0)
},
```

#### DashboardService.getDefaultCommittedHours (thêm vào cuối object)

```typescript
// src/features/dashboard/services/dashboard.service.ts

getDefaultCommittedHours: async (tenantId: string): Promise<number> => {
  const { data, error } = await supabase
    .from('tenants')
    .select('default_committed_hours')
    .eq('id', tenantId)
    .single()
  if (error) throw error
  return data.default_committed_hours ?? 40
},
```

> Không có hook riêng cho `getDefaultCommittedHours` — gọi trực tiếp trong `SelfDashboard` qua `useQuery` hoặc inline vào `useSelfWeekHours`.
> Pattern đơn giản nhất: 1 `useQuery` với key `[QUERY_KEYS.teamAvgCommitment, activeTenantId, 'default-hours']`.

---

### Task 3 — Hooks

```typescript
// src/features/dashboard/hooks/use-self-week-hours.ts
import { useQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/lib/query-keys'
import { DailyReportService } from '@/features/daily-report/services/daily-report.service'

export function useSelfWeekHours(
  tenantId: string | null,
  userId: string | null,
  weekStart: string,
  weekEnd: string,
) {
  return useQuery({
    queryKey: [QUERY_KEYS.selfWeekHours, tenantId, userId, weekStart],
    queryFn: () => DailyReportService.getSelfWeekHours(tenantId!, userId!, weekStart, weekEnd),
    enabled: !!tenantId && !!userId && !!weekStart,
    staleTime: 60_000,
  })
}
```

```typescript
// src/features/dashboard/hooks/use-team-avg-commitment.ts
import { useQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/lib/query-keys'
import { supabase } from '@/lib/supabase-browser'
import { useTenantStore } from '@/stores/tenant-store'

type TeamAvgResult = { member_count: number; avg_rate: number | null }

export function useTeamAvgCommitment(weekStart: string, weekEnd: string) {
  const { activeTenantId } = useTenantStore()
  return useQuery({
    queryKey: [QUERY_KEYS.teamAvgCommitment, activeTenantId, weekStart],
    queryFn: async (): Promise<TeamAvgResult> => {
      const { data, error } = await supabase.rpc('get_team_avg_commitment_rate', {
        p_week_start: weekStart,
        p_week_end: weekEnd,
      })
      if (error) throw error
      return data as TeamAvgResult
    },
    enabled: !!activeTenantId && !!weekStart,
    staleTime: 5 * 60_000,
  })
}
```

---

### Task 4 — SelfDashboard.tsx chi tiết

#### Week calculation (date-fns — đã install)

```typescript
import { format, startOfISOWeek, endOfISOWeek } from 'date-fns'

const today = new Date()
const currentWeekOf = format(startOfISOWeek(today), 'yyyy-MM-dd')  // Monday
const weekStart = currentWeekOf
const weekEnd = format(endOfISOWeek(today), 'yyyy-MM-dd')           // Sunday
```

> `startOfISOWeek` = Monday — chuẩn nhất quán với `useScheduleWeek` và `DashboardService.getTeamWeekSlots`.

#### Data fetching pattern

```typescript
const { user } = useAuthStore()
const { activeTenantId } = useTenantStore()

// My schedule (reuse hooks từ schedule feature)
const { data: scheduleWeek } = useScheduleWeek(currentWeekOf)
const { data: mySlots = [], isLoading: isSlotsLoading } = useScheduleSlots(scheduleWeek?.id)

// My hours this week
const { data: actualHours = 0 } = useSelfWeekHours(
  activeTenantId, user?.id ?? null, weekStart, weekEnd
)

// My committed hours — từ useTenantMembers (đã có)
const { data: members = [] } = useTenantMembers()
const myMember = members.find(m => m.user_id === user?.id)

// Default committed hours (fallback khi myMember.committed_hours === null)
const { data: defaultHours = 40 } = useQuery({
  queryKey: ['tenant-default-hours', activeTenantId],
  queryFn: () => DashboardService.getDefaultCommittedHours(activeTenantId!),
  enabled: !!activeTenantId && myMember?.committed_hours == null,
  staleTime: 10 * 60_000,
})

const committedHours = myMember?.committed_hours ?? defaultHours

// Team average (anonymous comparison)
const { data: teamAvg } = useTeamAvgCommitment(weekStart, weekEnd)
const showComparison = (teamAvg?.member_count ?? 0) >= 4

// Timezone
const [viewTimezone, setViewTimezone] = useState<string | null>(null)
// userProfile — reuse useQuery với key QUERY_KEYS.userProfile nếu đã cache từ layout
const displayTimezone = viewTimezone ?? userProfile?.timezone ?? 'UTC'
```

#### Committed hours fallback chain (QUAN TRỌNG)

```
tenant_members.committed_hours   → nullable smallint
  ↓ null
tenants.default_committed_hours  → smallint (via DashboardService.getDefaultCommittedHours)
  ↓ null (không nên xảy ra nhưng guard)
40                                → hardcode fallback
```

#### Pure functions trong dashboard.utils.ts (thêm vào cuối)

```typescript
// Tính commitment rate — trả về null nếu committed = 0 (tránh /0)
export function calcCommitmentRate(actualHours: number, committedHours: number): number | null {
  if (committedHours <= 0) return null
  return actualHours / committedHours
}

// Format: "22h / 35h = 63%" hoặc "10h" nếu committed = 0
export function formatCommitmentRate(actual: number, committed: number): string {
  const rate = calcCommitmentRate(actual, committed)
  if (rate === null) return `${actual}h`
  return `${actual}h / ${committed}h = ${Math.round(rate * 100)}%`
}
```

#### TeamScheduleHeatmap — props interface (đã verify)

```typescript
// Props của TeamScheduleHeatmap (src/features/dashboard/components/TeamScheduleHeatmap.tsx):
interface TeamScheduleHeatmapProps {
  members: TenantMemberWithUser[]  // truyền [myMemberObj] — chỉ 1 member
  slots: ScheduleSlot[]            // truyền mySlots
  weekOf: string                   // currentWeekOf (Monday ISO)
  displayTimezone: string
}
```

> Truyền `members = myMember ? [myMember] : []` — heatmap tự render đúng cho 1 member.
> Nếu `myMember` chưa load → `members = []` → heatmap render empty state gracefully.

#### Thứ tự render trong SelfDashboard

```
1. Header row (1 dòng):
   [User icon + "My Dashboard"]  ←left       [timezone dropdown] →right

2. Stats row (3 cards ngang):
   [Actual Hours]  [Committed Hours]  [Commitment Rate]
   "22h"           "35h"              "22h / 35h = 63%"
   (neutral styling — AC3: không negative framing, không red color)

3. My Schedule Heatmap
   <TeamScheduleHeatmap members={myMember ? [myMember] : []} slots={mySlots} ... />

4. Team Comparison Panel (CHỈ khi showComparison = member_count >= 4)
   "Bạn: 63% | Trung bình nhóm: 75%"
   (neutral data display, không ranking hay judgment)
```

#### Route file pattern (từ dashboard.tsx)

```typescript
// src/routes/_app/my-dashboard.tsx
import { createFileRoute } from '@tanstack/react-router'
import { SelfDashboard } from '@/features/dashboard/components/SelfDashboard'

export const Route = createFileRoute('/_app/my-dashboard')({
  head: () => ({
    meta: [{ title: 'My Dashboard — TekSpace' }],
  }),
  component: SelfDashboard,
})
```

---

### Task 5 — ROUTES + QUERY_KEYS + sidebar

```typescript
// src/lib/routes.ts — thêm vào app object
myDashboard: '/my-dashboard',
```

```typescript
// src/lib/query-keys.ts — thêm 2 keys
selfWeekHours: 'self-week-hours',
teamAvgCommitment: 'team-avg-commitment',
```

```typescript
// src/components/layout/data/sidebar-data.ts
// Thêm vào 'Overview' group (sau Dashboard item)
// Import thêm: import { User } from 'lucide-react'  (hoặc UserCircle)
{
  title: 'My Dashboard',
  url: '/my-dashboard',
  icon: User,
},
```

---

### Task 6 — Tests

```typescript
// src/features/dashboard/__tests__/self-dashboard.test.ts
import { describe, it, expect } from 'vitest'
import { calcCommitmentRate, formatCommitmentRate } from '../utils/dashboard.utils'

describe('calcCommitmentRate', () => {
  it('tính đúng rate < 1', () => expect(calcCommitmentRate(22, 35)).toBeCloseTo(0.6286, 3))
  it('trả về null khi committedHours = 0', () => expect(calcCommitmentRate(10, 0)).toBeNull())
  it('trả về null khi committedHours < 0', () => expect(calcCommitmentRate(10, -5)).toBeNull())
  it('100% khi actual === committed', () => expect(calcCommitmentRate(40, 40)).toBe(1))
  it('> 100% khi actual > committed (over-commit)', () => expect(calcCommitmentRate(50, 40)).toBeCloseTo(1.25))
  it('0 khi actual = 0', () => expect(calcCommitmentRate(0, 40)).toBe(0))
})

describe('formatCommitmentRate', () => {
  it('"22h / 35h = 63%"', () => expect(formatCommitmentRate(22, 35)).toBe('22h / 35h = 63%'))
  it('"40h / 40h = 100%"', () => expect(formatCommitmentRate(40, 40)).toBe('40h / 40h = 100%'))
  it('"10h" khi committed = 0', () => expect(formatCommitmentRate(10, 0)).toBe('10h'))
  it('0 actual: "0h / 35h = 0%"', () => expect(formatCommitmentRate(0, 35)).toBe('0h / 35h = 0%'))
})

describe('Anonymous comparison visibility', () => {
  it('ẩn khi member_count = 3', () => expect(3 >= 4).toBe(false))
  it('ẩn khi member_count = 1', () => expect(1 >= 4).toBe(false))
  it('hiển thị khi member_count = 4', () => expect(4 >= 4).toBe(true))
  it('hiển thị khi member_count = 10', () => expect(10 >= 4).toBe(true))
})
```

---

### Import conventions — bắt buộc

```typescript
// ✅ ĐÚNG
import { SelfDashboard } from '@/features/dashboard/components/SelfDashboard'
import { TeamScheduleHeatmap } from '../components/TeamScheduleHeatmap'  // relative trong dashboard feature
import { TimezoneSelector } from '@/features/settings/components/TimezoneSelector'
import { useSelfWeekHours } from '../hooks/use-self-week-hours'
import { useTeamAvgCommitment } from '../hooks/use-team-avg-commitment'
import { useScheduleWeek } from '@/features/schedule/hooks/use-schedule-week'
import { useScheduleSlots } from '@/features/schedule/hooks/use-schedule-slots'
import { useTenantMembers } from '@/features/tenant/hooks/use-tenant-members'
import { DashboardService } from '../services/dashboard.service'
import { DailyReportService } from '@/features/daily-report/services/daily-report.service'
import { useAuthStore } from '@/stores/auth-store'
import { useTenantStore } from '@/stores/tenant-store'
import { ROUTES } from '@/lib/routes'
import { QUERY_KEYS } from '@/lib/query-keys'
import { calcCommitmentRate, formatCommitmentRate } from '../utils/dashboard.utils'
import type { TenantMemberWithUser } from '@/features/tenant/services/tenant.service'

// ❌ SAI
import { createClient } from '@supabase/supabase-js'       // tạo client mới — cấm
import * from '@/features/dashboard'                        // barrel export — cấm
```

---

### Không cần migration nào khác

Chỉ 1 migration: RPC `get_team_avg_commitment_rate`.
Schema (`daily_reports`, `tenant_members`, `tenants`) đã đủ — không thêm cột hay bảng mới.
Không cần `npx supabase db reset` — chỉ `npx supabase db push --local`.

---

## Intelligence từ Story 3.2

### Patterns đã thiết lập (tuân theo đúng)

- `useScheduleWeek(weekOf)` + `useScheduleSlots(weekId)` — pattern đã proven, dùng lại hoàn toàn
- `TimezoneSelector` import từ `@/features/settings/components/TimezoneSelector` — không tạo mới
- `getInitials(name)` từ `'../utils/dashboard.utils'` — đã có
- Inline component pattern cho sub-components nhỏ (như `TeamDashboardSkeleton`, `OnlineNowPanel`)
- `useTenantMembers()` tự filter `status='active'` ở service layer → không cần filter lại
- `date-fns` + `date-fns-tz` đã install — dùng `format`, `startOfISOWeek`, `endOfISOWeek`
- `useState<string | null>(null)` cho timezone với `?? 'UTC'` fallback — pattern từ 3.2

### Codebase hiện tại (reference — đừng tạo lại)

```
src/features/dashboard/
├── services/dashboard.service.ts      ← thêm getDefaultCommittedHours()
├── hooks/use-team-week-slots.ts       ← không sửa
├── utils/dashboard.utils.ts           ← thêm 2 pure functions
├── components/
│   ├── TeamDashboard.tsx              ← không sửa
│   ├── TeamScheduleHeatmap.tsx        ← reuse (props đã verify: members, slots, weekOf, displayTimezone)
│   ├── MemberScheduleRow.tsx          ← không sửa
│   └── SelfDashboard.tsx              ← TẠO MỚI
├── hooks/
│   ├── use-self-week-hours.ts         ← TẠO MỚI
│   └── use-team-avg-commitment.ts     ← TẠO MỚI
└── __tests__/
    ├── dashboard.test.ts              ← không sửa (57 tests)
    └── self-dashboard.test.ts         ← TẠO MỚI
```

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

Không có blocking issues. DB migration applied cleanly. TypeScript 0 errors. Supabase DB tests (63) all pass.

### Completion Notes List

- **Task 1**: Migration `20260325000005_get_team_avg_commitment_rate.sql` — RPC SECURITY DEFINER, returns jsonb `{ member_count, avg_rate }`. Applied via `npx supabase db push --local`. Verified: `prosecdef=true`, GRANT authenticated confirmed via pg_proc.
- **Task 2**: `DailyReportService.getSelfWeekHours` — query `daily_reports` filtered by user + tenant + date range, sum client-side. `DashboardService.getDefaultCommittedHours` — query tenants table, returns `default_committed_hours ?? 40`.
- **Task 3**: `use-self-week-hours.ts` (staleTime 60s) + `use-team-avg-commitment.ts` (staleTime 5m, calls RPC, reads `activeTenantId` from `useTenantStore`).
- **Task 4**: `SelfDashboard.tsx` — header row (icon + title + timezone selector), 3 stats cards (actual / committed / rate), `TeamScheduleHeatmap` reuse với `members=[myMember]` + `slots=mySlots`, `TeamComparisonPanel` ẩn danh chỉ khi `member_count >= 4`. Pure functions `calcCommitmentRate` + `formatCommitmentRate` thêm vào `dashboard.utils.ts`.
- **Task 5**: Route `/_app/my-dashboard`, `ROUTES.app.myDashboard`, 2 QUERY_KEYS, sidebar item "My Dashboard" với icon `User`.
- **Task 6**: 22 tests mới trong `self-dashboard.test.ts` — `calcCommitmentRate` (7 cases), `formatCommitmentRate` (6 cases), visibility logic (6 cases), sum reduction logic (3 cases). Tất cả PASS.

**Full regression:** 216/216 tests pass. TypeScript: 0 errors. `npx supabase test db`: 63/63 pass.

### File List

**Tạo mới:**
- `supabase/migrations/20260325000005_get_team_avg_commitment_rate.sql`
- `src/routes/_app/my-dashboard.tsx`
- `src/features/dashboard/components/SelfDashboard.tsx`
- `src/features/dashboard/hooks/use-self-week-hours.ts`
- `src/features/dashboard/hooks/use-team-avg-commitment.ts`
- `src/features/dashboard/__tests__/self-dashboard.test.ts`

**Chỉnh sửa:**
- `src/features/daily-report/services/daily-report.service.ts` — thêm `getSelfWeekHours()`
- `src/features/dashboard/services/dashboard.service.ts` — thêm `getDefaultCommittedHours()`
- `src/features/dashboard/utils/dashboard.utils.ts` — thêm `calcCommitmentRate()`, `formatCommitmentRate()`
- `src/lib/routes.ts` — thêm `myDashboard: '/my-dashboard'`
- `src/lib/query-keys.ts` — thêm `selfWeekHours`, `teamAvgCommitment`
- `src/components/layout/data/sidebar-data.ts` — thêm nav item "My Dashboard", import `User`
