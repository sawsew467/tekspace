# Story 9.7: Emergency Override UX Fix — `getSlotEditMode` started tier

**Story ID:** 9.7
**Story Key:** 9-7-emergency-override-ux-fix
**Epic:** 9 — Product Quality & Feature Completion
**Wave:** Wave 1 (bổ sung) — song song với 9-6 — **KHÔNG conflict với bất kỳ story nào khác**
**Status:** review
**Created:** 2026-03-26

---

## User Story

> Là một member của TekSpace, khi tôi cố sửa/xóa slot ca làm việc hôm nay mà ca đó đã bắt đầu (start_time đã qua), tôi muốn hệ thống mở đúng Emergency Override dialog thay vì dialog thường, để tôi có thể submit thành công thay vì nhận lỗi không rõ lý do.

---

## Acceptance Criteria

**AC1 — Slot hôm nay, đã bắt đầu, click Edit:**
Khi slot có `slot_date = today` và `start_time` đã qua (ví dụ: slot 01:30–05:30, hiện tại 12:00 trưa)
Khi member click Edit
Thì dialog mở với title "Emergency Override" (không phải "Chỉnh sửa ca làm việc")
Và có warning banner đỏ: "⚠️ Emergency Override — ca này đã bắt đầu..."
Và submit thành công với `isEmergencyOverride = true` gửi lên backend.

**AC2 — Slot hôm nay, đã bắt đầu, click Delete:**
Khi slot có `slot_date = today` và `start_time` đã qua
Khi member click Delete
Thì dialog mở với title "Xóa ca (Emergency Override)"
Và có warning banner đỏ
Và submit thành công với `isEmergencyOverride = true`.

**AC3 — Slot hôm nay, chưa bắt đầu — KHÔNG thay đổi:**
Khi slot có `slot_date = today` và `start_time` chưa qua (ví dụ: slot 14:00–18:00, hiện tại 12:00 trưa)
Khi member click Edit
Thì dialog mở bình thường "Chỉnh sửa ca làm việc" (Tier 2, require reason, không emergency)
Và không có emergency warning.

**AC4 — Slot quá khứ — KHÔNG thay đổi:**
Khi slot có `slot_date < today`
Thì Edit/Delete button vẫn ẩn (Tier 1 locked — không thay đổi).

---

## 🔍 Root Cause Analysis (BẮT BUỘC đọc trước khi code)

### Mismatch Frontend vs Backend lock logic

**Frontend** (`getSlotEditMode` hiện tại — `src/features/schedule/utils/schedule.utils.ts`):
```ts
if (slotDate < todayInUserTz) return 'locked'          // date-only comparison
if (slotDate < nextMondayISO) return 'reason-required'  // KHÔNG check start_time
return 'free'
```

**Backend RPC** check: `now() >= start_time` (timestamp-level).

**Kịch bản bug:**
- Slot 01:30–05:30, `slot_date = '2026-03-26'`, `start_time = '2026-03-25T18:30:00Z'` (01:30 ICT)
- Hiện tại: 12:00 ICT (`now = 2026-03-26T05:00:00Z`)
- Frontend: `'2026-03-26' < '2026-03-26'` = false → Tier 2 → mở regular edit dialog
- Backend: `05:00Z >= 18:30Z` (hôm qua) = true → exception: "Slot đã bị khóa. Dùng Emergency Override"
- User không có đường nào dùng Emergency Override — UI không route đúng.

---

## 🔧 Fix Approach (chi tiết từng file)

### Fix 1 — `schedule.utils.ts`: Thêm `'started'` tier

**Signature thay đổi** (BREAKING): thêm `startTime: string` làm param thứ 2.

```ts
// CŨ:
export type SlotEditMode = 'locked' | 'reason-required' | 'free'
export function getSlotEditMode(slotDate: string, userTimezone: string): SlotEditMode

// MỚI:
export type SlotEditMode = 'locked' | 'started' | 'reason-required' | 'free'
export function getSlotEditMode(slotDate: string, startTime: string, userTimezone: string): SlotEditMode
```

**Logic tier mới:**
```
locked          → slot_date < today                                   → ẩn button
started         → slot_date = today AND new Date(startTime) < now()   → Emergency Override dialog
reason-required → slot_date = today AND new Date(startTime) >= now()  → regular edit + reason
                  HOẶC slot_date là ngày còn lại trong tuần (T3–CN)
free            → slot_date >= next_monday                            → direct edit, no reason
```

**Implementation:**
```ts
export function getSlotEditMode(
  slotDate: string,
  startTime: string,       // ISO timestamp từ slot.start_time (UTC)
  userTimezone: string,
): SlotEditMode {
  const now = new Date()
  const todayInUserTz = format(toZonedTime(now, userTimezone), 'yyyy-MM-dd')
  const todayDate = parseISO(todayInUserTz)
  const dayOfWeek = todayDate.getDay()
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
  const nextMondayISO = format(addDays(todayDate, daysUntilMonday), 'yyyy-MM-dd')

  if (slotDate < todayInUserTz) return 'locked'
  if (slotDate === todayInUserTz && new Date(startTime) < now) return 'started'
  if (slotDate < nextMondayISO) return 'reason-required'
  return 'free'
}
```

**⚠️ Lưu ý:** `new Date(startTime)` dùng UTC epoch comparison với `now` (UTC) — timezone-safe vì cả hai đều là UTC absolute timestamps.

---

### Fix 2 — `my-schedule.tsx`: 5 thay đổi nhỏ

**File:** `src/routes/_app/my-schedule.tsx`

#### 2a. Thêm `deletingSlotMode` state

Hiện tại chỉ có `editingSlotMode`, không có state tương tự cho delete. Thêm:

```ts
// Sau dòng: const [editingSlotMode, setEditingSlotMode] = useState<SlotEditMode>('free')
const [deletingSlotMode, setDeletingSlotMode] = useState<SlotEditMode>('reason-required')
```

#### 2b. Update `handleEditSlot` — thêm `started` case

```ts
function handleEditSlot(slotId: string) {
  const slot = findSlot(slotId)
  if (!slot) return
  const mode = getSlotEditMode(slot.slot_date, slot.start_time, userTimezone)  // thêm slot.start_time

  if (mode === 'started' || mode === 'reason-required') {
    // Tier 2+started: mở EditSlotDialog (mode xác định isEmergency và routing)
    setEditingSlot(slot)
    setEditingSlotMode(mode)
    setEditDialogOpen(true)
  } else if (mode === 'free') {
    setEditingSlot(slot)
    setEditingSlotMode(mode)
    setEditDialogOpen(true)
  }
  // Tier 1 (locked): không làm gì
}
```

#### 2c. Update `handleDeleteSlot` — thêm `started` case

```ts
function handleDeleteSlot(slotId: string) {
  const slot = findSlot(slotId)
  if (!slot) return
  const mode = getSlotEditMode(slot.slot_date, slot.start_time, userTimezone)  // thêm slot.start_time

  if (mode === 'started' || mode === 'reason-required') {
    // Tier 2+started: mở DeleteSlotDialog
    setDeletingSlot(slot)
    setDeletingSlotMode(mode)   // capture mode
    setDeleteDialogOpen(true)
  } else if (mode === 'free') {
    // Tier 3: direct delete — không cần dialog
    deleteSlotDirect.mutate({ slotId })
  }
  // Tier 1 (locked): không làm gì
}
```

#### 2d. Update `handleEditSubmit` — fix `isEmergencyOverride` hardcoded false

```ts
// CŨ (dòng ~290):
updateSlot.mutate({
  ...
  isEmergencyOverride: false,   // BUG: cần dùng data.isEmergency
})

// MỚI:
updateSlot.mutate({
  ...
  isEmergencyOverride: data.isEmergency,  // true khi editingSlotMode === 'started'
})
```

#### 2e. Update JSX — `isEmergency` prop cho cả 2 dialogs

```tsx
// EditSlotDialog (dòng ~484):
// CŨ: isEmergency={false}
// MỚI:
isEmergency={editingSlotMode === 'started'}

// DeleteSlotDialog (dòng ~498):
// CŨ: isEmergency={false}
// MỚI:
isEmergency={deletingSlotMode === 'started'}
```

---

## 📋 Tasks / Subtasks

### T1 — Fix `schedule.utils.ts`: Thêm `started` tier

- [x] T1.1 Mở `src/features/schedule/utils/schedule.utils.ts`
- [x] T1.2 Đổi type: `export type SlotEditMode = 'locked' | 'started' | 'reason-required' | 'free'`
- [x] T1.3 Update `getSlotEditMode` signature: thêm `startTime: string` làm param thứ 2 (trước `userTimezone`)
- [x] T1.4 Update JSDoc comment bên trên function để reflect params mới
- [x] T1.5 Implement logic `started` tier: `slotDate === todayInUserTz && new Date(startTime) < now` → `return 'started'`
- [x] T1.6 Xóa/update comment 3-tier cũ trong file → 4-tier mới

### T2 — Fix `my-schedule.tsx`: 5 thay đổi

- [x] T2.1 Thêm state `deletingSlotMode` (sau `editingSlotMode` state)
- [x] T2.2 Update `handleEditSlot`: thêm `slot.start_time` vào `getSlotEditMode` call, thêm `started` case (merged với `reason-required` case — cả hai mở EditSlotDialog)
- [x] T2.3 Update `handleDeleteSlot`: thêm `slot.start_time` vào `getSlotEditMode` call, thêm `started` case, set `deletingSlotMode`
- [x] T2.4 Update `handleEditSubmit`: đổi `isEmergencyOverride: false` → `isEmergencyOverride: data.isEmergency`
- [x] T2.5 Update JSX `EditSlotDialog`: đổi `isEmergency={false}` → `isEmergency={editingSlotMode === 'started'}`
- [x] T2.6 Update JSX `DeleteSlotDialog`: đổi `isEmergency={false}` → `isEmergency={deletingSlotMode === 'started'}`

### T3 — Update tests trong `schedule.test.ts`

- [x] T3.1 Mở `src/features/schedule/__tests__/schedule.test.ts`
- [x] T3.2 Update tất cả existing `getSlotEditMode` calls để thêm `startTime` làm param thứ 2 (xem chi tiết bên dưới)
- [x] T3.3 Thêm tests mới cho `'started'` tier (xem chi tiết bên dưới)
- [x] T3.4 Chạy `npx vitest run src/features/schedule/__tests__/schedule.test.ts` — tất cả PASS

### T4 — TypeScript validation

- [x] T4.1 Chạy `npx tsc --noEmit` — không lỗi mới

---

## ⚡ Tests Update Guide (Chi tiết)

### Fake time context của test suite

Fake time = **Thứ Tư 2026-03-25 12:00 ICT** = `2026-03-25T05:00:00Z` (UTC).

### Tests hiện tại cần update `startTime` arg (param mới)

```ts
// Test: slot_date trước today → locked
// startTime không quan trọng (locked check trước), dùng future time để tránh confuse
it('slot_date trước today → locked', () => {
  expect(getSlotEditMode('2026-03-24', '2026-03-24T08:00:00Z', TZ)).toBe('locked')
  //                                    ↑ thêm startTime (giá trị không ảnh hưởng kết quả)
})

// Test: slot_date = today → reason-required (chỉ đúng nếu start_time >= now)
// now = 2026-03-25T05:00:00Z (12:00 ICT), dùng start_time sau 12:00 ICT = sau 05:00Z
it('slot_date = today, start_time chưa qua → reason-required', () => {
  expect(getSlotEditMode('2026-03-25', '2026-03-25T07:00:00Z', TZ)).toBe('reason-required')
  //                                    ↑ 14:00 ICT = 07:00Z → sau now(05:00Z) → reason-required
})

// Test: slot_date = Sunday tuần này → reason-required
it('slot_date = Sunday (cuối tuần này) → reason-required', () => {
  expect(getSlotEditMode('2026-03-29', '2026-03-29T07:00:00Z', TZ)).toBe('reason-required')
  //                                    ↑ startTime không ảnh hưởng (slotDate > today)
})

// Test: slot_date = next Monday → free
it('slot_date = next Monday → free', () => {
  expect(getSlotEditMode('2026-03-30', '2026-03-30T07:00:00Z', TZ)).toBe('free')
})

// Test: slot_date 2 tuần sau → free
it('slot_date 2 tuần sau → free', () => {
  expect(getSlotEditMode('2026-04-06', '2026-04-06T07:00:00Z', TZ)).toBe('free')
})

// Test: Sunday edge case (toàn bộ tests trong block — cần thêm startTime)
it('khi today là Sunday, next_monday = tomorrow', () => {
  vi.setSystemTime(new Date('2026-03-29T05:00:00Z')) // Sunday 29/03 ICT
  expect(getSlotEditMode('2026-03-29', '2026-03-29T07:00:00Z', TZ)).toBe('reason-required')
  expect(getSlotEditMode('2026-03-30', '2026-03-30T07:00:00Z', TZ)).toBe('free')
})
```

### Tests mới cần thêm cho `'started'` tier

```ts
// Fake time: T4 2026-03-25 12:00 ICT = 05:00 UTC

it('slot_date = today, start_time đã qua → started', () => {
  // slot 01:30 ICT = 18:30Z ngày hôm trước → đã qua
  expect(getSlotEditMode('2026-03-25', '2026-03-24T18:30:00Z', TZ)).toBe('started')
})

it('slot_date = today, start_time = đúng 12:00 ICT (now) → started (edge: không >= now)', () => {
  // 2026-03-25T05:00:00Z = now → new Date(startTime) < now → false → reason-required
  // (started cần STRICTLY less than)
  expect(getSlotEditMode('2026-03-25', '2026-03-25T05:00:00Z', TZ)).toBe('reason-required')
})

it('slot_date = today, start_time 1ms trước now → started', () => {
  expect(getSlotEditMode('2026-03-25', '2026-03-25T04:59:59.999Z', TZ)).toBe('started')
})

it('slot_date = hôm qua → locked (không phải started)', () => {
  // locked check runs before started check
  expect(getSlotEditMode('2026-03-24', '2026-03-23T18:30:00Z', TZ)).toBe('locked')
})

it('slot_date = ngày mai trong tuần → reason-required (không phải started)', () => {
  // started chỉ apply khi slot_date === today
  expect(getSlotEditMode('2026-03-26', '2026-03-26T02:00:00Z', TZ)).toBe('reason-required')
})
```

---

## 🚫 Phạm vi rõ ràng — KHÔNG làm ngoài đây

- ✅ Fix `schedule.utils.ts` — thêm `'started'` tier + update signature
- ✅ Fix `my-schedule.tsx` — 5 thay đổi nhỏ (state + handlers + JSX)
- ✅ Update tests `schedule.test.ts` — update existing + thêm new tests
- ❌ **KHÔNG** sửa `EditSlotDialog.tsx` — đã có `isEmergency` prop hoàn chỉnh
- ❌ **KHÔNG** sửa `DeleteSlotDialog.tsx` — đã có `isEmergency` prop hoàn chỉnh
- ❌ **KHÔNG** thêm migration DB — pure frontend fix
- ❌ **KHÔNG** sửa backend RPC — đã hoạt động đúng với `isEmergencyOverride = true`
- ❌ **KHÔNG** sửa các file Wave 2 (9-2, 9-3)

---

## 📝 Dev Notes

### `SlotEditMode` import trong `my-schedule.tsx`

Type `SlotEditMode` đã được import sẵn tại dòng 33:
```ts
import { shiftSlotsToCurrentWeek, getSlotEditMode, minutesToTimeString, type SlotEditMode } from '@/features/schedule/utils/schedule.utils'
```
Không cần thêm import mới — `'started'` tự động available sau khi update type trong `schedule.utils.ts`.

### `slot.start_time` available trong `findSlot()` result

`findSlot()` trả về `ScheduleSlot | null`. `ScheduleSlot.start_time` đã tồn tại và là UTC ISO timestamp string:
```ts
// schedule.service.ts — ScheduleSlot type
start_time: string  // UTC ISO timestamp, e.g. "2026-03-25T18:30:00+00:00"
```
Dùng trực tiếp: `getSlotEditMode(slot.slot_date, slot.start_time, userTimezone)`.

### P-6 pattern: capture mode khi mở dialog

Codebase đã có comment `// P-6: capture mode lúc mở dialog, tránh race condition midnight`. Story này follow pattern đó:
- `editingSlotMode` đã capture sẵn — thêm `'started'` vào logic
- `deletingSlotMode` — thêm mới theo pattern tương tự

### `handleEditSubmit` — data.isEmergency đến từ đâu

`EditSlotDialog.onSubmit` callback returns `{ newStartTimeUTC, newDurationMinutes, reason, isEmergency }` trong đó `isEmergency` là **prop của dialog** được pass lại. Vì thế, sau khi fix JSX để pass `isEmergency={editingSlotMode === 'started'}`, `data.isEmergency` trong `handleEditSubmit` sẽ là `true` khi cần.

### `handleDeleteConfirm` — không cần sửa logic

`handleDeleteConfirm` đã dùng `data.isEmergency` để set `isEmergencyOverride`:
```ts
deleteSlotWithReason.mutate({
  slotId: deletingSlot.id,
  reason: data.reason,
  isEmergencyOverride: data.isEmergency,  // đã đúng rồi!
})
```
Chỉ cần đảm bảo `DeleteSlotDialog` nhận `isEmergency={deletingSlotMode === 'started'}`.

### Test timezone note

Fake time `'2026-03-25T05:00:00Z'` = 12:00 ICT (Asia/Ho_Chi_Minh = UTC+7). Khi kiểm tra `started`:
- `start_time = '2026-03-24T18:30:00Z'` = 01:30 ICT ngày 25 → đã qua 12:00 ICT → `started` ✅
- `start_time = '2026-03-25T07:00:00Z'` = 14:00 ICT → chưa qua 12:00 ICT → `reason-required` ✅

### Vitest test runner

```bash
# Chạy test schedule cụ thể
npx vitest run src/features/schedule/__tests__/schedule.test.ts

# TypeScript check
npx tsc --noEmit
```

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-5

### Debug Log References

_Không có issue — implement thẳng theo spec._

### Completion Notes List

- ✅ T1: `SlotEditMode` type mở rộng từ 3-tier → 4-tier (`'started'` mới). `getSlotEditMode` signature thêm `startTime: string` param. Logic: `slotDate === today AND new Date(startTime) < now` → `'started'`.
- ✅ T2: `my-schedule.tsx` — 5 thay đổi: `deletingSlotMode` state, `handleEditSlot`/`handleDeleteSlot` gọi `getSlotEditMode` với `slot.start_time`, `handleEditSubmit` dùng `data.isEmergency` thay vì hardcoded `false`, JSX dialogs nhận `isEmergency` đúng.
- ✅ T3: Tests updated — 6 tests cũ thêm `startTime` arg; 5 tests mới cho `'started'` tier (bao gồm boundary/edge cases). 42/42 PASS.
- ✅ T4: `npx tsc --noEmit` — 0 lỗi.

### File List

- `src/features/schedule/utils/schedule.utils.ts` — modified
- `src/routes/_app/my-schedule.tsx` — modified
- `src/features/schedule/__tests__/schedule.test.ts` — modified

**Rất thấp** — ~3 files, không migration, tổng cộng ~20–30 dòng thay đổi. Phần test là quan trọng nhất.

---

## 📁 File List (dự kiến)

- `src/features/schedule/utils/schedule.utils.ts` — modified (`SlotEditMode` type + `getSlotEditMode` signature + logic)
- `src/routes/_app/my-schedule.tsx` — modified (state + 3 handlers + 2 JSX props)
- `src/features/schedule/__tests__/schedule.test.ts` — modified (update existing tests + thêm `started` tests)

---

## Change Log

| Date | Change |
|------|--------|
| 2026-03-26 | Story created — ready-for-dev |
| 2026-03-26 | Implementation complete — 3 files modified, 42 tests pass, 0 TS errors |
| 2026-03-26 | Code review fixes — P1: EditSlotDialog reason field khi isEmergency=true; P2: ScheduleGrid 4 call sites thêm startTime; P3: null guard startTime; P4: deletingSlotMode default 'free' |
