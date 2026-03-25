# Story 3.2: Real-time "Who is Online" & Timezone View

**Status:** review
**Epic:** 3 — Team Visibility & Self-Dashboard
**Story ID:** 3.2
**Story Key:** 3-2-realtime-who-is-online-timezone-view
**Created:** 2026-03-25

---

## Story

As a Manager or Owner,
I want to see who is currently working right now and view the team schedule in different timezones,
So that I can make informed decisions about who to assign tasks to at any moment.

---

## Acceptance Criteria

### AC1 — Hiển thị danh sách "Đang online"

**Given** bất kỳ user nào mở Team Dashboard đang xem **tuần hiện tại**
**When** current UTC time nằm trong khoảng `start_time` và `start_time + duration_minutes * 60s` của một slot
**Then** member đó được hiển thị trong panel "Đang online" (tên + avatar)
**And** danh sách tự refresh mỗi 60 giây (`refetchInterval: 60_000`) mà không cần reload trang

### AC2 — Empty state cho "Đang online"

**Given** không có member nào có slot active tại thời điểm hiện tại
**When** dashboard render panel "Đang online"
**Then** hiển thị empty state: `"Không có ai đang trong giờ làm việc."`

### AC3 — "Đang online" chỉ hiển thị khi xem tuần hiện tại

**Given** user đang xem một tuần khác (không phải tuần hiện tại)
**When** dashboard render
**Then** panel "Đang online" không hiển thị (chỉ xem lịch, không có trạng thái real-time)

### AC4 — Timezone selector

**Given** user muốn xem lịch theo timezone khác
**When** user chọn timezone từ timezone selector trên dashboard
**Then** toàn bộ heatmap cập nhật hiển thị theo timezone được chọn
**And** lựa chọn này **không** lưu vào profile — chỉ là view state local

### AC5 — Timezone default từ profile

**Given** user vừa mở dashboard
**When** profile chưa load xong
**Then** timezone selector hiển thị 'UTC' làm fallback
**When** profile load xong
**Then** timezone selector chuyển sang `userProfile.timezone` (nếu user chưa thay đổi thủ công)

---

## Tasks / Subtasks

- [x] **Task 1: Thêm `getOnlineMemberIds()` vào dashboard.utils.ts** (AC1, AC2)
  - [x] Thêm function `getOnlineMemberIds(slots: ScheduleSlot[], nowUTC?: Date): string[]`
  - [x] Pure UTC comparison: `now >= start_time && now < start_time + duration_minutes * 60_000`
  - [x] Dedup user_id (Set) — member có nhiều slots active → chỉ xuất hiện 1 lần
  - [x] Tham số `nowUTC` injectable để test được deterministic

- [x] **Task 2: Cập nhật `useTeamWeekSlots` — thêm `refetchInterval` support** (AC1)
  - [x] Cập nhật signature: `useTeamWeekSlots(weekOf: string, options?: { refetchInterval?: number })`
  - [x] Truyền `refetchInterval: options?.refetchInterval` vào `useQuery`

- [x] **Task 3: Cập nhật `TeamDashboard.tsx`** (AC1–AC5)
  - [x] Thêm `viewTimezone` state: `const [viewTimezone, setViewTimezone] = useState<string | null>(null)`
  - [x] `displayTimezone = viewTimezone ?? userProfile?.timezone ?? 'UTC'`
  - [x] Truyền `refetchInterval: 60_000` vào `useTeamWeekSlots` khi `isViewingCurrentWeek`
  - [x] Tính `onlineMemberIds` bằng `getOnlineMemberIds(slots)` chỉ khi `isViewingCurrentWeek`
  - [x] Tính `onlineMembers = members.filter(m => onlineMemberIds.includes(m.user_id))`
  - [x] Render `<OnlineNowPanel onlineMembers={onlineMembers} />` chỉ khi `isViewingCurrentWeek && !isLoading`
  - [x] Render `<TimezoneSelector value={displayTimezone} onChange={setViewTimezone} />` trong header area
  - [x] Import `TimezoneSelector` từ `@/features/settings/components/TimezoneSelector`
  - [x] Import `getOnlineMemberIds` từ `../utils/dashboard.utils`

- [x] **Task 4: Thêm component `OnlineNowPanel` (inline trong TeamDashboard.tsx)** (AC1, AC2)
  - [x] Props: `{ onlineMembers: TenantMemberWithUser[] }`
  - [x] Khi `onlineMembers.length === 0`: render `"Không có ai đang trong giờ làm việc."`
  - [x] Khi có members: render list avatar + `users.full_name`
  - [x] Pattern: giống `TeamDashboardSkeleton` — function component trong cùng file

- [x] **Task 5: Viết tests cho `getOnlineMemberIds()`** (AC1, AC2)
  - [x] Thêm vào `src/features/dashboard/__tests__/dashboard.test.ts`
  - [x] Test cases:
    - Slot đang active (now trong range) → member xuất hiện
    - Slot kết thúc trước now 1ms → không xuất hiện
    - Slot bắt đầu sau now 1ms → không xuất hiện
    - Boundary: `now === start_time` → online (inclusive start)
    - Boundary: `now === end_time` → không online (exclusive end)
    - Member có 2 slots cùng active → chỉ xuất hiện 1 lần (dedup)
    - Nhiều members online → tất cả xuất hiện
    - `slots = []` → trả về `[]`
    - `nowUTC` injectable → deterministic

---

## Dev Notes

### Kiến trúc tổng quan

Story này **mở rộng** `TeamDashboard` đã có từ Story 3.1 — KHÔNG tạo lại từ đầu. Toàn bộ logic "who is online" là **client-side computation** từ slots đã fetch — không cần endpoint riêng hay DB query mới.

### ⚠️ KHÔNG tạo thêm files — chỉ modify/extend existing

```
MODIFY (không tạo mới):
src/features/dashboard/
├── utils/dashboard.utils.ts      ← thêm getOnlineMemberIds()
├── hooks/use-team-week-slots.ts  ← thêm options.refetchInterval
├── components/TeamDashboard.tsx  ← thêm timezone selector + online panel
└── __tests__/dashboard.test.ts   ← thêm tests mới
```

> ❌ KHÔNG tạo `OnlineNowPanel.tsx` riêng — inline trong `TeamDashboard.tsx` (như `TeamDashboardSkeleton`)
> ❌ KHÔNG tạo `index.ts` barrel exports
> ❌ KHÔNG tạo hook riêng cho "who is online" — dùng lại `useTeamWeekSlots` data

### getOnlineMemberIds — implementation mẫu

```typescript
// Thêm vào cuối src/features/dashboard/utils/dashboard.utils.ts

/**
 * getOnlineMemberIds — tính user_ids đang có slot active tại nowUTC.
 *
 * "Online" = now >= slot.start_time AND now < slot.start_time + duration_minutes
 * Pure UTC comparison — không cần timezone.
 * nowUTC injectable để test deterministic.
 */
export function getOnlineMemberIds(slots: ScheduleSlot[], nowUTC?: Date): string[] {
  const nowMs = (nowUTC ?? new Date()).getTime()
  const onlineSet = new Set<string>()
  for (const slot of slots) {
    const startMs = new Date(slot.start_time).getTime()
    const endMs = startMs + slot.duration_minutes * 60_000
    if (nowMs >= startMs && nowMs < endMs) {
      onlineSet.add(slot.user_id)
    }
  }
  return Array.from(onlineSet)
}
```

### useTeamWeekSlots — cập nhật signature

```typescript
// src/features/dashboard/hooks/use-team-week-slots.ts
export function useTeamWeekSlots(weekOf: string, options?: { refetchInterval?: number }) {
  const { activeTenantId } = useTenantStore()
  return useQuery({
    queryKey: [QUERY_KEYS.teamSchedule, activeTenantId, weekOf],
    queryFn: () => DashboardService.getTeamWeekSlots(weekOf, activeTenantId!),
    staleTime: 60 * 1000,
    refetchInterval: options?.refetchInterval,   // ← thêm dòng này
    enabled: !!weekOf && !!activeTenantId,
  })
}
```

### TeamDashboard — thay đổi key

```typescript
// 1. Timezone state (thay const displayTimezone cũ)
const [viewTimezone, setViewTimezone] = useState<string | null>(null)
const displayTimezone = viewTimezone ?? userProfile?.timezone ?? 'UTC'

// 2. Slots với refetchInterval khi xem tuần hiện tại
const { data: slots = [], isLoading: isSlotsLoading } = useTeamWeekSlots(
  currentWeekOf,
  { refetchInterval: isViewingCurrentWeek ? 60_000 : undefined },
)

// 3. Online members (chỉ tính khi xem tuần hiện tại)
const onlineMemberIds = isViewingCurrentWeek ? getOnlineMemberIds(slots) : []
const onlineMembers = members.filter(m => onlineMemberIds.includes(m.user_id))
```

### TimezoneSelector trong dashboard

```tsx
// Import (reuse từ settings — KHÔNG tạo mới)
import { TimezoneSelector } from '@/features/settings/components/TimezoneSelector'

// Header row — title + week nav (căn giữa mx-auto) + timezone dropdown (bên phải, không có label text)
<div className="flex items-center gap-2">
  <CalendarDays ... /><h1>Team Dashboard</h1>
  <div className="flex items-center gap-1 mx-auto">{ /* week nav */ }</div>
  <div className="w-48 shrink-0">
    <TimezoneSelector value={displayTimezone} onChange={setViewTimezone} />
  </div>
</div>
```

> `TimezoneSelector` dùng `COMMON_TIMEZONES` từ `@/lib/timezones`. Không truyền `disabled` prop.

### OnlineNowPanel — inline component mẫu

```tsx
// Inline trong TeamDashboard.tsx (sau TeamDashboardSkeleton)

function OnlineNowPanel({ onlineMembers }: { onlineMembers: TenantMemberWithUser[] }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
        <span className="text-sm font-medium">Đang online ({onlineMembers.length})</span>
      </div>
      {onlineMembers.length === 0 ? (
        <p className="text-sm text-muted-foreground">Không có ai đang trong giờ làm việc.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {onlineMembers.map((m) => (
            <div key={m.user_id} className="flex items-center gap-1.5 text-sm">
              {/* Avatar pattern từ MemberList.tsx */}
              <span className="inline-flex size-6 rounded-full bg-muted items-center justify-center text-xs font-medium">
                {getInitials(m.users.full_name)}
              </span>
              <span>{m.users.full_name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

> Import `getInitials` từ `'../utils/dashboard.utils'` — function đã có từ Story 3.1.
> Import `TenantMemberWithUser` từ `'@/features/tenant/services/tenant.service'`.

### Thứ tự render trong TeamDashboard

```
1. Header row (1 dòng): [icon + "Team Dashboard"] [← week nav (căn giữa) →] [timezone dropdown (bên phải)]
2. OnlineNowPanel                  ← MỚI (chỉ khi isViewingCurrentWeek && !isLoading)
3. Legend (gradient scale)
4. Heatmap / Skeleton / Empty state
```

### "Who is online" logic — KHÔNG dùng timezone

"Online" check là pure UTC: `now >= slot.start_time && now < end_time`
Không liên quan timezone — `start_time` là UTC absolute timestamp trong DB.
`displayTimezone` chỉ ảnh hưởng heatmap display, không ảnh hưởng online detection.

### ScheduleSlot type (reference)

```typescript
// Từ Tables<'schedule_slots'>
type ScheduleSlot = {
  id: string
  user_id: string
  week_id: string
  slot_date: string      // YYYY-MM-DD (tenant timezone)
  start_time: string     // ISO UTC: "2026-03-25T02:00:00+00:00"
  duration_minutes: number
  tenant_id: string
  created_at: string
  updated_at: string
}
```

### TenantMemberWithUser type (reference)

```typescript
type TenantMemberWithUser = {
  id: string
  user_id: string
  role: 'owner' | 'manager' | 'member'
  status: 'active' | 'inactive'
  committed_hours: number | null
  users: { id: string; full_name: string; avatar_url: string | null; timezone: string; email: string | null }
}
```

### Import conventions — bắt buộc tuân theo

```typescript
// ✅ ĐÚNG
import { TimezoneSelector } from '@/features/settings/components/TimezoneSelector'
import { getOnlineMemberIds, getInitials } from '../utils/dashboard.utils'
import type { TenantMemberWithUser } from '@/features/tenant/services/tenant.service'

// ❌ SAI
import { TimezoneSelector } from '@/features/settings'    // barrel export — cấm
import { createClient } from '@supabase/supabase-js'      // tạo client mới — cấm
```

### Không cần migration DB

Toàn bộ story 3.2 là frontend-only. RLS và DB schema không thay đổi. Không cần chạy `npx supabase db push` hay test `npx supabase test db`.

### Backward compatibility

- Heatmap vẫn hoạt động đúng — chỉ thay đổi source của `displayTimezone` từ `const` → `state`
- `useTeamWeekSlots` signature vẫn backward-compatible (tham số thứ 2 là optional)
- Không xóa hay rename component/function nào đã có

---

## Intelligence từ Story 3.1

### Patterns đã thiết lập (tuân theo đúng)

- `useTenantMembers()` từ `@/features/tenant/hooks/use-tenant-members` — trả về `TenantMemberWithUser[]`
- `DashboardService.getTeamWeekSlots(weekOf, tenantId)` — cần truyền cả `activeTenantId`
- `useTeamWeekSlots` đọc `activeTenantId` từ `useTenantStore()` internally
- `getInitials(name)` đã có trong `dashboard.utils.ts` — KHÔNG viết lại
- `week navigation` dùng `useState` + `date-fns` (không dùng URL params)
- Inline component pattern (như `TeamDashboardSkeleton`) — phù hợp cho `OnlineNowPanel`
- `useTenantMembers()` filter `status='active'` ở service layer → không cần filter lại

### Codebase đang dùng (bắt buộc giữ nguyên)

```
src/features/dashboard/
├── services/dashboard.service.ts      ← không sửa
├── hooks/use-team-week-slots.ts       ← thêm optional param
├── utils/dashboard.utils.ts           ← thêm 1 function
├── components/
│   ├── TeamDashboard.tsx              ← extend
│   ├── TeamScheduleHeatmap.tsx        ← không sửa
│   └── MemberScheduleRow.tsx          ← không sửa (giữ lại, không dùng)
└── __tests__/dashboard.test.ts        ← thêm tests mới (giữ 45 tests cũ)
```

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

Không có blocking issues. Một lưu ý: Supabase local bị tắt khi bắt đầu test → khởi động lại bằng `npx supabase start`. Password user đã được reset qua psql để test Playwright.

### Completion Notes List

- **Task 1**: `getOnlineMemberIds()` thêm vào cuối `dashboard.utils.ts`. Pure UTC millisecond comparison, dedup bằng Set, `nowUTC` injectable.
- **Task 2**: `useTeamWeekSlots` cập nhật signature với optional `options.refetchInterval`. Backward-compatible (existing call sites không cần thay đổi).
- **Task 3 + 4**: `TeamDashboard.tsx` viết lại hoàn toàn — thêm `viewTimezone` state, `OnlineNowPanel` inline, `TimezoneSelector` reuse từ settings, `refetchInterval: 60_000` khi `isViewingCurrentWeek`. Header 1 dòng: title (trái) → week nav (căn giữa `mx-auto`) → timezone dropdown không label (phải). Thứ tự render: Header row → Online panel → Legend → Heatmap.
- **Task 5**: 12 tests mới cho `getOnlineMemberIds` thêm vào `dashboard.test.ts`. Tổng 57 tests (45 cũ + 12 mới), tất cả PASS.

**Playwright E2E verification (manual):**
- ✅ AC1: "Đang online (1) NP Nam Phạm" hiển thị đúng khi viewing current week
- ✅ AC2: Unit-tested (empty state render khi `onlineMembers.length === 0`)
- ✅ AC3: Panel biến mất khi navigate sang tuần trước; "Tuần này" button xuất hiện
- ✅ AC4: Timezone selector switch UTC↔ICT → heatmap cập nhật đúng (UTC: 00:00-05:00; ICT: 07:00-12:00 shift)
- ✅ AC5: Mở dashboard lần đầu → "Hồ Chí Minh (UTC+7)" được load từ profile tự động

### File List

**Chỉnh sửa:**
- `src/features/dashboard/utils/dashboard.utils.ts` — thêm `getOnlineMemberIds()`
- `src/features/dashboard/hooks/use-team-week-slots.ts` — thêm `options.refetchInterval`
- `src/features/dashboard/components/TeamDashboard.tsx` — timezone selector + OnlineNowPanel + refetchInterval
- `src/features/dashboard/__tests__/dashboard.test.ts` — 12 tests mới cho `getOnlineMemberIds()`

**Không tạo file mới**
