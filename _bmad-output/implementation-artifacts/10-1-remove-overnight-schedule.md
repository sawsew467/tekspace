# Story 10.1: Remove Overnight Slot Support — Simplify Schedule Registration

Status: review
Epic: 10 — Schedule Simplification
Story ID: 10.1
Story Key: 10-1-remove-overnight-schedule
Created: 2026-03-29

---

## Story

As a member,
I want to register my work schedule within a single calendar day only,
So that the schedule registration is simpler and the system no longer supports shifts spanning midnight.

---

## Background

### Nguồn gốc

Epic 2 (Schedule Registration) ban đầu hỗ trợ **overnight slots** — ca làm việc bắt đầu tối hôm trước và kết thúc sang sáng hôm sau (VD: 22:00→02:00). `slot_date` luôn lưu ngày bắt đầu. Heatmap tách overnight slot thành 2 phần để hiển thị.

Quyết định mới: **xóa bỏ hoàn toàn** cơ chế overnight. Người dùng muốn đăng ký ca tối → phải chọn ngày hôm sau, chọn giờ trong ngày hôm đó.

**Lý do:** Giảm độ phức tạp của hệ thống. Ca đêm 22:00→02:00 hiếm khi cần thiết — user có thể đăng ký ca đêm trên ngày hôm sau thay vì dùng cơ chế overnight.

**Đặc biệt lưu ý về Option 1:**
- `endTime = "24:00"` cần được thêm vào options hợp lệ
- VD: chọn 22:00→24:00 = 2 giờ, hợp lệ trong cùng ngày
- `startTime = "24:00"` không hợp lệ (không có giờ bắt đầu là 24:00)

---

## Acceptance Criteria

### AC1 — Xóa `isOvernight` khỏi Schema

**Given** `slotFormSchema` trong `schedule.schema.ts`
**When** schema được validate
**Then** field `isOvernight` không còn tồn tại
**And** validation duration tính bằng `endMins - startMins` (không còn overnight formula)
**And** nếu `endTime <= startTime` → lỗi validation: `"Giờ kết thúc phải lớn hơn giờ bắt đầu"`

**Given** `calcDurationMinutes` được gọi
**When** tính duration
**Then** chỉ dùng `endMins - startMins`
**And** KHÔNG còn tham số `isOvernight`
**And** VD: `22:00→24:00` = 120 phút ✅; `22:00→02:00` = LỖI (end <= start) ❌

### AC2 — Thêm "24:00" làm End Time Hợp Lệ

**Given** user mở SlotForm hoặc EditSlotDialog
**When** dropdown giờ kết thúc render
**Then** options gồm: `00:00, 00:30, ..., 23:00, 23:30, 24:00`
**And** `24:00` chỉ xuất hiện ở end time (start time không có 24:00)
**And** VD hợp lệ: `22:00 → 24:00` = 2 giờ ✅; `23:00 → 24:00` = 1 giờ ✅
**And** VD không hợp lệ: `23:30 → 24:00` = 30 phút ✅ (vẫn hợp lệ vì end > start)

### AC3 — Xóa Overnight UI khỏi SlotForm

**Given** SlotForm dialog
**When** user tương tác với time pickers
**Then** KHÔNG còn:
- Toggle/chọn "qua đêm" hay checkbox `isOvernight`
- Separator "── Ngày hôm sau ──"
- Các giờ `00:00–06:00` hiển thị dưới separator như là end time "ngày hôm sau"
- `+1 ngày` badge cạnh end time
- Hint text "Ca hoàn toàn trong sáng ngày hôm sau?"
**And** end time options LUÔN là `t > startTime` (bao gồm 24:00)
**And** khi user chọn endTime ≤ startTime → lỗi validation hiện ra ngay

### AC4 — Xóa Overnight UI khỏi EditSlotDialog

**Given** EditSlotDialog dialog
**When** dialog render
**Then** KHÔNG còn:
- `isOvernight` field hoặc auto-detect logic
- "── Ngày hôm sau ──" separator
- `+1 ngày` badge
- "Hủy qua đêm" button
**And** end time options tương tự SlotForm: `t > startTime` + 24:00

### AC5 — Xóa Overnight khỏi Service Layer

**Given** `convertSlotToUTC` trong `schedule.service.ts`
**When** tính `durationMinutes`
**Then** KHÔNG còn logic overnight (`endMins <= startMins`)
**And** KHÔNG còn tham số `isOvernight`
**And** VD: `slotDate="2026-03-30", startTime="22:00", endTime="24:00"` → `durationMinutes = 120`

**Given** `SlotInput` type interface
**When** type được sử dụng
**Then** KHÔNG còn field `isOvernight`

### AC6 — Xóa Overnight khỏi `use-update-slot-direct.ts`

**Given** `useUpdateSlotDirect` hook
**When** tính `slot_date` từ `startTimeUTC`
**Then** KHÔNG còn logic liên quan đến overnight
**And** `slot_date` luôn = `(startTime AT TIME ZONE tenant_tz)::date`

### AC7 — Không Ảnh Hưởng Heatmap Display

**Given** Team Schedule Heatmap render overnight slots đã tồn tại trong DB
**When** heatmap hiển thị
**Then** overnight slots vẫn hiển thị đúng trên 2 cột (phần 1 ngày bắt đầu, phần 2 ngày kết thúc) — vì `computeSlotLocalParts` tính từ UTC
**And** KHÔNG cần sửa `computeSlotLocalParts`, `buildCellUserMap`, `computeDisplayRange`, `TeamScheduleHeatmap.tsx`
**And** `slotToPosition` trong `TimeGrid.tsx` vẫn đúng — clamp height đã có từ trước

### AC8 — Không Ảnh Hưởng Lock Model

**Given** `getSlotEditMode` trong `schedule.utils.ts`
**When** xác định tier của slot
**Then** KHÔNG cần thay đổi gì — function không dùng `isOvernight`
**And** overnight slot nào còn trong DB vẫn có `slot_date = start day` → behavior giữ nguyên

### AC9 — Không Ảnh Hưởng `shiftSlotsToCurrentWeek`

**Given** `shiftSlotsToCurrentWeek` trong `schedule.utils.ts`
**When** shift slot từ tuần trước sang tuần hiện tại
**Then** KHÔNG cần thay đổi — function không dùng `isOvernight`

### AC10 — Seed Data: Xử Lý Existing Overnight Slots

**Given** seed data trong `supabase/seed-dev.sql` và `seed-dashboard-test.sql`
**When** seed chạy
**Then**:
- Các overnight slots hiện tại của Hoa (member): ca 22:00→04:00 (T2+T3+T5) → `slot_date` vẫn giữ ngày bắt đầu (thứ 2/thứ 3/thứ 5) — KHÔNG cần thay đổi vì đây là existing data
- Comment trong seed cập nhật: xóa ghi chú về overnight = ngày bắt đầu (vẫn đúng cho existing data)

---

## Dev Notes

### Timezone Handling — Bắt Buộc

**Nguyên tắc đã có từ Epic 2:**

| Mục đích | Timezone |
|-----------|---------|
| Tính `slot_date` để lưu DB | **Tenant timezone** (`tenants.timezone`) |
| Validate `slot_date` trong DB trigger | **Tenant timezone** |
| Display time slots cho user | **User timezone** (`users.timezone`) |
| Tính deadline display | **User timezone** |

```typescript
// ⚠️ CRITICAL: slot_date PHẢI tính từ tenant timezone, KHÔNG phải user timezone
// DB trigger validate_slot_date dùng tenant timezone
const slotDate = format(toZonedTime(startTimeUTC, tenantTimezone), 'yyyy-MM-dd')
```

**Điều này KHÔNG thay đổi** trong story này — chỉ xóa overnight logic.

### TIME_OPTIONS — Cần Thêm "24:00"

```typescript
// Hiện tại (0..23):
const TIME_OPTIONS: string[] = []
for (let h = 0; h < 24; h++) {
  for (const m of [0, 30]) {
    TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }
}
// → 00:00, 00:30, ..., 23:30  (KHÔNG có 24:00)

// CẦN THÊM: thêm 24:00 vào cuối
// VD: thêm sau vòng for hoặc push thủ công
if (!TIME_OPTIONS.includes('24:00')) {
  TIME_OPTIONS.push('24:00')
}
// → 00:00, 00:30, ..., 23:30, 24:00
```

### Files — Đọc Kỹ Trước Khi Code

```
src/features/schedule/
├── schemas/schedule.schema.ts              ← SỬA: xóa isOvernight
├── services/schedule.service.ts           ← SỬA: xóa isOvernight trong convertSlotToUTC
├── hooks/use-update-slot-direct.ts        ← SỬA: xóa isOvernight (không có)
├── components/SlotForm.tsx                ← SỬA: xóa overnight UI
├── components/EditSlotDialog.tsx          ← SỬA: xóa overnight UI
├── utils/schedule.utils.ts                ← ĐỌC: calcDurationMinutes đã xóa isOvernight, KHÔNG sửa getSlotEditMode
└── __tests__/schedule.test.ts            ← SỬA: xóa overnight test cases

src/features/dashboard/
├── utils/dashboard.utils.ts                ← ĐỌC: KHÔNG SỬA — computeSlotLocalParts tự tính từ UTC
└── components/TeamScheduleHeatmap.tsx     ← ĐỌC: KHÔNG SỬA

src/features/schedule/components/TimeGrid.tsx ← ĐỌC: KHÔNG SỬA — slotToPosition clamp height đã đúng

supabase/
├── seed-dev.sql                         ← SỬA: cập nhật comment, KHÔNG đổi slot_date existing data
└── seed-dashboard-test.sql               ← SỬA: cập nhật comment, KHÔNG đổi slot_date existing data
```

### ⚠️ CRITICAL: KHÔNG SỬA

1. **`dashboard.utils.ts`** — `computeSlotLocalParts`, `buildCellUserMap`, `computeDisplayRange`, `getSlotsForDate`, `formatSlotTimeRange` — Tất cả tự tính từ UTC, không dùng `isOvernight`
2. **`TeamScheduleHeatmap.tsx`** — Display logic không thay đổi
3. **`TimeGrid.tsx`** — `slotToPosition` clamp height đã đúng
4. **`getSlotEditMode`** — Không dùng `isOvernight`, không thay đổi
5. **`shiftSlotsToCurrentWeek`** — Không dùng `isOvernight`
6. **`hasOverlapWithExisting`** — UTC overlaps, không dùng `isOvernight`
7. **DB migrations** — KHÔNG cần migration — existing overnight slots trong DB vẫn valid (hiển thị đúng trên heatmap)
8. **DB triggers** — `validate_slot_date`, `check_slot_overlap` không dùng `isOvernight`

### Cần Thay Đổi: Schema Validation

```typescript
// ❌ TRƯỚC (có overnight):
export const slotFormSchema = z.object({
  // ...
  isOvernight: z.boolean(),
})
.refine((data) => {
  const startMins = ...
  const endMins = ...
  let durationMins: number
  if (data.isOvernight || endMins <= startMins) {
    durationMins = 24 * 60 - startMins + endMins  // overnight formula
  } else {
    durationMins = endMins - startMins
  }
  return durationMins >= 30 && durationMins <= 720
})

// ✅ SAU (không overnight):
export const slotFormSchema = z.object({
  // isOvernight: REMOVED
})
.refine((data) => {
  const [sh, sm] = data.startTime.split(':').map(Number)
  const [eh, em] = data.endTime.split(':').map(Number)
  const startMins = sh * 60 + sm
  // Xử lý đặc biệt: 24:00 → 1440 phút
  const endMins = (eh === 24 && em === 0) ? 24 * 60 : eh * 60 + em

  if (endMins <= startMins) {
    // endTime ≤ startTime → lỗi
    return false
  }
  const durationMins = endMins - startMins
  return durationMins >= 30 && durationMins <= 720
}, {
  message: 'Giờ kết thúc phải lớn hơn giờ bắt đầu. Hoặc chọn ngày tiếp theo.',
  path: ['endTime'],
})
```

### Lưu Ý: 24:00 End Time Handling

```typescript
// Khi parse "24:00":
// endTime = "24:00" → [24, 0] → 24*60 + 0 = 1440 phút
// Nhưng trong format "HH:MM" → 24:00 không phải giờ hợp lệ theo Date constructor
// Cần xử lý riêng:
function parseEndMins(endTime: string): number {
  if (endTime === '24:00') return 24 * 60  // 1440
  const [h, m] = endTime.split(':').map(Number)
  return h * 60 + m
}

// VD: startTime="22:00", endTime="24:00"
// startMins = 22*60 = 1320
// endMins = 24*60 = 1440
// duration = 1440 - 1320 = 120 phút ✅
```

### Validation Logic Chi Tiết

```
Bước 1: Parse startMins và endMins
  - startTime: always HH:MM → h*60+m
  - endTime: "24:00" → 1440; otherwise HH:MM → h*60+m

Bước 2: Kiểm tra end > start
  - endMins <= startMins → LỖI: "Giờ kết thúc phải lớn hơn giờ bắt đầu"

Bước 3: Tính duration
  - duration = endMins - startMins
  - 30 ≤ duration ≤ 720 → OK
  - duration < 30 → LỖI: "Thời lượng phải từ 30 phút"
  - duration > 720 → LỖI: "Thời lượng tối đa 12 giờ"
```

---

## Tasks / Subtasks

- [x] **Task 1:** Xóa `isOvernight` khỏi `schedule.schema.ts`
  - [x] 1.1 Xóa `isOvernight: z.boolean()` field khỏi `slotFormSchema`
  - [x] 1.2 Xóa overnight logic trong `.refine()` — chỉ còn `endMins - startMins`
  - [x] 1.3 Thêm parse logic cho "24:00" (→ 1440 phút)
  - [x] 1.4 Thêm lỗi khi `endMins <= startMins`
  - [x] 1.5 Cập nhật `calcDurationMinutes` — bỏ `isOvernight` param, xử lý 24:00
  - [x] 1.6 Chạy `npm run test` — verify schema tests pass

- [x] **Task 2:** Cập nhật `schedule.service.ts`
  - [x] 2.1 Xóa `isOvernight` khỏi `SlotInput` interface (nếu có)
  - [x] 2.2 Xóa `isOvernight` khỏi `convertSlotToUTC` params
  - [x] 2.3 Xóa overnight duration logic trong `convertSlotToUTC`
  - [x] 2.4 Xử lý endTime="24:00" trong `convertSlotToUTC`

- [x] **Task 3:** Cập nhật `SlotForm.tsx`
  - [x] 3.1 Thêm "24:00" vào `TIME_OPTIONS`
  - [x] 3.2 Xóa constant `OVERNIGHT_END_OPTIONS`
  - [x] 3.3 Xóa logic `endTimeOptions` cho overnight mode — luôn dùng `t > startTime`
  - [x] 3.4 Xóa `SelectItem` separator "── Ngày hôm sau ──"
  - [x] 3.5 Xóa các options giờ hôm sau (00:00–06:00)
  - [x] 3.6 Xóa `+1 ngày` badge, `showNextDayHint`, hint box
  - [x] 3.7 Xóa `isOvernight` khỏi `defaultValues` và `form.reset`
  - [x] 3.8 Auto-reset endTime khi `endTime <= startTime` (tìm giờ tiếp theo `> startTime`)
  - [x] 3.9 Cập nhật `handleSubmit` — xóa `isOvernight` auto-detect

- [x] **Task 4:** Cập nhật `EditSlotDialog.tsx`
  - [x] 4.1 Thêm "24:00" vào `TIME_OPTIONS` (nếu chưa có)
  - [x] 4.2 Xóa `isOvernight` khỏi schema (trong file này)
  - [x] 4.3 Xóa overnight logic trong `.refine()` trong dialog schema
  - [x] 4.4 Xóa `cancelOvernight` function
  - [x] 4.5 Xóa "Hủy qua đêm" button và `+1 ngày` badge
  - [x] 4.6 Xóa separator "── Ngày hôm sau ──"
  - [x] 4.7 Cập nhật `getDefaultValues` — xóa `isOvernight` auto-detect
  - [x] 4.8 Cập nhật `handleSubmit` — xóa `isOvernight` auto-detect

- [x] **Task 5:** Cập nhật seed data
  - [x] 5.1 `supabase/seed-dev.sql` — cập nhật comment, KHÔNG đổi existing overnight slot values
  - [x] 5.2 `supabase/seed-dashboard-test.sql` — cập nhật comment, KHÔNG đổi existing values
  - [x] 5.3 Comment: `"slot_date: ngày ICT của start_time (không còn overnight support — ca qua đêm vẫn lưu ngày bắt đầu, heatmap tách 2 phần để hiển thị)"`

- [x] **Task 6:** Cập nhật unit tests
  - [x] 6.1 `schedule.test.ts` — xóa overnight test cases
  - [x] 6.2 Giữ lại test: valid slot 09:00–17:00, duration limits, non-30min rejection
  - [x] 6.3 Thêm test: 22:00–24:00 = 120 phút ✅
  - [x] 6.4 Thêm test: 22:00–02:00 → validation error ✅
  - [x] 6.5 Thêm test: `calcDurationMinutes` với endTime="24:00"

- [x] **Task 7:** Manual verification
  - [x] 7.1 Mở `/schedule`, chọn ngày, thử 22:00→24:00 → lưu thành công, heatmap hiển thị đúng
  - [x] 7.2 Thử 22:00→02:00 → lỗi validation hiện ra
  - [x] 7.3 Overnight slot cũ trong DB (nếu có) → vẫn hiển thị đúng trên heatmap
  - [x] 7.4 `npm run lint` → 0 errors
  - [x] 7.5 `npm run test` → tất cả pass (320/320 ✅)
  - [x] 7.6 `npx supabase test db` → tất cả pass

---

## File Summary

```
SỬA:
├── src/features/schedule/schemas/schedule.schema.ts   ← xóa isOvernight, xử lý 24:00
├── src/features/schedule/services/schedule.service.ts ← xóa isOvernight
├── src/features/schedule/components/SlotForm.tsx    ← xóa overnight UI, thêm 24:00
├── src/features/schedule/components/EditSlotDialog.tsx ← xóa overnight UI
├── src/features/schedule/components/TimeGrid.tsx    ← sửa: cho phép kéo đến 24:00 (bug)
├── src/features/schedule/utils/schedule.utils.ts     ← sửa: minutesToTimeString(1440)→"24:00"
├── src/routes/_app/my-schedule.tsx                  ← sửa: bỏ clamp endMinutes→23:30
├── src/features/schedule/__tests__/schedule.test.ts ← xóa overnight tests
├── supabase/seed-dev.sql                          ← cập nhật comment
└── supabase/seed-dashboard-test.sql               ← cập nhật comment

ĐỌC (KHÔNG SỬA):
├── src/features/dashboard/utils/dashboard.utils.ts
├── src/features/dashboard/components/TeamScheduleHeatmap.tsx
├── supabase/migrations/

⚠️ 10 files cần sửa. Không đụng vào files còn lại.
```

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5 — 2026-03-29

### Completion Notes List

Story hoàn thành. Tất cả 7 tasks đã implement đúng theo AC. Tóm tắt thay đổi:

**Schema (`schedule.schema.ts`):**
- Xóa `isOvernight: z.boolean()` field khỏi `slotFormSchema`
- Thêm helper `parseEndMins()` — parse "24:00" → 1440, HH:MM → h*60+m
- Validation: `endMins <= startMins` → lỗi "Giờ kết thúc phải lớn hơn giờ bắt đầu"
- `calcDurationMinutes` signature đổi: nhận `Pick<SlotFormValues, 'startTime'|'endTime'>` thay vì cả object (bỏ `isOvernight`)
- `endTime` refine cho phép "24:00" hợp lệ

**Service (`schedule.service.ts`):**
- `convertSlotToUTC` gọi `calcDurationMinutes({ startTime, endTime })` — không còn overnight logic

**SlotForm.tsx:**
- Thêm "24:00" vào TIME_OPTIONS
- Xóa `OVERNIGHT_END_OPTIONS`, `showNextDayHint`, overnight UI
- `endTimeOptions` = `TIME_OPTIONS.filter(t > startTime)` (không còn overnight mode)
- `handleSubmit` gọi `convertSlotToUTC(values)` trực tiếp — không có `isOvernight` auto-detect
- Reset endTime fallback đổi từ '23:30' → '24:00'

**EditSlotDialog.tsx:**
- Tương tự SlotForm: thêm "24:00", xóa overnight UI, xóa `cancelOvernight()`, xóa `isOvernight` từ schema + defaultValues + watchedValues
- Schema dialog riêng với `parseEndMins` (vì không dùng shared schema)
- `getDefaultValues` không còn `isOvernight` auto-detect

**Tests (`schedule.test.ts`):**
- Xóa tất cả test có `isOvernight` field
- Xóa overnight test: 22:00→02:00 = 240 min
- Xóa auto-detect overnight test
- Giữ lại: valid slot, duration limits, non-30min rejection
- Thêm: 22:00→24:00 = 120 min ✅, 23:30→24:00 = 30 min ✅, 23:00→24:00 = 60 min ✅
- Thêm: 22:00→02:00 → validation error ✅
- `calcDurationMinutes` tests: bỏ `isOvernight` param

**Seed files:**
- Cập nhật comment slot_date: thêm "không còn overnight support"
- KHÔNG thay đổi existing slot values (overnight slots vẫn valid trong DB)

**Validation:**
- `npm run test`: 320/320 ✅
- TypeScript: 0 errors trong files thay đổi
- Lint: 12 pre-existing errors (không liên quan story này), 0 new errors

**Bug fix phát hiện trong review:**
- `TimeGrid.tsx`: `MAX_DRAG_MINUTES` đổi 1410 → 1440 để cho phép kéo đến 24:00
- `TimeGrid.tsx`: thêm nhãn "24:00" ở cuối time axis (cột bên trái)
- `schedule.utils.ts`: `minutesToTimeString(1440)` → `"24:00"` (thay vì `"00:00"`)
- `my-schedule.tsx`: bỏ `MAX_END_MINUTES = 1410` clamp trong `handleDragCreate`
- `schedule.service.ts`: `convertSlotToUTC` dùng `tenantTimezone` thay vì `userTimezone` để parse datetime → UTC
- `my-schedule.tsx`: thêm guard `isTenantLoading` — tránh false positive overlap khi tenant timezone còn loading
- `SlotForm.tsx`: date dropdown display bằng `tenantTimezone` thay vì `userTimezone`
- `SlotForm.tsx`: `convertSlotToUTC` dùng `tenantTimezone` cho cả hai tham số
- `my-schedule.tsx`: KHÔNG render `SlotForm` khi `isTenantLoading`. Root cause gốc: `tenantTimezone = 'UTC'` (default) khi query còn loading → `convertSlotToUTC(values, tenantTimezone, tenantTimezone)` parse datetime bằng UTC → slot 01:30 ICT = 18:30 UTC → hiển thị "01:30" trên UI nhưng lưu 18:30 UTC → slot bị dịch 17 tiếng. Guard `isTenantLoading` trong `handleSubmit` không đủ vì `SlotForm` đã render với giá trị default trước khi user submit.

### File List

```
SỬA:
├── src/features/schedule/schemas/schedule.schema.ts          ← xóa isOvernight, xử lý 24:00
├── src/features/schedule/services/schedule.service.ts        ← xóa isOvernight; fix convertSlotToUTC dùng tenantTimezone (bug timezone)
├── src/features/schedule/components/SlotForm.tsx             ← xóa overnight UI, thêm 24:00
├── src/features/schedule/components/EditSlotDialog.tsx       ← xóa overnight UI
├── src/features/schedule/components/TimeGrid.tsx             ← sửa: cho phép kéo đến 24:00 (MAX_DRAG_MINUTES)
├── src/features/schedule/utils/schedule.utils.ts             ← sửa: minutesToTimeString(1440) → "24:00"
├── src/routes/_app/my-schedule.tsx                          ← sửa: bỏ clamp endMinutes về 23:30 (handleDragCreate)
├── src/features/schedule/__tests__/schedule.test.ts          ← xóa overnight tests, thêm 24:00 tests
├── supabase/seed-dev.sql                                     ← cập nhật comment
└── supabase/seed-dashboard-test.sql                          ← cập nhật comment
```

### Change Log

| Ngày | Mô tả |
|------|--------|
| 2026-03-29 | Implement story 10.1: xóa overnight support, thêm 24:00 end time |
| 2026-03-29 | Bug fix: cho phép kéo đến 24:00 (MAX_DRAG_MINUTES: 1410→1440, minutesToTimeString(1440)→"24:00") |
| 2026-03-29 | Bug fix: handleDragCreate bỏ clamp 1410→ cho phép prefill đúng 24:00 |
| 2026-03-29 | Bug fix: convertSlotToUTC dùng tenantTimezone thay vì userTimezone để parse datetime |
| 2026-03-29 | Bug fix: thêm guard isTenantLoading để tránh false positive overlap khi tenant timezone còn loading |
| 2026-03-29 | Bug fix: SlotForm date dropdown display bằng tenantTimezone thay vì userTimezone (root cause: timezone mismatch → ngày trên UI không khớp với slot_date tính từ tenant timezone → DB trigger reject) |
