# Story 8.5: Committed Hours History

Status: review
Epic: 8 — UX Polish & Feature Completeness
Story ID: 8.5
Story Key: 8-5-committed-hours-history
Created: 2026-03-25

---

## Story

As a Manager or Owner,
I want committed hours changes to be tracked historically per member,
So that analytics trend charts use the correct committed hours value for each past week instead of always applying the current value.

---

## Acceptance Criteria

**Given** DB chưa có `committed_hours_history` table
**When** migration được apply
**Then** table tồn tại với đúng schema
**And** tất cả members hiện tại có ít nhất 1 record với `effective_to = NULL` (current record)
**And** `npx supabase test db` PASS

**Given** Manager thay đổi committed hours cho một member (qua `SetCommittedHoursDialog`)
**When** save thành công
**Then** record cũ trong `committed_hours_history` được close: `effective_to = today`
**And** record mới được INSERT với `effective_from = today`, `effective_to = NULL`, `set_by = auth.uid()`
**And** `tenant_members.committed_hours` vẫn được cập nhật như cũ (dùng cho current week lookup)
**And** toast "Đã cập nhật giờ cam kết" xuất hiện

**Given** Analytics trend chart tính commitment rate theo tuần
**When** chart data được build cho N tuần gần nhất
**Then** mỗi tuần dùng giá trị `committed_hours` có hiệu lực tại thời điểm `week_start` của tuần đó
**And** lookup logic: `effective_from <= week_start AND (effective_to IS NULL OR effective_to > week_start)`
**And** fallback: nếu không có record history → dùng `tenant_members.committed_hours` hoặc `tenants.default_committed_hours`

**Given** Member xem Self Analytics (`SelfAnalyticsHistory`)
**When** chart render
**Then** mỗi tuần trong chart cũng dùng committed hours lịch sử đúng (không phải giá trị hiện tại)

---

## Tasks / Subtasks

- [x] **Task 1:** Tạo migration `committed_hours_history`
  - [x] 1.1 Tạo file migration SQL với schema, index, RLS policies, seed data
  - [x] 1.2 Apply migration: `npx supabase db push --local`
  - [x] 1.3 Verify table tồn tại và seed data đúng (MCP query — 5 records)
  - [x] 1.4 Run `npx supabase test db` — tất cả PASS (73 tests)

- [x] **Task 2:** Cập nhật `updateMemberCommittedHours` trong `tenant.service.ts`
  - [x] 2.1 Thêm logic fetch user_id trước khi update
  - [x] 2.2 Close record lịch sử cũ (`effective_to = today`)
  - [x] 2.3 INSERT record mới nếu committedHours có giá trị

- [x] **Task 3:** Thêm `getMemberCommittedHoursHistory` vào `AnalyticsService`
  - [x] 3.1 Thêm method mới vào object AnalyticsService trong `analytics.service.ts`

- [x] **Task 4:** Cập nhật `analytics.utils.ts`
  - [x] 4.1 Thêm `getCommittedHoursAtDate` helper function
  - [x] 4.2 Cập nhật `buildWeeklyChartData` — thêm 2 tham số mới (history + fallback), dùng lookup per-week

- [x] **Task 5:** Cập nhật `useMemberTrend` hook
  - [x] 5.1 Thêm types `CommittedHoursHistoryRow`, `MemberTrendData`
  - [x] 5.2 Đổi queryFn dùng `Promise.all`, return `MemberTrendData`

- [x] **Task 6:** Cập nhật callers
  - [x] 6.1 `analytics.tsx` — destructure `trendData`, cập nhật `buildWeeklyChartData` call
  - [x] 6.2 `SelfAnalyticsHistory.tsx` — destructure `analyticsData`, cập nhật `buildWeeklyChartData` call

- [x] **Task 7:** Cập nhật unit tests
  - [x] 7.1 Fix tất cả `buildWeeklyChartData` calls trong `analytics.test.ts` (thêm arg)
  - [x] 7.2 Fix tất cả `buildWeeklyChartData` calls trong `self-analytics.test.ts` (thêm arg)
  - [x] 7.3 Thêm tests cho `getCommittedHoursAtDate`
  - [x] 7.4 Run full test suite — 277 tests PASS

---

## Dev Agent Record

### Implementation Plan

Theo story: Migration → Service (tenant) → Service (analytics) → Utils → Hook → Callers → Tests

### Debug Log

_(sẽ cập nhật khi có vấn đề)_

### Completion Notes

Implementation hoàn thành theo đúng spec. Điểm đáng lưu ý:
- `useSelfAnalytics` cũng cần cập nhật tương tự `useMemberTrend` (đổi return type → `SelfAnalyticsData`) — xem File List.
- `SelfAnalyticsHistory.tsx` gọi `useSelfAnalytics` nhưng hook này chưa được update trong story spec — đã update để match pattern mới.

---

## File List

- `supabase/migrations/20260325000010_create_committed_hours_history.sql` — **NEW**
- `src/features/tenant/services/tenant.service.ts` — **MODIFIED** (`updateMemberCommittedHours`)
- `src/features/analytics/services/analytics.service.ts` — **MODIFIED** (type `CommittedHoursHistoryRow`, method `getMemberCommittedHoursHistory`)
- `src/features/analytics/utils/analytics.utils.ts` — **MODIFIED** (`getCommittedHoursAtDate`, `buildWeeklyChartData` signature)
- `src/features/analytics/hooks/use-member-trend.ts` — **MODIFIED** (type `MemberTrendData`, parallel fetch)
- `src/routes/_app/analytics.tsx` — **MODIFIED** (destructure `trendData`, updated `buildWeeklyChartData` call)
- `src/features/analytics/components/SelfAnalyticsHistory.tsx` — **MODIFIED** (destructure `analyticsData`, updated call)
- `src/features/analytics/__tests__/analytics.test.ts` — **MODIFIED** (fix calls + new `getCommittedHoursAtDate` tests)
- `src/features/analytics/__tests__/self-analytics.test.ts` — **MODIFIED** (fix `buildWeeklyChartData` calls)

---

## Change Log

| Date | Change |
|------|--------|
| 2026-03-25 | Story created (ready-for-dev) |
| 2026-03-25 | Implementation completed (→ review) |

---

## ⚠️ CRITICAL CONTEXT — Đọc trước khi implement

### Bước 1: Tạo migration mới

**File:** `supabase/migrations/20260325000010_create_committed_hours_history.sql`

> Số timestamp `20260325000010` — kiểm tra file migration cuối cùng trong `supabase/migrations/` và dùng số lớn hơn.

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- committed_hours_history: lưu lịch sử thay đổi giờ cam kết theo từng member
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.committed_hours_history (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id          uuid        NOT NULL REFERENCES auth.users(id),
  committed_hours  smallint    NOT NULL
                  CONSTRAINT committed_hours_history_hours_valid
                    CHECK (committed_hours BETWEEN 1 AND 168),
  effective_from   date        NOT NULL,
  effective_to     date,                           -- NULL = đang áp dụng (current record)
  set_by           uuid        REFERENCES auth.users(id),  -- manager đã set
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT committed_hours_history_no_overlap
    UNIQUE (tenant_id, user_id, effective_from)    -- không 2 record cùng ngày bắt đầu
);

CREATE INDEX idx_committed_hours_history_lookup
  ON public.committed_hours_history (tenant_id, user_id, effective_from, effective_to);

ALTER TABLE public.committed_hours_history ENABLE ROW LEVEL SECURITY;

-- SELECT: manager/owner thấy toàn team; member thấy record của mình
CREATE POLICY committed_hours_history_select ON public.committed_hours_history
  FOR SELECT USING (
    tenant_id = public.current_tenant_id()
    AND (
      user_id = auth.uid()
      OR public.is_tenant_manager()
    )
  );

-- INSERT: chỉ manager/owner
CREATE POLICY committed_hours_history_insert ON public.committed_hours_history
  FOR INSERT WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_tenant_manager()
  );

-- UPDATE: chỉ manager/owner (để close record: set effective_to)
CREATE POLICY committed_hours_history_update ON public.committed_hours_history
  FOR UPDATE USING (
    tenant_id = public.current_tenant_id()
    AND public.is_tenant_manager()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- SEED: chuyển committed_hours hiện tại của mỗi member thành record lịch sử đầu tiên
-- effective_from = created_at của tenant_member (hoặc ngày đầu tiên của sprint nếu cần)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.committed_hours_history (
  tenant_id, user_id, committed_hours, effective_from, set_by
)
SELECT
  tm.tenant_id,
  tm.user_id,
  COALESCE(tm.committed_hours, t.default_committed_hours) AS committed_hours,
  tm.created_at::date                                      AS effective_from,
  NULL                                                     AS set_by         -- system seed
FROM public.tenant_members tm
JOIN public.tenants t ON t.id = tm.tenant_id
WHERE tm.status = 'active'
ON CONFLICT (tenant_id, user_id, effective_from) DO NOTHING;
```

**Apply migration:**
```bash
npx supabase db push --local
```

---

### Bước 2: Cập nhật Service — `src/features/tenant/services/tenant.service.ts`

Tìm hàm `updateMemberCommittedHours` (hiện tại chỉ UPDATE `tenant_members`). Thêm logic 2 bước:

```typescript
export const updateMemberCommittedHours = async (
  memberId: string,      // tenant_members.id
  tenantId: string,
  committedHours: number | null
): Promise<void> => {
  // Bước 1: Lấy user_id từ tenant_members (cần để insert history)
  const { data: member, error: fetchError } = await supabase
    .from('tenant_members')
    .select('user_id, committed_hours')
    .eq('id', memberId)
    .eq('tenant_id', tenantId)
    .single()
  if (fetchError) throw fetchError

  const today = new Date().toISOString().split('T')[0]  // 'YYYY-MM-DD'
  const effectiveHours = committedHours ?? null           // null = dùng tenant default

  // Bước 2a: UPDATE tenant_members (giữ nguyên — dùng cho current week lookup)
  const { data: updated, error: updateError } = await supabase
    .from('tenant_members')
    .update({ committed_hours: committedHours })
    .eq('id', memberId)
    .eq('tenant_id', tenantId)
    .select('id')
    .single()
  if (updateError) throw updateError
  if (!updated) throw new Error('Update blocked — session may be stale')

  // Bước 2b: Close record cũ trong history (effective_to = today)
  // Chỉ close nếu có record mở (effective_to IS NULL)
  await supabase
    .from('committed_hours_history')
    .update({ effective_to: today })
    .eq('tenant_id', tenantId)
    .eq('user_id', member.user_id)
    .is('effective_to', null)
  // Không throw lỗi ở đây — record có thể chưa có nếu seed chưa chạy

  // Bước 2c: INSERT record mới (chỉ khi committedHours có giá trị — không track NULL)
  if (effectiveHours !== null) {
    const { error: insertError } = await supabase
      .from('committed_hours_history')
      .insert({
        tenant_id: tenantId,
        user_id: member.user_id,
        committed_hours: effectiveHours,
        effective_from: today,
        effective_to: null,
        set_by: (await supabase.auth.getUser()).data.user?.id,
      })
    if (insertError) throw insertError
  }
}
```

**Lưu ý:**
- `supabase.auth.getUser()` async — wrap gọn hoặc lấy từ auth store nếu available
- Nếu `committedHours = null` (reset về default), chỉ close record cũ mà không tạo record mới (vì không có giá trị explicit để track)

---

### Bước 3: Cập nhật Analytics — lấy committed hours lịch sử theo tuần

#### 3a. Thêm service function mới vào `AnalyticsService`

**File:** `src/features/analytics/services/analytics.service.ts`

Thêm vào object `AnalyticsService` (cùng pattern với các method hiện tại):

```typescript
  // Lấy committed hours lịch sử của một member cho một khoảng thời gian
  // Trả về tất cả records có hiệu lực trong hoặc chồng lên [startDate, endDate]
  getMemberCommittedHoursHistory: async (
    tenantId: string,
    userId: string,
    startDate: string,  // 'YYYY-MM-DD' — ngày đầu tuần xa nhất
    endDate: string,    // 'YYYY-MM-DD' — ngày cuối tuần gần nhất
  ): Promise<Array<{ effective_from: string; effective_to: string | null; committed_hours: number }>> => {
    const { data, error } = await supabase
      .from('committed_hours_history')
      .select('effective_from, effective_to, committed_hours')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .lte('effective_from', endDate)          // record bắt đầu trước hoặc bằng endDate
      .or(`effective_to.is.null,effective_to.gte.${startDate}`)  // record còn hiệu lực sau startDate
      .order('effective_from', { ascending: true })
    if (error) throw error
    return data ?? []
  },
```

> ⚠️ `AnalyticsService` là **object** (không phải class) — thêm method dưới dạng property function, có dấu phẩy cuối.

#### 3b. Cập nhật `buildWeeklyChartData()` trong `analytics.utils.ts`

**Hiện tại:** nhận `committedHours: number` — dùng cùng 1 giá trị cho mọi tuần.

**Thay đổi:** nhận `committedHoursHistory` để lookup theo tuần.

```typescript
// Helper: tìm committed hours tại 1 thời điểm cụ thể
export function getCommittedHoursAtDate(
  history: Array<{ effective_from: string; effective_to: string | null; committed_hours: number }>,
  weekStart: string,       // 'YYYY-MM-DD'
  fallbackHours: number    // tenant default hoặc member current
): number {
  const record = history.find((r) => {
    return r.effective_from <= weekStart &&
      (r.effective_to === null || r.effective_to > weekStart)
  })
  return record?.committed_hours ?? fallbackHours
}
```

**Cập nhật signature `buildWeeklyChartData`:**
```typescript
// CommittedHoursHistoryRow — có thể import từ use-member-trend.ts sau khi tạo type ở đó
type CommittedHoursHistoryRow = {
  effective_from: string
  effective_to: string | null
  committed_hours: number
}

export function buildWeeklyChartData(
  weeklyHours: WeeklyHoursRow[],
  startDate: string,           // ← string (giữ nguyên như code hiện tại)
  endDate: string,             // ← string (giữ nguyên như code hiện tại)
  committedHoursHistory: CommittedHoursHistoryRow[],
  fallbackCommittedHours: number,   // member.committed_hours ?? tenant.default_committed_hours
): { weekLabel: string; actual: number; committed: number }[]
```

Trong vòng lặp tạo chart data, thay:
```typescript
// CŨ
committed: committedHours,

// MỚI
committed: getCommittedHoursAtDate(committedHoursHistory, weekStartStr, fallbackCommittedHours),
```

#### 3c. Cập nhật `useMemberTrend` hook — đổi return type

**File:** `src/features/analytics/hooks/use-member-trend.ts`

> ⚠️ **Return type thay đổi** — callers phải cập nhật (xem Bước 3d, 3e).

Thêm export type `MemberTrendData` vào `analytics.service.ts` (hoặc trong hook file):

```typescript
import { useQuery } from '@tanstack/react-query'
import { useTenantStore } from '@/stores/tenant-store'
import { QUERY_KEYS } from '@/lib/query-keys'
import { AnalyticsService } from '@/features/analytics/services/analytics.service'
import { groupReportsByWeek } from '@/features/analytics/utils/analytics.utils'
import type { WeeklyHoursRow } from '@/features/analytics/services/analytics.service'

// ── Types ──────────────────────────────────────────────────────────────────────
export type CommittedHoursHistoryRow = {
  effective_from: string
  effective_to: string | null
  committed_hours: number
}

export type MemberTrendData = {
  weeklyHours: WeeklyHoursRow[]
  committedHistory: CommittedHoursHistoryRow[]
}

// ── Hook ───────────────────────────────────────────────────────────────────────
export function useMemberTrend(
  userId: string | null,
  startDate: string,
  endDate: string,
): ReturnType<typeof useQuery<MemberTrendData>> {
  const { activeTenantId } = useTenantStore()
  return useQuery({
    queryKey: [QUERY_KEYS.analytics, 'member-trend', activeTenantId, userId, startDate, endDate],
    queryFn: async (): Promise<MemberTrendData> => {
      // Fetch song song: 2 queries không phụ thuộc nhau
      const [reports, history] = await Promise.all([
        AnalyticsService.getMemberReportsForPeriod(
          activeTenantId!, userId!, startDate, endDate,
        ),
        AnalyticsService.getMemberCommittedHoursHistory(
          activeTenantId!, userId!, startDate, endDate,
        ),
      ])
      return {
        weeklyHours: groupReportsByWeek(reports),
        committedHistory: history,
      }
    },
    enabled: !!activeTenantId && !!userId && !!startDate,
    staleTime: 2 * 60_000,
  })
}
```

**`useSelfAnalytics`** (`src/features/analytics/hooks/use-self-analytics.ts`):
Không cần sửa code — nó wrap `useMemberTrend` nên tự động có return type mới `MemberTrendData`.

---

#### 3d. Cập nhật caller — `src/routes/_app/analytics.tsx`

Tìm và sửa 2 chỗ:

```typescript
// ── TRƯỚC ────────────────────────────────────────────────────────────────────
const { data: memberWeeklyHours = [], isLoading: isTrendLoading } = useMemberTrend(
  selectedUserId,
  trendStart,
  trendEnd,
)

// ── SAU ───────────────────────────────────────────────────────────────────────
const { data: trendData, isLoading: isTrendLoading } = useMemberTrend(
  selectedUserId,
  trendStart,
  trendEnd,
)
const memberWeeklyHours = trendData?.weeklyHours ?? []
const memberCommittedHistory = trendData?.committedHistory ?? []
```

Và cập nhật `buildWeeklyChartData` call (khoảng line 108–114):

```typescript
// ── TRƯỚC ────────────────────────────────────────────────────────────────────
const chartData = selectedUserId && !isSettingsLoading
  ? buildWeeklyChartData(
      memberWeeklyHours,
      trendStart,
      trendEnd,
      selectedMemberCommitted,
    )
  : []

// ── SAU ───────────────────────────────────────────────────────────────────────
const chartData = selectedUserId && !isSettingsLoading
  ? buildWeeklyChartData(
      memberWeeklyHours,
      trendStart,
      trendEnd,
      memberCommittedHistory,
      selectedMemberCommitted,   // fallback khi history rỗng
    )
  : []
```

> `selectedMemberCommitted` hiện tại là `selectedMember?.committed_hours ?? defaultCommittedHours` — giữ nguyên, dùng làm fallback.

---

#### 3e. Cập nhật caller — `src/features/analytics/components/SelfAnalyticsHistory.tsx`

Tìm và sửa 2 chỗ:

```typescript
// ── TRƯỚC ────────────────────────────────────────────────────────────────────
const {
  data: weeklyHours = [],
  isLoading: isHoursLoading,
  isError: isHoursError,
} = useSelfAnalytics(startDate, endDate)

// ── SAU ───────────────────────────────────────────────────────────────────────
const {
  data: analyticsData,
  isLoading: isHoursLoading,
  isError: isHoursError,
} = useSelfAnalytics(startDate, endDate)
const weeklyHours = analyticsData?.weeklyHours ?? []
const committedHistory = analyticsData?.committedHistory ?? []
```

Cập nhật `buildWeeklyChartData` call (khoảng line 88–91):

```typescript
// ── TRƯỚC ────────────────────────────────────────────────────────────────────
const chartData = buildWeeklyChartData(weeklyHours, startDate, endDate, effectiveCommittedHours)

// ── SAU ───────────────────────────────────────────────────────────────────────
const chartData = buildWeeklyChartData(
  weeklyHours, startDate, endDate, committedHistory, effectiveCommittedHours,
)
```

> `calcAvgCommitmentRate(weeklyHours, effectiveCommittedHours)` và `MemberTrendChart.tsx` — **KHÔNG sửa**. Avg rate dùng giá trị committed hiện tại là chấp nhận được cho MVP. Per-bar color coding đã dùng `entry.committed` từ `chartData` (đã đúng lịch sử).

---

#### 3f. Cập nhật unit tests

**File:** `src/features/analytics/__tests__/analytics.test.ts`
**File:** `src/features/analytics/__tests__/self-analytics.test.ts`

`buildWeeklyChartData` hiện có 4 tham số — sau khi sửa sẽ có 5. Tất cả test calls phải thêm tham số:

```typescript
// ── TRƯỚC (tất cả test case) ──────────────────────────────────────────────────
buildWeeklyChartData([...], startDate, endDate, 40)
buildWeeklyChartData([...], '2026-03-09', '2026-03-22', 35)

// ── SAU ───────────────────────────────────────────────────────────────────────
buildWeeklyChartData([...], startDate, endDate, [], 40)    // history rỗng → dùng fallback
buildWeeklyChartData([...], '2026-03-09', '2026-03-22', [], 35)
```

Thêm test cho `getCommittedHoursAtDate`:

```typescript
describe('getCommittedHoursAtDate', () => {
  const history = [
    { effective_from: '2026-01-06', effective_to: '2026-03-16', committed_hours: 40 },
    { effective_from: '2026-03-16', effective_to: null, committed_hours: 32 },
  ]

  it('trả về giá trị đúng theo tuần', () => {
    expect(getCommittedHoursAtDate(history, '2026-03-09', 40)).toBe(40) // tuần trước khi đổi
    expect(getCommittedHoursAtDate(history, '2026-03-16', 40)).toBe(32) // tuần đổi
    expect(getCommittedHoursAtDate(history, '2026-03-23', 40)).toBe(32) // tuần sau khi đổi
  })

  it('trả về fallback khi history rỗng', () => {
    expect(getCommittedHoursAtDate([], '2026-03-23', 40)).toBe(40)
  })
})
```

---

### Bước 4: Test RLS

```sql
-- Test member thấy lịch sử của mình (không thấy người khác)
BEGIN;
SET LOCAL role = authenticated;
SET LOCAL "request.jwt.claims" = '{
  "sub": "<member_user_id>",
  "role": "authenticated",
  "active_tenant_id": "<tenant_id>"
}';
SELECT * FROM committed_hours_history;
-- Kỳ vọng: chỉ thấy records của member_user_id trong tenant
ROLLBACK;
```

Sau đó chạy:
```bash
npx supabase test db
```

---

### Schema hiện tại liên quan

```
tenant_members
  - id: uuid PK
  - tenant_id: uuid FK tenants
  - user_id: uuid FK auth.users
  - committed_hours: smallint (NULL = dùng tenant default)
  - status: 'active' | 'inactive'
  - created_at: timestamptz

tenants
  - id: uuid PK
  - default_committed_hours: smallint NOT NULL DEFAULT 40
```

---

### Query patterns hiện tại (KHÔNG phá vỡ)

| Use case | Nguồn dữ liệu | Ghi chú |
|----------|--------------|---------|
| Current week committed hours (My Dashboard, Team Overview) | `tenant_members.committed_hours` | **Giữ nguyên** — nhanh, đơn giản |
| Trend chart committed hours per week | `committed_hours_history` | **Mới** — lookup theo `week_start` |
| `get_team_avg_commitment_rate()` RPC | `COALESCE(tm.committed_hours, t.default_committed_hours, 40)` | Chưa cần sửa cho MVP |

---

### Patterns bắt buộc tuân theo

| Pattern | Mô tả |
|---------|-------|
| **P-02** | `.select('id').single()` sau UPDATE để detect RLS block |
| **Migration naming** | `YYYYMMDDNNNNNN_description.sql` — kiểm tra file cuối cùng trong `supabase/migrations/` |
| **RLS mandatory** | `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` bắt buộc |
| **SECURITY DEFINER** | Không cần cho table này (không query bảng khác có RLS trong policy) |
| **Named exports** | Không dùng `export default` |
| **Test sau migration** | `npx supabase test db` phải PASS trước khi mark done |

---

### Files cần thay đổi (đầy đủ)

| File | Loại thay đổi |
|------|--------------|
| `supabase/migrations/20260325000010_create_committed_hours_history.sql` | **Tạo mới** |
| `src/features/tenant/services/tenant.service.ts` | Sửa `updateMemberCommittedHours` |
| `src/features/analytics/services/analytics.service.ts` | Thêm `getMemberCommittedHoursHistory` |
| `src/features/analytics/utils/analytics.utils.ts` | Thêm `getCommittedHoursAtDate`, sửa `buildWeeklyChartData` |
| `src/features/analytics/hooks/use-member-trend.ts` | Đổi return type → `MemberTrendData` |
| `src/routes/_app/analytics.tsx` | Cập nhật destructure + `buildWeeklyChartData` call |
| `src/features/analytics/components/SelfAnalyticsHistory.tsx` | Cập nhật destructure + `buildWeeklyChartData` call |
| `src/features/analytics/__tests__/analytics.test.ts` | Fix `buildWeeklyChartData` calls (thêm arg) |
| `src/features/analytics/__tests__/self-analytics.test.ts` | Fix `buildWeeklyChartData` calls (thêm arg) |

**KHÔNG sửa:**
- `src/features/analytics/hooks/use-self-analytics.ts` — tự động nhận return type mới qua `useMemberTrend`
- `src/features/analytics/components/MemberTrendChart.tsx` — nhận `chartData` đã đúng từ parent, props không đổi
- `src/features/analytics/utils/analytics.utils.ts` → `calcAvgCommitmentRate` — giữ nguyên (dùng current committed là chấp nhận được cho MVP)

---

### Không làm

- ❌ KHÔNG xóa `tenant_members.committed_hours` — vẫn cần cho current week lookup
- ❌ KHÔNG sửa `get_team_avg_commitment_rate()` RPC — nằm ngoài scope story này
- ❌ KHÔNG sửa `SetCommittedHoursDialog.tsx` UI — chỉ sửa service logic bên dưới
- ❌ KHÔNG sửa `use-self-analytics.ts` — tự cập nhật qua useMemberTrend
- ❌ KHÔNG sửa `MemberTrendChart.tsx` props — nhận chartData đã đúng từ parent
- ❌ KHÔNG sửa `calcAvgCommitmentRate` — dùng current committed cho avg là đủ MVP
- ❌ KHÔNG dùng inline subquery vào bảng có RLS trong policy — dùng SECURITY DEFINER function nếu cần
- ❌ KHÔNG reset DB production

---

### Test thủ công

```
1. Apply migration → verify table tồn tại và seed data đúng
2. Manager đổi committed hours cho member A: 40h → 32h
   - tenant_members.committed_hours = 32 ✓
   - committed_hours_history: record 40h bị close (effective_to = hôm nay) ✓
   - committed_hours_history: record mới 32h (effective_from = hôm nay) ✓
3. Mở analytics → trend chart tuần trước hiện "committed: 40h" (theo lịch sử) ✓
4. Trend chart tuần này hiện "committed: 32h" ✓
5. npx supabase test db → tất cả PASS ✓
```
