# Story 8.9: Highlight Current Timeslot

Status: done
Epic: 8 — UX Polish & Feature Completeness
Story ID: 8.9
Story Key: 8-9-highlight-current-timeslot
Created: 2026-03-25

---

## Story

Là một user đang xem Team Schedule (tuần hiện tại),
tôi muốn thấy khung giờ hiện tại được highlight rõ ràng trong heatmap,
để tôi có thể nhìn ngay ra team đang làm gì lúc này mà không cần tự tính giờ.

---

## Acceptance Criteria

**Given** user đang xem `/team-schedule` với tuần hiện tại
**When** heatmap render
**Then** hàng timeslot tương ứng với giờ hiện tại (trong `displayTimezone`) được highlight (border trái + bg phân biệt)
**And** cột ngày hôm nay trong header được highlight (text primary color)
**And** ô giao nhau (hàng giờ hiện tại × cột hôm nay) có styling đậm hơn các ô khác trong hàng

**Given** user đang xem `/team-schedule` nhưng navigate sang tuần khác (quá khứ / tương lai)
**When** heatmap render
**Then** KHÔNG có bất kỳ highlight nào — chỉ highlight khi đang xem đúng tuần hiện tại

**Given** giờ hiện tại nằm ngoài display range của heatmap (trước `slotStart` hoặc sau `slotEnd`)
**When** heatmap render
**Then** KHÔNG có highlight nào — không tạo row giả ngoài range

**Given** user thay đổi `displayTimezone` (timezone selector)
**When** heatmap re-render
**Then** highlight được tính lại theo timezone mới (current decimal hour trong timezone mới)

---

## Tasks / Subtasks

- [x] Thêm utility functions vào `dashboard.utils.ts` (AC: #1, #4)
  - [x] `getTodayISO(timezone: string): string` — trả "YYYY-MM-DD" trong timezone, injectable nowUTC
  - [x] `getCurrentDecimalHour(timezone: string, nowUTC?: Date): number` — trả decimal hour (e.g. 14.5 = 14:30), injectable

- [x] Update `TeamScheduleHeatmap.tsx` — thêm prop + highlight logic (AC: #1, #2, #3, #4)
  - [x] Thêm `isCurrentWeek?: boolean` vào `TeamScheduleHeatmapProps`
  - [x] Compute `todayISO` và `nowDecimalHour` trong `displayTimezone` (chỉ khi `isCurrentWeek`)
  - [x] Header: nếu `isCurrentWeek` và `day === todayISO` → thêm `text-primary font-bold` vào `<th>`
  - [x] Row: nếu `isCurrentWeek` và `nowDecimalHour >= h && nowDecimalHour < h + STEP` → `isCurrentSlot = true`
  - [x] Time label cell: nếu `isCurrentSlot` → thêm `border-l-2 border-l-primary` + thêm dot indicator `●`
  - [x] `HeatmapCell`: thêm prop `isCurrentDayAndSlot?: boolean` → nếu true, thêm `ring-1 ring-inset ring-primary/30` vào td

- [x] Update `TeamDashboard.tsx` — truyền `isCurrentWeek` prop (AC: #2)
  - [x] Truyền `isCurrentWeek={isViewingCurrentWeek}` vào `<TeamScheduleHeatmap />`

---

## Dev Notes

### Phạm vi thay đổi — chỉ 3 files

| File | Thay đổi |
|------|----------|
| `src/features/dashboard/utils/dashboard.utils.ts` | Thêm 2 utility functions |
| `src/features/dashboard/components/TeamScheduleHeatmap.tsx` | Thêm prop + highlight logic |
| `src/features/dashboard/components/TeamDashboard.tsx` | Truyền prop `isCurrentWeek` |

**KHÔNG sửa:**
- `src/features/schedule/components/ScheduleGrid.tsx` — đây là personal schedule (my-schedule), không liên quan
- `src/routes/_app/team-schedule.tsx` — thin route file, không logic
- Bất kỳ migration DB, Edge Function, hay RPC nào

### Current Implementation Analysis

**`TeamScheduleHeatmap.tsx` (đọc kỹ trước khi sửa):**

```
Rows   = timeslot decimal hours, e.g. [8, 8.5, 9, 9.5, ..., 20]  — STEP = 0.5
Cols   = 7 ngày trong tuần (T2–CN)
Key    = `${dateISO}:${h}` — e.g. "2026-03-24:9.5"
Range  = [slotStart, slotEnd] từ computeDisplayRange() — dynamic, expand theo actual slots
```

**`computeDisplayRange()`** trong `dashboard.utils.ts`:
- Nếu không có slots → default `[8, 20]`
- Nếu có slots → expand để cover overnight slots
- Guard: chỉ highlight khi `nowDecimalHour >= slotStart && nowDecimalHour < slotEnd`

**`buildCellUserMap()`** key format: `"${dateISO}:${h}"` — `h` là decimal (e.g. `9.5` không phải `9:30`)

### Utility Functions cần thêm (dashboard.utils.ts)

```typescript
/**
 * getTodayISO — trả "YYYY-MM-DD" của ngày hôm nay trong timezone.
 * @param timezone IANA timezone string
 * @param nowUTC   injectable cho test (mặc định = new Date())
 */
export function getTodayISO(timezone: string, nowUTC?: Date): string {
  return format(toZonedTime(nowUTC ?? new Date(), timezone), 'yyyy-MM-dd')
}

/**
 * getCurrentDecimalHour — trả giờ hiện tại dạng decimal trong timezone.
 * Ví dụ: 14:30 → 14.5, 09:00 → 9.0
 * @param timezone IANA timezone string
 * @param nowUTC   injectable cho test
 */
export function getCurrentDecimalHour(timezone: string, nowUTC?: Date): number {
  const zoned = toZonedTime(nowUTC ?? new Date(), timezone)
  const h = parseInt(format(zoned, 'H'), 10)
  const m = parseInt(format(zoned, 'm'), 10)
  return h + m / 60
}
```

**Import pattern** — `format` và `toZonedTime` đã có sẵn trong file, KHÔNG cần thêm import.

### Highlight Logic trong TeamScheduleHeatmap.tsx

```typescript
// Tính ở đầu component, sau khi parse weekStart:
const todayISO = isCurrentWeek ? getTodayISO(displayTimezone) : null
const nowDecimalHour = isCurrentWeek ? getCurrentDecimalHour(displayTimezone) : null

// Trong row loop:
const isCurrentSlot =
  isCurrentWeek &&
  nowDecimalHour !== null &&
  nowDecimalHour >= h &&
  nowDecimalHour < h + STEP &&
  nowDecimalHour >= slotStart &&   // guard: trong display range
  nowDecimalHour < slotEnd

// Header: thêm highlight cho cột hôm nay
const isToday = (day: Date) =>
  isCurrentWeek && format(day, 'yyyy-MM-dd') === todayISO
```

**Time label cell** khi `isCurrentSlot`:

```tsx
<td className={[
  'border-r border-border/40 px-1 align-middle whitespace-nowrap',
  'text-[10px] tabular-nums font-medium',
  isHalfHour
    ? 'border-b border-b-border/20 text-muted-foreground/40'
    : 'border-b border-b-border/40',
  isCurrentSlot
    ? 'border-l-2 border-l-primary text-primary font-semibold'  // highlight override
    : 'text-muted-foreground',
].join(' ')}>
  {isHour ? (
    isCurrentSlot
      ? <span className="flex items-center gap-0.5"><span className="text-primary">●</span>{formatTimeLabel(h)}</span>
      : formatTimeLabel(h)
  ) : ''}
</td>
```

**`HeatmapCell`** — thêm prop `isCurrentDayAndSlot`:

```tsx
interface HeatmapCellProps {
  userIds: string[]
  memberMap: Map<string, TenantMemberWithUser>
  isHalfHour: boolean
  isCurrentDayAndSlot?: boolean   // ← THÊM
}

// Trong td className, khi isCurrentDayAndSlot:
const ringClass = isCurrentDayAndSlot ? 'ring-1 ring-inset ring-primary/30' : ''
// <td className={`h-7 px-0.5 align-middle ${bgClass} ${borderClass} ${ringClass}`}>
```

**Truyền vào cell:**

```tsx
<HeatmapCell
  key={dateISO}
  userIds={userIds}
  memberMap={memberMap}
  isHalfHour={isHalfHour}
  isCurrentDayAndSlot={isCurrentSlot && dateISO === todayISO}
/>
```

**Header column highlight:**

```tsx
<th
  key={i}
  className={[
    'border-b border-r border-border/40 py-1.5 px-0 text-center text-[11px]',
    isToday(day) ? 'text-primary font-bold' : 'font-medium text-muted-foreground',
  ].join(' ')}
>
  <div className="font-semibold">{DAY_LABELS[i]}</div>
  <div className={isToday(day) ? 'text-primary/70 tabular-nums' : 'text-muted-foreground/60 tabular-nums'}>
    {format(day, 'dd/MM')}
  </div>
</th>
```

### TeamDashboard.tsx — chỉ thêm 1 prop

```tsx
// Hiện tại:
<TeamScheduleHeatmap
  members={members}
  slots={slots}
  weekOf={currentWeekOf}
  displayTimezone={displayTimezone}
/>

// Sau khi sửa:
<TeamScheduleHeatmap
  members={members}
  slots={slots}
  weekOf={currentWeekOf}
  displayTimezone={displayTimezone}
  isCurrentWeek={isViewingCurrentWeek}   // ← THÊM
/>
```

### Import cần thêm trong TeamScheduleHeatmap.tsx

```typescript
// Thêm vào import từ dashboard.utils:
import {
  buildCellUserMap,
  computeDisplayRange,
  getHeatmapBgClass,
  getInitials,
  getTodayISO,              // ← THÊM
  getCurrentDecimalHour,    // ← THÊM
} from '../utils/dashboard.utils'
```

### Design Decisions

**Tại sao dùng `border-l-2` thay vì `bg-primary/5` cho row?**
- Heatmap đã có bg-blue-X cho density. Nếu thêm row bg thì 2 màu conflict trên same cell.
- `border-l-2 border-l-primary` trên time label cell + `ring-1 ring-inset ring-primary/30` trên intersection cell — visual rõ nhưng không conflict với heatmap colors.

**Tại sao inject `nowUTC` vào utility functions?**
- Testability: snapshot test có thể inject fixed time → deterministic
- Pattern giống `getOnlineMemberIds(slots, nowUTC?)` đã có trong cùng file (line 215)

**Tại sao STEP = 0.5 trong guard `nowDecimalHour < h + STEP`?**
- Khớp với heatmap step 30 phút — chỉ 1 row được highlight tại bất kỳ thời điểm nào
- Nếu 14:29 → `h=14` (row 14:00); nếu 14:30 → `h=14.5` (row 14:30) → chính xác

**Tại sao guard `nowDecimalHour >= slotStart && nowDecimalHour < slotEnd`?**
- Nếu current time ngoài display range (ví dụ: 07:00 nhưng range [8, 20]) → không highlight gì
- Tránh confusion khi user nhìn thấy highlight row nhưng row đó không visible trong viewport

### Wave 3 Context

Story này thuộc **Wave 3** — chạy sau Wave 2 hoàn thành (8-6, 8-7, 8-8 đều done).

**Route đã thay đổi sau 8-6:**
- `/dashboard` → `/team-schedule` (component: `TeamDashboard`)
- Component `TeamScheduleHeatmap` không đổi tên
- Sidebar label "Team Schedule" → route `/team-schedule`

**Layout đã có `PageContainer` từ 8-7** — `TeamDashboard` đã dùng `PageContainer variant='wide'`.

**Wave 3 parallel stories (không conflict với 8-9):**
- `8-10-user-avatar-upload`: migration + storage + `/account/profile` → không chạm dashboard
- `8-11-infinite-scroll`: notifications + incidents + report-history → không chạm dashboard

→ **Zero file conflict** với 8-10 và 8-11.

### Testing

**Manual test checklist:**
1. Mở `/team-schedule` lúc, ví dụ, 10:15 → row "10:00" phải có border trái primary + dot `●`
2. Cột hôm nay trong header phải có `text-primary font-bold`
3. Ô giao nhau (10:00 row × hôm nay col) phải có ring
4. Navigate sang tuần trước → tất cả highlight biến mất
5. Thay timezone selector sang timezone khác (+/- vài giờ) → highlight row di chuyển đúng

**Unit test (nếu viết):**

```typescript
// dashboard.utils.test.ts
describe('getTodayISO', () => {
  it('returns correct date in given timezone', () => {
    const fixedUTC = new Date('2026-03-25T16:00:00Z')  // 23:00 ICT
    expect(getTodayISO('Asia/Ho_Chi_Minh', fixedUTC)).toBe('2026-03-25')
    expect(getTodayISO('America/New_York', fixedUTC)).toBe('2026-03-25') // 12:00 EDT
  })
})

describe('getCurrentDecimalHour', () => {
  it('returns 14.5 for 14:30', () => {
    const fixedUTC = new Date('2026-03-25T07:30:00Z')  // 14:30 ICT
    expect(getCurrentDecimalHour('Asia/Ho_Chi_Minh', fixedUTC)).toBe(14.5)
  })
})
```

Test file tồn tại: `src/features/dashboard/__tests__/dashboard.test.ts` — thêm vào đây.

---

## Project Structure Notes

- Đúng pattern feature module: changes ở `features/dashboard/` (không sửa route file)
- `utils/dashboard.utils.ts` theo convention `{feature}.utils.ts`
- Utility functions follow injectable pattern (`nowUTC?: Date`) đã có trong `getOnlineMemberIds`
- Named exports only — không `export default`
- Không dùng barrel exports (`index.ts`)

### References

- [Source: src/features/dashboard/components/TeamScheduleHeatmap.tsx] — target component
- [Source: src/features/dashboard/components/TeamDashboard.tsx#isViewingCurrentWeek] — `isViewingCurrentWeek` state
- [Source: src/features/dashboard/utils/dashboard.utils.ts#getOnlineMemberIds] — injectable `nowUTC` pattern
- [Source: src/features/dashboard/utils/dashboard.utils.ts#computeDisplayRange] — dynamic [slotStart, slotEnd]
- [Source: architecture.md#Shared Constants] — `cn()` pattern (nếu dùng để join classNames)

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-5

### Debug Log References

_none — implementation straightforward, no blockers_

### Completion Notes List

- Thêm `getTodayISO(timezone, nowUTC?)` và `getCurrentDecimalHour(timezone, nowUTC?)` vào `dashboard.utils.ts` theo injectable pattern của `getOnlineMemberIds`. Import đã có (`format`, `toZonedTime`) — không cần thêm import mới.
- `TeamScheduleHeatmap.tsx`: thêm `isCurrentWeek?: boolean` prop (default `false`). Khi true: (1) header cột hôm nay highlight `text-primary font-bold`, (2) row giờ hiện tại hiện `border-l-2 border-l-primary` + dot `●`, (3) ô giao nhau (current row × today col) có `ring-1 ring-inset ring-primary/30`. Guard: chỉ highlight khi `nowDecimalHour` nằm trong `[slotStart, slotEnd)`.
- `TeamDashboard.tsx`: truyền `isCurrentWeek={isViewingCurrentWeek}` — state này đã tồn tại.
- Thêm 12 unit tests mới (`getTodayISO`: 6 tests, `getCurrentDecimalHour`: 7 tests) vào `dashboard.test.ts`.
- **290 tests passed, 0 failures**. TypeScript clean.

### File List

- `src/features/dashboard/utils/dashboard.utils.ts` — thêm `getTodayISO`, `getCurrentDecimalHour`
- `src/features/dashboard/components/TeamScheduleHeatmap.tsx` — highlight logic + `isCurrentWeek` prop
- `src/features/dashboard/components/TeamDashboard.tsx` — truyền `isCurrentWeek={isViewingCurrentWeek}`
- `src/features/dashboard/__tests__/dashboard.test.ts` — thêm tests cho 2 functions mới