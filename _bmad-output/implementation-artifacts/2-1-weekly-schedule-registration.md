# Story 2.1: Weekly Schedule Registration

Status: review

## Story

As a member,
I want to register my work schedule for the upcoming week as time slots,
So that my manager knows when I'm available and I can commit to my working hours.

## Acceptance Criteria

1. **Slot creation** — Member chọn ngày + start time + end time (bước 30 phút) → slot được lưu với `start_time (UTC) + duration_minutes`. Min 30 phút, max 720 phút (12h).

2. **Multiple slots per day** — Member có thể thêm nhiều slots trong cùng ngày (VD: 9:00–11:30 và 14:00–17:00).

3. **Overnight slot** — Slot VD: 22:00 thứ Hai → 02:00 thứ Ba được lưu với `slot_date = thứ Hai` (ngày bắt đầu), `duration_minutes = 240`. Dashboard và hours calculation đều dùng ngày bắt đầu.

4. **Overlap prevention** — Nếu 2 slots trùng nhau → hệ thống báo lỗi: "Thời gian này bị trùng với slot khác." — không cho phép lưu. Validation phải xảy ra client-side (UX < 1 giây) VÀ DB trigger sẽ enforce server-side.

5. **Submit schedule** — Member submit toàn bộ lịch tuần → slots được lưu vào DB, form respond < 1 giây. Trạng thái "đã đăng ký" = user có slots trong tuần đó.

6. **Schedule page** — Route `/schedule` hiển thị lịch tuần hiện tại của member (7 ngày từ Monday đến Sunday). Desktop: grid 7 cột. Mobile (< 768px): list theo ngày.

7. **Deadline badge** — Hiển thị deadline đăng ký lịch (từ `schedule_weeks.deadline`) với countdown rõ ràng. Nếu tuần hiện tại đã quá deadline, hiển thị trạng thái tương ứng.

## Tasks / Subtasks

### Pre-story cleanup (từ Retro Action Items — phải làm TRƯỚC khi bắt đầu feature)

- [ ] Task 0a: Fix 2 ESLint errors từ Story 1.1
  - [ ] Fix `__root.tsx` duplicate import
  - [ ] Fix `supabase/functions` ESLint issue
  - [ ] Chạy `npm run lint` → 0 errors

- [ ] Task 0b: Xác nhận Vitest infrastructure đã có sẵn
  - [ ] Kiểm tra `vitest.config.ts` tồn tại (đã được setup trong commit `chore(pre-epic2)`)
  - [ ] Chạy `npm run test` → framework hoạt động (không cần test nào pass, chỉ cần framework ready)

### Migration

- [ ] Task 1: Tạo migration `get_or_create_schedule_week` RPC function
  - [ ] File: `supabase/migrations/20260324000008_get_or_create_schedule_week.sql`
  - [ ] `CREATE OR REPLACE FUNCTION public.get_or_create_schedule_week(p_week_of date)` với `SECURITY DEFINER SET search_path = ''`
  - [ ] Function tính deadline từ `tenants.schedule_deadline_day` + `schedule_deadline_hour` + tenant timezone
  - [ ] `INSERT INTO schedule_weeks ... ON CONFLICT (tenant_id, week_of) DO NOTHING` → RETURN id
  - [ ] Thêm `GRANT EXECUTE ON FUNCTION public.get_or_create_schedule_week(date) TO authenticated;`
  - [ ] Apply: `npx supabase db push --local`
  - [ ] Chạy: `npx supabase test db` → tất cả PASS

### Schema & Types

- [ ] Task 2: Tạo `src/features/schedule/schemas/schedule.schema.ts`
  - [ ] `slotFormSchema` — validate `slotDate: date string`, `startTime: "HH:MM"`, `endTime: "HH:MM"`, endTime > startTime, duration 30–720 phút
  - [ ] `scheduleSubmitSchema` — mảng `slotFormSchema`, min 0 items (cho phép schedule trống trong Story 2.4 context)

### Service Layer

- [ ] Task 3: Tạo `src/features/schedule/services/schedule.service.ts`
  - [ ] `getOrCreateScheduleWeek(weekOf: string): Promise<ScheduleWeek>` — gọi RPC `get_or_create_schedule_week`
  - [ ] `getWeekSlots(tenantId: string, weekId: string): Promise<ScheduleSlot[]>` — query `schedule_slots` với `week_id = weekId AND user_id = auth.uid()`
  - [ ] `upsertWeekSlots(weekId: string, slots: SlotInput[]): Promise<void>` — DELETE existing slots → INSERT new slots + INSERT `schedule_slot_changes` (change_type: 'created')
  - [ ] Tất cả functions đều `throw error` khi Supabase trả về lỗi — KHÔNG return `{ success, error }`

### Hooks

- [ ] Task 4: Tạo `src/features/schedule/hooks/use-schedule-week.ts`
  - [ ] `useScheduleWeek(weekOf: string)` — useQuery với `QUERY_KEYS.scheduleWeeks`, gọi `getOrCreateScheduleWeek`
  - [ ] `staleTime: 5 * 60 * 1000`

- [ ] Task 5: Tạo `src/features/schedule/hooks/use-schedule-slots.ts`
  - [ ] `useScheduleSlots(weekId: string | undefined)` — useQuery với `QUERY_KEYS.scheduleSlots`, `enabled: !!weekId`
  - [ ] `staleTime: 30 * 1000`

- [ ] Task 6: Tạo `src/features/schedule/hooks/use-upsert-slots.ts`
  - [ ] `useUpsertSlots()` — useMutation gọi `upsertWeekSlots`
  - [ ] `onSuccess`: `toast.success('Đã lưu lịch tuần')` + invalidate `[QUERY_KEYS.scheduleSlots]`
  - [ ] `onError`: `toast.error('Không thể lưu lịch: ' + error.message)`

### Components

- [ ] Task 7: Tạo `src/features/schedule/components/ScheduleDeadlineBadge.tsx`
  - [ ] Props: `deadline: string (timestamptz)`, `userTimezone: string`
  - [ ] Display deadline trong user timezone dùng `format(toZonedTime(deadline, userTimezone), 'EEE dd/MM HH:mm', { locale: vi })`
  - [ ] Nếu `now > deadline`: badge màu đỏ "Đã qua deadline"
  - [ ] Nếu `now < deadline && (deadline - now) < 24h`: badge màu vàng "Deadline sắp đến"
  - [ ] Nếu `now < deadline`: badge màu xanh với thời gian còn lại

- [ ] Task 8: Tạo `src/features/schedule/components/SlotForm.tsx`
  - [ ] Form để add/edit một time slot
  - [ ] Fields: ngày trong tuần (select), start time (select, bước 30 phút, 00:00–23:30), end time (select, phải > start time)
  - [ ] Validate: duration 30–720 phút; hiển thị duration khi user chọn times ("2 giờ 30 phút")
  - [ ] Overnight support: end time có thể là ngày hôm sau (dropdown riêng "ngày hôm sau" ở end time)
  - [ ] Submit: tính `start_time (UTC)` và `duration_minutes` trước khi pass lên
  - [ ] Client-side overlap check trước khi submit: so sánh với `existingSlots` prop

- [ ] Task 9: Tạo `src/features/schedule/components/ScheduleGrid.tsx`
  - [ ] Props: `slots: ScheduleSlot[]`, `weekOf: string`, `userTimezone: string`, `onAddSlot: () => void`, `onDeleteSlot: (slotId: string) => void`
  - [ ] Desktop (>= 768px): 7-column grid (Mon–Sun), mỗi slot là card hiển thị start + duration theo user timezone
  - [ ] Mobile (< 768px): list view theo ngày
  - [ ] Dùng `useIsMobile()` hook (đã có trong codebase từ SpeakPing base)
  - [ ] Empty state per day: hiển thị "+ Thêm slot" button
  - [ ] Hiển thị tổng hours trong tuần ở footer

### Route

- [ ] Task 10: Tạo `src/routes/_app/schedule.tsx`
  - [ ] `createFileRoute('/_app/schedule')`
  - [ ] Load: `useScheduleWeek(currentWeekOf)` → week data
  - [ ] Load: `useScheduleSlots(week?.id)` → slots
  - [ ] Auth store: `useAuthStore` để lấy `user.timezone` cho display
  - [ ] Tenant store: `useTenantStore` để lấy `activeTenantId`
  - [ ] State: `isAddSlotOpen: boolean`, controlled SlotForm dialog
  - [ ] Render: `<ScheduleDeadlineBadge>` + `<ScheduleGrid>` + FAB / button "Thêm slot"
  - [ ] Submit flow: `useUpsertSlots` để save, invalidate query

### Navigation

- [ ] Task 11: Thêm "Lịch làm việc" vào sidebar navigation
  - [ ] Mở `src/components/layout/sidebar-data.tsx` (hoặc tương đương — kiểm tra file thực tế)
  - [ ] Thêm nav item: icon `Calendar`, label `"Lịch làm việc"`, link `ROUTES.app.schedule`

## Dev Notes

### Foundation từ Epic 1 — ĐÃ CÓ SẴN, KHÔNG TẠO LẠI

| File | Trạng thái | Ghi chú |
|------|-----------|---------|
| `src/lib/supabase-browser.ts` | ✅ singleton | CHỈ dùng cái này, KHÔNG `createClient()` thêm |
| `src/stores/auth-store.ts` | ✅ | `user.id`, `user.timezone` (nếu user có field) — hoặc query từ `users` table |
| `src/stores/tenant-store.ts` | ✅ | `activeTenantId`, `activeRole` |
| `src/lib/query-keys.ts` | ✅ | `QUERY_KEYS.scheduleSlots`, `QUERY_KEYS.scheduleWeeks` đã có |
| `src/lib/routes.ts` | ✅ | `ROUTES.app.schedule = '/schedule'` đã có |
| `src/lib/permissions.ts` | ✅ | `'submitDailyReport'`, `'manageSchedule'` đã có |
| `src/lib/timezones.ts` | ✅ | IANA timezone list đã extract từ Story 1.7 |
| `date-fns` + `date-fns-tz` | ✅ v4.1.0 / v3.2.0 | Dùng cho timezone conversion |
| `useIsMobile()` | ✅ | Từ SpeakPing base — tìm trong codebase, dùng lại |
| `supabase-types.ts` | ✅ | `Tables<'schedule_slots'>`, `Tables<'schedule_weeks'>` đã có |

### Database Schema — Đọc Trước Khi Code

#### schedule_weeks
```sql
id          uuid PRIMARY KEY
tenant_id   uuid FK tenants(id)
week_of     date NOT NULL  -- PHẢI là Monday; CONSTRAINT: EXTRACT(DOW FROM week_of) = 1
deadline    timestamptz NOT NULL  -- deadline để submit
is_locked   boolean DEFAULT false
created_at  timestamptz
UNIQUE (tenant_id, week_of)
```
**RLS CRITICAL:** Members KHÔNG thể INSERT schedule_weeks. Chỉ manager/owner mới được. → Dev phải gọi RPC `get_or_create_schedule_week(week_of)` (SECURITY DEFINER) để tạo week nếu chưa có.

#### schedule_slots
```sql
id               uuid PRIMARY KEY
tenant_id        uuid FK tenants(id)
user_id          uuid FK users(id)
week_id          uuid FK schedule_weeks(id) ON DELETE CASCADE
slot_date        date NOT NULL  -- ngày trong TENANT TIMEZONE (không phải UTC)
start_time       timestamptz NOT NULL  -- UTC absolute time
duration_minutes smallint NOT NULL CHECK (30 <= duration_minutes <= 720)
created_at, updated_at timestamptz
```

#### schedule_slot_changes (append-only audit trail)
```sql
id          uuid PRIMARY KEY
tenant_id   uuid FK tenants(id)
slot_id     uuid FK schedule_slots(id) ON DELETE CASCADE
changed_by  uuid FK users(id)  -- PHẢI là auth.uid()
change_type slot_change_type ENUM ('created','updated','deleted','emergency_override')
reason      text NOT NULL DEFAULT ''  -- required cho updated/deleted/emergency_override
created_at  timestamptz  -- KHÔNG có updated_at — immutable
```

### DB Triggers — KHÔNG Tạo Lại Client-Side Logic Trùng Lặp

**Trigger `validate_slot_date` (Migration 006):** Khi INSERT/UPDATE schedule_slots, DB tự validate:
```sql
expected_dt := (NEW.start_time AT TIME ZONE tenant_tz)::date;
IF NEW.slot_date <> expected_dt THEN RAISE EXCEPTION ...
```
→ Client PHẢI tính `slot_date` đúng: `(start_time AT TIME ZONE tenant.timezone)::date`

**Trigger `check_slot_overlap` (Migration 006):** DB tự từ chối slots overlap:
```sql
(s.start_time, s.start_time + interval) OVERLAPS (NEW.start_time, NEW.start_time + interval)
```
→ Client cũng cần check trước để UX response < 1 giây (không chờ DB round-trip).

### UTC Conversion — Quy Trình Bắt Buộc

```typescript
import { toZonedTime, fromZonedTime, format } from 'date-fns-tz'
import { startOfISOWeek, addDays } from 'date-fns'

// Lấy Monday của tuần hiện tại (week_of)
const currentWeekOf = format(startOfISOWeek(new Date()), 'yyyy-MM-dd')

// Chuyển user input (ngày + giờ trong user timezone) → UTC start_time
// User chọn: "2026-03-30 09:00" trong timezone "Asia/Ho_Chi_Minh"
const userLocalDateTimeStr = `${slotDate}T${startTime}:00`  // "2026-03-30T09:00:00"
const startTimeUTC = fromZonedTime(userLocalDateTimeStr, userTimezone)  // UTC Date object
// startTimeUTC = 2026-03-30T02:00:00Z

// Tính slot_date (PHẢI dùng TENANT timezone, không phải user timezone)
// slot_date = date khi slot bắt đầu trong TENANT timezone
const slotDateForDB = format(toZonedTime(startTimeUTC, tenantTimezone), 'yyyy-MM-dd')

// Tính duration_minutes
const endTimeUTC = fromZonedTime(`${slotDate}T${endTime}:00`, userTimezone)
let durationMs = endTimeUTC.getTime() - startTimeUTC.getTime()
if (durationMs <= 0) durationMs += 24 * 60 * 60 * 1000  // overnight: cộng thêm 1 ngày
const durationMinutes = Math.round(durationMs / 60000)

// Display (ngược lại): UTC → user timezone
const displayTime = format(toZonedTime(slot.start_time, userTimezone), 'HH:mm')
```

⚠️ **CRITICAL:** Dùng TENANT timezone (từ `tenants.timezone`) để tính `slot_date`, KHÔNG phải `user.timezone`. DB trigger cũng dùng tenant timezone để validate.

### Overnight Slot Logic

```typescript
// User chọn: Thứ Hai, 22:00 → 02:00 "ngày hôm sau"
// SlotForm cần hỗ trợ end_time là ngày tiếp theo
// Khi end_time < start_time → overnight = true
// duration_minutes = (24h - start) + end = (24*60 - 22*60) + 2*60 = 360 phút

// slot_date: "2026-03-30" (Monday) — ngày BẮT ĐẦU
// start_time: "2026-03-30T15:00:00Z" (22:00 Ho_Chi_Minh = 15:00 UTC)
// duration_minutes: 240 (22:00 → 02:00 = 4 giờ)
```

### get_or_create_schedule_week — Migration Cần Tạo

```sql
-- File: supabase/migrations/20260324000008_get_or_create_schedule_week.sql

CREATE OR REPLACE FUNCTION public.get_or_create_schedule_week(p_week_of date)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_tenant_id     uuid;
  v_week_id       uuid;
  v_deadline      timestamptz;
  v_deadline_day  smallint;
  v_deadline_hour smallint;
  v_tenant_tz     text;
  v_week_start    date;
  v_deadline_date date;
BEGIN
  v_tenant_id := public.current_tenant_id();

  -- Lấy cấu hình deadline từ tenant
  SELECT schedule_deadline_day, schedule_deadline_hour, timezone
  INTO   v_deadline_day, v_deadline_hour, v_tenant_tz
  FROM   public.tenants
  WHERE  id = v_tenant_id;

  -- Tính ngày deadline: p_week_of (Monday) + offset days đến deadline_day
  -- schedule_deadline_day: 0=Sun, 1=Mon, ... 6=Sat
  -- Deadline là cuối tuần chứa p_week_of, tức Monday + (deadline_day - 1) mod 7
  -- Ví dụ: deadline_day=0 (Sun) → p_week_of + 6 ngày (Sunday của tuần đó)
  v_week_start := p_week_of;
  v_deadline_date := v_week_start + ((v_deadline_day - 1 + 7) % 7 + 1)::int;
  -- Xây dựng timestamptz deadline theo tenant timezone
  v_deadline := (v_deadline_date::text || ' ' || v_deadline_hour::text || ':59:00')::timestamp
                AT TIME ZONE v_tenant_tz;

  -- Upsert schedule_week
  INSERT INTO public.schedule_weeks (tenant_id, week_of, deadline, is_locked)
  VALUES (v_tenant_id, p_week_of, v_deadline, false)
  ON CONFLICT (tenant_id, week_of) DO NOTHING
  RETURNING id INTO v_week_id;

  -- Nếu đã tồn tại → lấy id
  IF v_week_id IS NULL THEN
    SELECT id INTO v_week_id
    FROM   public.schedule_weeks
    WHERE  tenant_id = v_tenant_id AND week_of = p_week_of;
  END IF;

  RETURN v_week_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_schedule_week(date) TO authenticated;
```

⚠️ **Lưu ý deadline calculation:** Logic trên là reference implementation — dev cần test với các combinations của `schedule_deadline_day` khác nhau. Ví dụ mặc định: `deadline_day=0 (Sun)`, `deadline_hour=23` → deadline là Chủ nhật 23:59 của tuần đó.

### Client-Side Overlap Check

```typescript
// Trước khi submit, check overlap trong local state
function hasOverlap(newSlot: SlotInput, existingSlots: ScheduleSlot[]): boolean {
  const newEnd = newSlot.startTime + newSlot.durationMinutes * 60 * 1000
  return existingSlots.some(existing => {
    if (existing.id === newSlot.id) return false  // bỏ qua chính nó khi edit
    const existStart = new Date(existing.start_time).getTime()
    const existEnd = existStart + existing.duration_minutes * 60 * 1000
    // OVERLAPS logic: A overlaps B iff A.start < B.end AND A.end > B.start
    return newSlot.startTimeMs < existEnd && newEnd > existStart
  })
}
// Error message: "Thời gian này bị trùng với slot khác."
```

### upsertWeekSlots — Transaction Strategy

```typescript
// Không có explicit transaction trong Supabase client — dùng RPC nếu cần atomicity
// Hoặc: DELETE all → INSERT all (acceptable for MVP — nếu INSERT fail, user thấy toast error)
// Chú ý: DELETE existing slots sẽ CASCADE delete schedule_slot_changes liên quan
// → Với Story 2.1 (first submit), không có changes history nên OK
// → Story 2.3 sẽ xử lý edit với reason — không dùng delete/re-insert approach

export const upsertWeekSlots = async (
  weekId: string,
  tenantId: string,
  userId: string,
  slots: SlotInput[]
): Promise<void> => {
  // 1. Delete existing slots for this user+week
  const { error: deleteError } = await supabase
    .from('schedule_slots')
    .delete()
    .eq('week_id', weekId)
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
  if (deleteError) throw deleteError

  if (slots.length === 0) return  // Lưu lịch trống OK

  // 2. Insert new slots
  const { data: insertedSlots, error: insertError } = await supabase
    .from('schedule_slots')
    .insert(slots.map(s => ({
      tenant_id: tenantId,
      user_id: userId,
      week_id: weekId,
      slot_date: s.slotDate,
      start_time: s.startTimeUTC.toISOString(),
      duration_minutes: s.durationMinutes,
    })))
    .select('id')
  if (insertError) throw insertError

  // 3. Insert audit trail (change_type: 'created')
  if (insertedSlots && insertedSlots.length > 0) {
    const { error: auditError } = await supabase
      .from('schedule_slot_changes')
      .insert(insertedSlots.map(s => ({
        tenant_id: tenantId,
        slot_id: s.id,
        changed_by: userId,
        change_type: 'created' as const,
        reason: '',  // reason optional cho 'created'
      })))
    if (auditError) throw auditError
  }
}
```

### Tenant Timezone vs User Timezone

| Dùng khi nào | Timezone |
|-------------|---------|
| Tính `slot_date` để lưu DB | **Tenant timezone** (`tenants.timezone`) |
| Validate `slot_date` trong DB trigger | **Tenant timezone** |
| Display time slots cho user | **User timezone** (`users.timezone`) |
| Tính deadline display | **User timezone** |

Lấy tenant timezone: từ query `SELECT timezone FROM tenants WHERE id = activeTenantId`. Có thể cache trong tenant store hoặc separate useQuery với staleTime dài.

### File Structure Expected

```
src/features/schedule/
├── services/
│   └── schedule.service.ts        # getOrCreateScheduleWeek, getWeekSlots, upsertWeekSlots
├── hooks/
│   ├── use-schedule-week.ts       # useQuery cho schedule_weeks
│   ├── use-schedule-slots.ts      # useQuery cho schedule_slots
│   └── use-upsert-slots.ts        # useMutation để submit
├── components/
│   ├── ScheduleDeadlineBadge.tsx  # Deadline countdown badge
│   ├── SlotForm.tsx               # Add/edit slot dialog
│   └── ScheduleGrid.tsx           # 7-day grid view (desktop) / list (mobile)
└── schemas/
    └── schedule.schema.ts         # slotFormSchema, scheduleSubmitSchema

src/routes/_app/
└── schedule.tsx                   # Route /schedule

supabase/migrations/
└── 20260324000008_get_or_create_schedule_week.sql  # RPC function (NEW)
```

### Patterns từ Epic 1 — Tuân Theo Bắt Buộc

```typescript
// ✅ Service pattern — named export, throw on error
export const ScheduleService = {
  getOrCreateScheduleWeek: async (weekOf: string): Promise<Tables<'schedule_weeks'>> => {
    const { data, error } = await supabase.rpc('get_or_create_schedule_week', { p_week_of: weekOf })
    if (error) throw error
    // rpc returns uuid, sau đó query week details
    const { data: week, error: weekError } = await supabase
      .from('schedule_weeks')
      .select('*')
      .eq('id', data)
      .single()
    if (weekError) throw weekError
    return week
  },
}

// ✅ TypeScript types — dùng từ generated types
import type { Tables, TablesInsert } from '@/lib/supabase-types'
type ScheduleSlot = Tables<'schedule_slots'>
type ScheduleWeek = Tables<'schedule_weeks'>

// ✅ cn() cho className
import { cn } from '@/lib/utils'

// ✅ Toast — chỉ sonner
import { toast } from 'sonner'

// ✅ Named export only — không default export
export function ScheduleGrid(...) {}

// ✅ QUERY_KEYS — không hardcode
queryKey: [QUERY_KEYS.scheduleSlots, weekId]
queryKey: [QUERY_KEYS.scheduleWeeks, weekOf]

// ❌ Không làm
export default function ScheduleGrid() {}  // no default export
import { createClient } from '@supabase/supabase-js'  // no new clients
return { success: true, data }  // no wrapper objects
```

### KHÔNG làm trong Story 2.1 (scope boundary)

- ❌ Template load từ tuần trước → Story 2.2
- ❌ Edit slot với reason → Story 2.3
- ❌ Deadline lock check khi edit → Story 2.3
- ❌ Emergency override → Story 2.3
- ❌ Auto-create empty schedule → Story 2.4 + pg_cron
- ❌ Notify manager về schedule change → Story 2.3 (edge function)
- ❌ `TeamScheduleView` (manager view) → Story 3.1

### NFR Requirements cho Story này

- **NFR4:** Schedule registration form respond < 1 giây sau user interaction → client-side overlap check (không chờ DB), optimistic UI
- **NFR9:** Tenant data isolated → `tenant_id` present trên tất cả inserts, RLS là source of truth
- **NFR11:** Validate inputs: duration check (30–720 min), date range (chỉ tuần hiện tại), time step (bội số 30 phút)

### DB Tests Bắt Buộc — Từ CLAUDE.md + Epic 1 Retro

Sau khi apply migration mới (`get_or_create_schedule_week`):

```bash
npx supabase test db
```

Tất cả tests phải PASS. Nếu có `not ok` → fix migration → chạy lại. KHÔNG mark story done nếu DB tests chưa pass.

Viết ít nhất 1 pgTAP test kiểm tra `get_or_create_schedule_week` tại `supabase/tests/`:
```sql
-- supabase/tests/test_get_or_create_schedule_week.sql
BEGIN;
SELECT plan(3);

-- Test 1: Gọi function với week_of hợp lệ (Monday) → trả về uuid
-- Test 2: Gọi lần 2 với cùng week_of → trả về cùng uuid (idempotent)
-- Test 3: Gọi với non-Monday date → constraint error (week_of phải là Monday)

SELECT finish();
ROLLBACK;
```

### Lưu Ý Quan Trọng về Sidebar Navigation

Trước khi thêm nav item, tìm file sidebar data thực tế:
```bash
# Kiểm tra nơi nav items được define
find src -name "*.tsx" | xargs grep -l "schedule\|navGroup\|sidebarData" 2>/dev/null
```
Không hardcode path — đọc cấu trúc sidebar hiện tại rồi follow pattern.

### Vitest Unit Test Recommendations (Không Bắt Buộc, Nhưng Khuyến Khích)

Với schedule logic phức tạp (timezone, overnight, overlap), nên viết unit tests:
```typescript
// src/features/schedule/__tests__/timezone-utils.test.ts
describe('slot UTC conversion', () => {
  it('converts Ho_Chi_Minh 09:00 to UTC 02:00', ...)
  it('handles overnight slot: 22:00 → 02:00 next day', ...)
  it('calculates slot_date from tenant timezone', ...)
})

describe('overlap detection', () => {
  it('detects direct overlap', ...)
  it('allows adjacent slots (end = next start)', ...)
  it('handles overnight slots overlapping', ...)
})
```
Framework đã setup từ `chore(pre-epic2)` commit.
