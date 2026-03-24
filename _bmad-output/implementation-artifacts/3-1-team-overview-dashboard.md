# Story 3.1: Team Overview Dashboard

**Status:** done
**Epic:** 3 — Team Visibility & Self-Dashboard
**Story ID:** 3.1
**Story Key:** 3-1-team-overview-dashboard
**Created:** 2026-03-25

---

## Story

As a Manager or Owner,
I want to see my team's weekly schedule at a glance,
so that I can know who is working when and plan task assignments accordingly.

> **Lưu ý về permission:** `viewTeamDashboard` được cấp cho CẢ 3 roles (owner, manager, member)
> trong `src/lib/permissions.ts`. Trang `/dashboard` accessible với mọi role — UI không cần guard
> theo role. Story này focus vào use case Manager/Owner nhưng member cũng thấy team schedule.

---

## Acceptance Criteria

### AC1 — Hiển thị lịch tuần của toàn team

**Given** bất kỳ user nào truy cập `/dashboard`
**When** page load
**Then** hiển thị lịch làm việc tuần của tất cả active members dưới dạng grid/list
**And** mỗi member hiển thị tên + các slots đã đăng ký theo ngày trong tuần
**And** dashboard render < 2 giây với tối đa 15 members

### AC2 — Week navigation

**Given** user đang xem Team Dashboard
**When** user click nút `<` (tuần trước) hoặc `>` (tuần sau)
**Then** lịch cập nhật hiển thị data của tuần được chọn
**And** có nút "Tuần này" để quay về tuần hiện tại khi đang xem tuần khác

### AC3 — Empty state cho member chưa đăng ký

**Given** một member chưa đăng ký lịch cho tuần đang xem
**When** dashboard render
**Then** member đó **KHÔNG xuất hiện** trong heatmap — heatmap chỉ hiển thị thông tin theo khung giờ, không theo từng member

> **Design decision (post code-review):** Heatmap dùng time-axis grid (hàng = khung giờ, cột = ngày).
> Member xuất hiện dưới dạng avatar trong ô khi có slot overlap khung giờ đó.
> Member không đăng ký lịch → không có avatar → không hiển thị trong heatmap (invisible là expected behavior).
> AC gốc "row của member trống" được viết cho thiết kế per-member-row cũ, đã được thay bằng time-axis heatmap sau UX redesign.

### AC4 — Empty state khi cả tuần không có ai đăng ký

**Given** tuần được xem chưa có `schedule_week` record (không ai đăng ký lịch)
**When** dashboard render
**Then** heatmap hiển thị với default range 08:00–20:00, tất cả cells trống

---

## Tasks / Subtasks

- [x] **Task 1: Thêm QUERY_KEY mới** (AC1)
  - [x] Thêm `teamSchedule: 'team-schedule'` vào `src/lib/query-keys.ts`

- [x] **Task 2: Tạo DashboardService** (AC1, AC3, AC4)
  - [x] Tạo file `src/features/dashboard/services/dashboard.service.ts`
  - [x] Implement `DashboardService.getTeamWeekSlots(weekOf: string): Promise<ScheduleSlot[]>`
    - Query `schedule_weeks` bằng `maybeSingle()` — KHÔNG tạo mới nếu chưa tồn tại
    - Nếu không tìm thấy week → return `[]`
    - Query tất cả `schedule_slots` cho `week_id` — không filter theo `user_id` (RLS tự filter theo `tenant_id`)
    - Import `ScheduleSlot` type từ `@/features/schedule/services/schedule.service`

- [x] **Task 3: Tạo useTeamWeekSlots hook** (AC1, AC2)
  - [x] Tạo file `src/features/dashboard/hooks/use-team-week-slots.ts`
  - [x] Dùng `QUERY_KEYS.teamSchedule` + `weekOf` làm query key
  - [x] `staleTime: 60 * 1000` (1 phút — schedule ít thay đổi)
  - [x] `enabled: !!weekOf`

- [x] **Task 4: Tạo heatmap utilities + TeamScheduleHeatmap** (AC1, AC3, AC4)
  - [x] Tạo `src/features/dashboard/utils/dashboard.utils.ts` với các pure functions:
    - `groupSlotsByUser` — nhóm slots theo user_id
    - `getSlotsForDate` — filter slots theo ngày
    - `formatSlotTimeRange` — format "HH:mm – HH:mm" theo displayTimezone
    - `formatSlotDuration` — format "X giờ Y phút"
    - `computeSlotLocalParts` — tách overnight slot thành ≤2 parts theo timezone
    - `buildCellUserMap` — precompute Map `"YYYY-MM-DD:H" → userId[]` cho toàn bộ slots
    - `computeDisplayRange` — tính dynamic range `[slotStart, slotEnd]` từ dữ liệu thực tế (mặc định `[8, 20]`, tự mở rộng khi có overnight slots)
    - `getHeatmapBgClass` — Tailwind class theo số members (0→4+ shade of blue)
    - `getInitials` — lấy 2 chữ cái đầu từ full_name
  - [x] Tạo `src/features/dashboard/components/TeamScheduleHeatmap.tsx`
    - Props: `members`, `slots`, `weekOf`, `displayTimezone`
    - Dùng `computeDisplayRange(slots, displayTimezone)` → dynamic `[slotStart, slotEnd]`
    - Render table: cột Giờ + 7 cột ngày; hàng = mỗi 30 phút trong range
    - Mỗi ô: avatars của members có slot overlap khung giờ đó (tối đa 4 avatar + "+N")
    - Overnight slots tự động covered: `computeSlotLocalParts` tách thành 2 parts; grid mở rộng về 00:00 và lên 24:00 khi cần

- [x] **Task 5: Tạo component TeamDashboard** (AC1, AC2, AC3, AC4)
  - [x] Tạo file `src/features/dashboard/components/TeamDashboard.tsx`
  - [x] Week navigation state + handlers (`useState`, giống `schedule.tsx`)
  - [x] Legend hiển thị màu gradient theo số người
  - [x] Loading: `TeamDashboardSkeleton` (table skeleton với 8 rows × 7 cols)
  - [x] Empty state: "Chưa có thành viên nào trong team." khi `members.length === 0`
  - [x] Render `<TeamScheduleHeatmap members slots weekOf displayTimezone />`

- [x] **Task 6: Cắm vào route `/dashboard`** (AC1, AC2)
  - [x] Cập nhật `src/routes/_app/dashboard.tsx` — thay placeholder bằng `<TeamDashboard />`

- [x] **Task 7: Tests** (tất cả AC)
  - [x] Tạo `src/features/dashboard/__tests__/dashboard.test.ts`
  - [x] 45 tests cho tất cả utils: `groupSlotsByUser`, `getSlotsForDate`, `formatSlotTimeRange`, `formatSlotDuration`, `computeSlotLocalParts`, `buildCellUserMap`, `computeDisplayRange`, `getHeatmapBgClass`, `getInitials`
  - [x] Bao gồm cases: UTC, ICT timezone, overnight slots, edge cases

---

## Dev Notes

### Tổng quan kiến trúc

Story này tạo feature `dashboard` mới theo chuẩn feature-module. Route `/dashboard` đã tồn tại
dưới dạng **placeholder** → chỉ cần thay nội dung, không tạo route file mới.

**UI approach:** Heatmap grid theo khung giờ. Hàng = mỗi 30 phút. Cột = 7 ngày.
Ô hiển thị avatars của members có lịch trong khung giờ đó — không phải per-member row table.

### Cấu trúc file thực tế

```
src/features/dashboard/
├── services/
│   └── dashboard.service.ts       ← DashboardService.getTeamWeekSlots()
├── hooks/
│   └── use-team-week-slots.ts     ← useTeamWeekSlots(weekOf)
├── utils/
│   └── dashboard.utils.ts         ← 9 pure functions (testable)
├── components/
│   ├── TeamDashboard.tsx           ← Page component (week nav + skeleton + legend)
│   ├── TeamScheduleHeatmap.tsx     ← Heatmap grid chính
│   └── MemberScheduleRow.tsx       ← Giữ lại nhưng không dùng trong main view
└── __tests__/
    └── dashboard.test.ts           ← 45 tests, tất cả PASS
```

**Chỉnh sửa file có sẵn:**
- `src/lib/query-keys.ts` — thêm `teamSchedule: 'team-schedule'`
- `src/routes/_app/dashboard.tsx` — thay placeholder bằng `component: TeamDashboard`

> ❌ KHÔNG tạo `index.ts` barrel export — import trực tiếp từ file (MVP restriction)

### DashboardService — implementation

```typescript
// src/features/dashboard/services/dashboard.service.ts
import { supabase } from '@/lib/supabase-browser'
import type { ScheduleSlot } from '@/features/schedule/services/schedule.service'

export const DashboardService = {
  // maybeSingle() — KHÔNG tạo record nếu tuần chưa có schedule
  // Khác với ScheduleService.getOrCreateScheduleWeek (dùng trong personal schedule)
  getTeamWeekSlots: async (weekOf: string): Promise<ScheduleSlot[]> => {
    const { data: week, error: weekError } = await supabase
      .from('schedule_weeks')
      .select('id')
      .eq('week_of', weekOf)
      .maybeSingle()
    if (weekError) throw weekError
    if (!week) return []  // Tuần chưa có record → không ai đăng ký → return rỗng

    const { data, error } = await supabase
      .from('schedule_slots')
      .select('*')
      .eq('week_id', week.id)
      .order('user_id', { ascending: true })
      .order('slot_date', { ascending: true })
      .order('start_time', { ascending: true })
    if (error) throw error
    return data ?? []
  },
}
```

> **QUAN TRỌNG — Không dùng `getOrCreateScheduleWeek`!**
> `ScheduleService.getOrCreateScheduleWeek()` gọi RPC tạo mới schedule_week nếu chưa có.
> Dashboard chỉ đọc — KHÔNG được tạo record. Phải dùng `maybeSingle()` trực tiếp.

### RLS đã verified — không cần migration

`schedule_slots` SELECT policy: `tenant_id = current_tenant_id()` (không filter theo `user_id`)
→ **Tất cả members trong tenant đều thấy toàn bộ slots của tenant hiện tại.**
Không cần thay đổi RLS hay migration.

### Reuse existing: useTenantMembers

```typescript
// Hook đã tồn tại — KHÔNG tạo lại
import { useTenantMembers } from '@/features/tenant/hooks/use-tenant-members'
// Trả về: TenantMemberWithUser[] { id, user_id, role, status, committed_hours,
//   users: { id, full_name, avatar_url, timezone, email } }
// Chỉ lấy active members (filter status='active' ở service layer)
```

### useTeamWeekSlots — implementation

```typescript
// src/features/dashboard/hooks/use-team-week-slots.ts
import { useQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/lib/query-keys'
import { DashboardService } from '../services/dashboard.service'

export function useTeamWeekSlots(weekOf: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.teamSchedule, weekOf],
    queryFn: () => DashboardService.getTeamWeekSlots(weekOf),
    staleTime: 60 * 1000,  // 1 phút
    enabled: !!weekOf,
  })
}
```

### TeamDashboard — cấu trúc component

```
TeamDashboard
├── useAuthStore()            → user.id
├── useQuery(userProfile)     → displayTimezone (fallback 'UTC')
├── useTenantMembers()        → members[]
├── useTeamWeekSlots(weekOf)  → slots[]
├── useState(currentWeekOf)   → week navigation
├── <WeekNavBar />            → inline, centered, < > + "Tuần này"
├── <Legend />                → inline, blue gradient scale
├── <TeamDashboardSkeleton /> → khi isLoading
└── <TeamScheduleHeatmap
      members={members}
      slots={slots}
      weekOf={currentWeekOf}
      displayTimezone={displayTimezone}
    />
```

### TeamScheduleHeatmap — cấu trúc component

```
TeamScheduleHeatmap(members, slots, weekOf, displayTimezone)
│
├── computeDisplayRange(slots, tz)    → [slotStart, slotEnd]  ← DYNAMIC
├── buildCellUserMap(slots, tz, ...)  → Map<"date:H", userId[]>
│
└── <table>
    ├── <colgroup> col w-12 + 7 equal cols
    ├── <thead>
    │   └── Giờ | T2 23/03 | T3 24/03 | ... | CN 29/03
    └── <tbody>
        └── per row (h = slotStart..slotEnd step 0.5):
            ├── <td> HH:mm label (chỉ ở :00, ẩn ở :30)
            └── 7 × <HeatmapCell userIds memberMap isHalfHour />
                    └── avatars (max 4) + "+N" overflow
```

### Overnight slots — xử lý đầy đủ

`SlotForm.tsx` cho phép:
- **Start time**: 00:00–23:30 (toàn bộ 24h, bước 30 phút)
- **Overnight end time**: capped tại 06:00 (`OVERNIGHT_END_OPTIONS` trong `SlotForm.tsx` line 43-47)
- **Duration max**: 720 phút (12 giờ)

Dashboard xử lý qua pipeline 3 bước:

```
slot { start_time: "2026-03-23T15:00Z", duration: 360 }  ← 22:00–04:00 ICT

Step 1 — computeSlotLocalParts(slot, "Asia/Ho_Chi_Minh")
  → Part 1: { day: "2026-03-23", startD: 22, endD: 24 }
  → Part 2: { day: "2026-03-24", startD: 0,  endD: 4  }

Step 2 — computeDisplayRange(allSlots, tz)
  → min(defaultStart=8, 22, 0) = 0  → slotStart = 0
  → max(defaultEnd=20, 24, 4)  = 24 → slotEnd   = 24
  → Grid mở rộng: 00:00 → 24:00 (thay vì default 08:00 → 20:00)

Step 3 — buildCellUserMap(allSlots, tz, slotStart=0, slotEnd=24, step=0.5)
  → "2026-03-23:22" → [userId]  ← T2 22:00–22:30: member có mặt ✓
  → "2026-03-23:23.5" → [userId] ← T2 23:30–24:00: member có mặt ✓
  → "2026-03-24:0"   → [userId]  ← T3 00:00–00:30: member có mặt ✓
  → "2026-03-24:3.5" → [userId]  ← T3 03:30–04:00: member có mặt ✓
```

### Week navigation — pattern từ schedule.tsx

```typescript
// Trong TeamDashboard.tsx
import { startOfISOWeek, format, parseISO, addDays } from 'date-fns'

function getCurrentWeekOf(): string {
  return format(startOfISOWeek(new Date()), 'yyyy-MM-dd')  // Monday ISO
}

const [currentWeekOf, setCurrentWeekOf] = useState(getCurrentWeekOf)
const todayWeekOf = format(startOfISOWeek(new Date()), 'yyyy-MM-dd')
const isViewingCurrentWeek = currentWeekOf === todayWeekOf

const handlePrevWeek = () =>
  setCurrentWeekOf(prev => format(addDays(parseISO(prev), -7), 'yyyy-MM-dd'))
const handleNextWeek = () =>
  setCurrentWeekOf(prev => format(addDays(parseISO(prev), 7), 'yyyy-MM-dd'))
```

> Dùng `useState` (không phải URL search params) — nhất quán với `schedule.tsx`.

### Timezone display

```typescript
// Trong TeamDashboard.tsx — pattern từ schedule.tsx
const { data: userProfile } = useQuery({
  queryKey: [QUERY_KEYS.userProfile, user?.id],
  queryFn: () => getUserProfile(user!.id),
  enabled: !!user?.id,
  staleTime: 5 * 60 * 1000,
})
const displayTimezone = userProfile?.timezone ?? 'UTC'
```

`displayTimezone` được pass xuống `TeamScheduleHeatmap` → `computeDisplayRange` → `buildCellUserMap` → tất cả display đều theo timezone của viewer.

### Performance

- 2 query song song (`useTenantMembers` + `useTeamWeekSlots`) — không sequential dependency
- `buildCellUserMap` là O(slots × rowCount): với 15 members × ~5 slots × ~24 rows = ~1800 ops → negligible
- `computeDisplayRange` là O(slots): chạy cùng render, không cần memo ở MVP scale

### Import conventions (MVP restrictions)

```typescript
// ✅ ĐÚNG
import { supabase } from '@/lib/supabase-browser'        // Singleton
import { ROUTES } from '@/lib/routes'                    // Không hardcode path
import { QUERY_KEYS } from '@/lib/query-keys'            // Không hardcode key strings
import { DashboardService } from '../services/dashboard.service'  // Import trực tiếp

// ❌ SAI
import { createClient } from '@supabase/supabase-js'     // Tạo client mới
import { everything } from './index'                     // Barrel export
```

### Project Structure Notes

- Route file `/dashboard` đã tồn tại: `src/routes/_app/dashboard.tsx` — đã cập nhật, không tạo mới
- Feature mapping từ architecture: Team Visibility (FR22-24) → `src/features/dashboard/`
- Không cần route guard thêm — route `_app` layout đã guard auth + tenant context

### References

- RLS policies verified: [MCP query — schedule_slots SELECT: `tenant_id = current_tenant_id()`]
- Feature mapping: [architecture.md — Feature Module Organization, lines 916-930]
- Dashboard folder spec: [architecture.md — Dashboard Feature Structure, lines 1095-1103]
- Permission definitions: [`src/lib/permissions.ts` — `viewTeamDashboard` available to all roles]
- Week navigation pattern: [`src/routes/_app/schedule.tsx` — `useState` + date-fns]
- Existing reusable hook: [`src/features/tenant/hooks/use-tenant-members.ts`]
- `maybeSingle()` pattern: [`src/features/schedule/services/schedule.service.ts` — `getPreviousWeekSlots`]
- Overnight time range: [`src/features/schedule/components/SlotForm.tsx` lines 34-47 — `TIME_OPTIONS` + `OVERNIGHT_END_OPTIONS`]

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5 → Claude Sonnet 4.6 (post-review fixes)

### Debug Log References

Không có blocking issues.

### Completion Notes List

- Task 1: Thêm `teamSchedule: 'team-schedule'` vào `src/lib/query-keys.ts`
- Task 2: `DashboardService.getTeamWeekSlots()` dùng `maybeSingle()` — không tạo schedule_week mới; RLS SELECT không filter user_id → trả về toàn bộ slots của tenant
- Task 3: `useTeamWeekSlots` hook với `staleTime: 60s`, `enabled: !!weekOf`
- Task 4: `dashboard.utils.ts` với 9 pure functions testable riêng biệt; `TeamScheduleHeatmap` dùng heatmap grid (không phải per-member row table)
- Task 5: `TeamDashboard` với week navigation (useState), legend gradient, loading skeleton (`TeamDashboardSkeleton`), empty state khi `members.length === 0`
- Task 6: Route `/dashboard` cập nhật `component: TeamDashboard`
- Task 7: 45 tests PASS — cover toàn bộ 9 utils functions, gồm overnight và ICT timezone cases
- **Post-review: UX redesign sang heatmap** — `MemberScheduleRow` giữ lại nhưng không dùng trong main view; `TeamScheduleHeatmap` là component hiển thị chính
- **Post-review: dynamic display range** — `computeDisplayRange` tự mở rộng grid khi có overnight slots (ví dụ 22:00–06:00 mở rộng từ default [8,20] → [0,24])
- **Post-review: overnight slot distribution** — `computeSlotLocalParts` tách overnight thành 2 parts; avatars xuất hiện đúng ở cả ngày bắt đầu VÀ ngày kết thúc

### File List

**Tạo mới:**
- `src/features/dashboard/services/dashboard.service.ts`
- `src/features/dashboard/hooks/use-team-week-slots.ts`
- `src/features/dashboard/utils/dashboard.utils.ts`
- `src/features/dashboard/components/TeamDashboard.tsx`
- `src/features/dashboard/components/TeamScheduleHeatmap.tsx`
- `src/features/dashboard/components/MemberScheduleRow.tsx` ← giữ lại, không dùng trong main view
- `src/features/dashboard/__tests__/dashboard.test.ts`

**Chỉnh sửa:**
- `src/lib/query-keys.ts` — thêm `teamSchedule`
- `src/routes/_app/dashboard.tsx` — thay placeholder

**Seed data (local only — không commit):**
- `supabase/seed-dashboard-test.sql` — 5 test users + 29 slots cho tuần 2026-03-23
  - Xóa bằng: `DELETE FROM auth.users WHERE email LIKE '%tekmium.test'`
