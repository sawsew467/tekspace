# Story 8-16: Schedule Week Picker + Time-Grid + Drag-to-Create

## Metadata
- **Story ID:** 8-16
- **Epic:** 8 — UX Polish & Feature Completeness
- **Story Key:** 8-16-schedule-week-picker-drag
- **Status:** review
- **Wave:** 5 (sau Wave 4)
- **Effort:** High (ScheduleGrid overhaul)
- **Created:** 2026-03-25

---

## User Story

As a member,
I want to navigate my schedule by selecting any week from a calendar picker and view my slots positioned on a 24-hour time-grid,
So that I can quickly jump to any week and intuitively create new slots by dragging on the grid instead of clicking through a form every time.

---

## Acceptance Criteria

### AC1 — Week Picker Popover (desktop + mobile)
**Given** user is on `/my-schedule`
**When** user clicks the week range text (e.g., "23/03 – 29/03/2026 ▾")
**Then** a Popover opens showing a Calendar
**And** the current week is highlighted as a range (Mon–Sun) using `mode="range"`
**And** clicking any day in the calendar navigates to that week and closes the Popover

### AC2 — Week Navigation Buttons Preserved
**Given** week picker is visible
**When** user clicks `◀` or `▶` buttons outside the Popover
**Then** week changes normally (existing behavior preserved)
**And** "Tuần này" button appears when not on current week (existing behavior preserved)

### AC3 — Time-Grid on Desktop (≥ 768px)
**Given** user is on desktop
**When** schedule page loads
**Then** slots are displayed on a 24-hour time-grid (00:00–24:00) **instead of** the card list
**And** grid content is 1440px tall (60px/hour = 1px per minute)
**And** grid container fills remaining viewport height (`flex-1 overflow-y-auto`)
**And** on mount, grid auto-scrolls to `currentHour × 60` px (or `8 × 60 = 480` px if before 08:00), offset -100px so context is visible

### AC4 — Slot Block Positioning
**Given** user has slots on the time-grid
**When** grid renders
**Then** each slot block is `position: absolute` within its day column
**And** `top = startMinutesInUserTz` px (from midnight in user timezone)
**And** `height = durationMinutes` px
**And** slot shows `HH:mm → HH:mm` and duration text (format via existing `formatSlotTime`, `formatSlotDuration` helpers in ScheduleGrid.tsx)
**And** clicking a slot opens EditSlotDialog (reuse existing flow)

### AC5 — Current Time Line
**Given** today is visible in the current week view
**When** time-grid renders
**Then** a horizontal red line (`bg-red-400`) appears at position `currentHour × 60 + currentMinute` px on today's column only
**And** the line has a small circle on the left edge (like Google Calendar)

### AC6 — Locked Day Visual
**Given** a day's edit mode is `"locked"` (past date, via `getSlotEditMode`)
**When** grid renders
**Then** that day column has `opacity-60` overlay and `bg-muted/30`
**And** cursor is `default` (not `crosshair`) on locked columns
**And** no drag-to-create interaction is possible

### AC7 — Drag-to-Create (desktop only)
**Given** user is on desktop, day column is NOT locked
**When** user presses pointer down and drags vertically on an EMPTY area of a day column
**Then** a ghost slot preview appears (`border-dashed border-primary bg-primary/15`, `pointer-events: none`)
**And** ghost shows the time range text (e.g., "09:00 → 10:30")
**And** start and end times snap to 30-minute increments
**And** minimum drag height enforced: if drag covers < 30 min, end = start + 30
**And** cursor is `crosshair` on empty column areas

### AC8 — Drag Releases SlotForm
**Given** user completes a drag gesture (`pointerup`)
**When** drag duration ≥ 30 minutes
**Then** `SlotForm` dialog opens pre-filled with:
  - `defaultDate` = ISO date of the dragged column
  - `defaultStartTime` = snapped start HH:mm
  - `defaultEndTime` = snapped end HH:mm
**And** user can confirm, modify, or cancel before saving
**And** existing SlotForm validation (overlap check, duration limits) still applies

### AC9 — Fallback Button Preserved
**Given** user is on `/my-schedule` (desktop or mobile)
**When** user clicks "+ Thêm ca làm việc"
**Then** SlotForm opens exactly as before (no regression)

### AC10 — Mobile Layout Unchanged
**Given** user is on mobile (< 768px)
**When** schedule page loads
**Then** list card layout (existing `ScheduleGrid`) is preserved unchanged
**And** week picker Popover is added to replace the plain text range
**And** no time-grid, no drag-to-create on mobile

---

## Implementation Guide

### Files Overview

| Action | File |
|--------|------|
| **CREATE** | `src/features/schedule/components/WeekPickerPopover.tsx` |
| **CREATE** | `src/features/schedule/components/TimeGrid.tsx` |
| **MODIFY** | `src/features/schedule/components/SlotForm.tsx` |
| **MODIFY** | `src/features/schedule/utils/schedule.utils.ts` |
| **MODIFY** | `src/routes/_app/my-schedule.tsx` |
| **NO CHANGE** | `src/features/schedule/components/ScheduleGrid.tsx` (mobile, untouched) |
| **NO CHANGE** | All hooks, services, schemas (no new DB, no new queries) |

---

### 1. New File: `WeekPickerPopover.tsx`

```tsx
// src/features/schedule/components/WeekPickerPopover.tsx
import { useState } from 'react'
import { startOfISOWeek, addDays, format, parseISO } from 'date-fns'
import { vi } from 'date-fns/locale'
import { ChevronDown } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'

interface WeekPickerPopoverProps {
  weekOf: string                        // Monday 'YYYY-MM-DD'
  onWeekChange: (weekOf: string) => void
}

export function WeekPickerPopover({ weekOf, onWeekChange }: WeekPickerPopoverProps) {
  const [open, setOpen] = useState(false)

  const weekStart = parseISO(weekOf)
  const weekEnd = addDays(weekStart, 6)

  const label = `${format(weekStart, 'dd/MM')} – ${format(weekEnd, 'dd/MM/yyyy')}`

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-sm text-muted-foreground tabular-nums px-2">
          {label}
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="center">
        <Calendar
          mode="range"
          selected={{ from: weekStart, to: weekEnd }}
          locale={vi}
          onDayClick={(day) => {
            const newWeekOf = format(startOfISOWeek(day), 'yyyy-MM-dd')
            onWeekChange(newWeekOf)
            setOpen(false)
          }}
          // Highlight today
          today={new Date()}
        />
      </PopoverContent>
    </Popover>
  )
}
```

**Notes:**
- `mode="range"` với `selected={{ from: weekStart, to: weekEnd }}` → shadcn Calendar sẽ highlight cả tuần tự động
- `onDayClick` dùng `startOfISOWeek` từ `date-fns` (ISO = Monday-start)
- Không cần `onSelect` — `onDayClick` đủ để handle và close

---

### 2. New File: `TimeGrid.tsx`

**Structure bên trong TimeGrid:**

```
<div ref={containerRef} className="flex-1 overflow-y-auto flex">
  {/* Time axis: sticky left */}
  <div className="w-12 sticky left-0 bg-background z-10">
    {/* Hour labels: 00, 01, ..., 23 */}
    {hours.map(h => <div style={{ top: h*60 }} ...>{h}:00</div>)}
  </div>

  {/* 7 day columns */}
  <div className="grid grid-cols-7 flex-1">
    {weekDays.map(day => (
      <DayColumn
        key={day.date}
        date={day.date}
        slots={slotsByDate[day.date]}
        isLocked={getSlotEditMode(day.date, userTimezone) === 'locked'}
        isToday={day.date === todayStr}
        userTimezone={userTimezone}
        dragState={dragState?.date === day.date ? dragState : null}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onEditSlot={onEditSlot}
        onDeleteSlot={onDeleteSlot}
        isDeletingSlotId={isDeletingSlotId}
      />
    ))}
  </div>
</div>
```

**Props interface:**
```typescript
interface TimeGridProps {
  slots: ScheduleSlot[]
  weekOf: string                            // Monday 'YYYY-MM-DD'
  userTimezone: string
  onAddSlot: (date: string) => void         // dùng cho fallback (không dùng trực tiếp trong grid)
  onEditSlot: (slotId: string) => void
  onDeleteSlot: (slotId: string) => void
  onDragCreate: (params: DragCreateParams) => void
  isDeletingSlotId?: string
  className?: string
}

export interface DragCreateParams {
  date: string            // 'YYYY-MM-DD'
  startMinutes: number    // minutes from midnight (snapped to 30)
  durationMinutes: number // snapped to 30, min 30
}
```

**Drag state:**
```typescript
interface DragState {
  date: string
  startMinutes: number      // snapped
  currentEndMinutes: number // snapped, always >= startMinutes + 30
  pointerId: number
}
```

**Pointer event logic (trên DayColumn background):**
```typescript
function handlePointerDown(e: React.PointerEvent, date: string, columnEl: HTMLDivElement) {
  if (isLocked(date)) return
  // Prevent slot clicks from bubbling
  if ((e.target as Element).closest('[data-slot-block]')) return

  const rect = columnEl.getBoundingClientRect()
  const y = e.clientY - rect.top + columnEl.scrollTop  // account for scroll
  const rawMinutes = Math.min(Math.max(0, y), 1439)    // clamp 0–1439
  const snapped = snapTo30(rawMinutes)

  columnEl.setPointerCapture(e.pointerId)
  setDragState({
    date,
    startMinutes: snapped,
    currentEndMinutes: snapped + 30,
    pointerId: e.pointerId,
  })
}

function handlePointerMove(e: React.PointerEvent, columnEl: HTMLDivElement) {
  if (!dragState) return
  const rect = columnEl.getBoundingClientRect()
  // scrollTop correction: container scrolls, rect is relative to viewport
  const scrollTop = containerRef.current?.scrollTop ?? 0
  const y = e.clientY - rect.top + scrollTop
  const rawMinutes = Math.min(Math.max(0, y), 1440)
  const snappedEnd = snapTo30(rawMinutes)
  const endMinutes = Math.max(snappedEnd, dragState.startMinutes + 30)
  setDragState(prev => prev ? { ...prev, currentEndMinutes: endMinutes } : null)
}

function handlePointerUp() {
  if (!dragState) return
  const duration = dragState.currentEndMinutes - dragState.startMinutes
  if (duration >= 30) {
    onDragCreate({
      date: dragState.date,
      startMinutes: dragState.startMinutes,
      durationMinutes: duration,
    })
  }
  setDragState(null)
}
```

**Auto-scroll on mount:**
```typescript
useEffect(() => {
  if (!containerRef.current) return
  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const scrollTarget = currentMinutes < 8 * 60 ? 8 * 60 : currentMinutes
  containerRef.current.scrollTop = Math.max(scrollTarget - 100, 0)
}, []) // chỉ chạy lần mount đầu
```

**Slot block positioning:**
```typescript
// Convert UTC start_time → user timezone → minutes from midnight
import { toZonedTime } from 'date-fns-tz'

function slotToPosition(slot: ScheduleSlot, userTimezone: string) {
  const startUtc = new Date(slot.start_time)
  const startInUserTz = toZonedTime(startUtc, userTimezone)
  const startMinutes = startInUserTz.getHours() * 60 + startInUserTz.getMinutes()
  return {
    top: startMinutes,           // px (1px = 1 min)
    height: slot.duration_minutes, // px
  }
}
```

**Current time line (chỉ cột today):**
```typescript
// Compute once on mount — line doesn't need to update in this story
const now = new Date()
const currentTimeTop = now.getHours() * 60 + now.getMinutes()

// Render inside today's DayColumn:
{isToday && (
  <div
    className="absolute left-0 right-0 z-20 pointer-events-none"
    style={{ top: currentTimeTop }}
  >
    <div className="relative flex items-center">
      <div className="h-2 w-2 rounded-full bg-red-400 -ml-1 flex-shrink-0" />
      <div className="h-px flex-1 bg-red-400" />
    </div>
  </div>
)}
```

**Hour grid lines:**
```typescript
// Background grid lines (every 60px = 1 hour; lighter at 30-min marks)
{Array.from({ length: 24 }, (_, h) => (
  <div key={h} className="absolute left-0 right-0 border-t border-border/30" style={{ top: h * 60 }} />
))}
{Array.from({ length: 24 }, (_, h) => (
  <div key={`half-${h}`} className="absolute left-0 right-0 border-t border-border/10" style={{ top: h * 60 + 30 }} />
))}
```

**Slot block (bên trong DayColumn):**
```tsx
// Dùng lại helpers từ ScheduleGrid.tsx: formatSlotTime, formatSlotDuration
// KHÔNG copy-paste — di chuyển 2 helpers sang schedule.utils.ts nếu cần reuse
// Hoặc define inline trong TimeGrid (chỉ dùng ở đây)
<div
  data-slot-block              // dùng để detect trong onPointerDown
  key={slot.id}
  className={cn(
    'absolute left-[2px] right-[2px] rounded-md px-1.5 py-1 text-xs cursor-pointer',
    'bg-primary/80 text-primary-foreground hover:bg-primary/90 transition-colors',
    editMode === 'locked' && 'opacity-50 cursor-default',
  )}
  style={{ top: pos.top, height: Math.max(pos.height, 20) }}  // min height 20px để readable
  onClick={() => onEditSlot(slot.id)}
>
  <p className="font-medium tabular-nums leading-tight truncate">
    {formatSlotTime(slot.start_time, slot.duration_minutes, userTimezone)}
  </p>
  {pos.height >= 40 && (
    <p className="text-xs opacity-80">{formatSlotDuration(slot.duration_minutes)}</p>
  )}
</div>
```

---

### 3. Modify: `SlotForm.tsx`

Thêm 2 optional props:

```typescript
interface SlotFormProps {
  // ... existing props ...
  defaultStartTime?: string  // 'HH:mm', 30-min aligned — từ drag-to-create
  defaultEndTime?: string    // 'HH:mm', 30-min aligned — từ drag-to-create
}
```

Apply vào `useForm` defaultValues:
```typescript
const form = useForm<SlotFormValues>({
  resolver: zodResolver(slotFormSchema),
  defaultValues: {
    slotDate: defaultDate ?? format(parseISO(weekOf), 'yyyy-MM-dd'),
    startTime: defaultStartTime ?? '09:00',
    endTime: defaultEndTime ?? '10:00',
    isOvernight: false,
  },
})
```

**⚠️ CRITICAL:** `defaultValues` trong `useForm` chỉ apply khi component mount. Nếu `defaultStartTime`/`defaultEndTime` thay đổi sau mount, cần `form.reset()` trong `useEffect`. Dùng pattern:
```typescript
useEffect(() => {
  if (defaultStartTime || defaultEndTime) {
    form.setValue('startTime', defaultStartTime ?? '09:00')
    form.setValue('endTime', defaultEndTime ?? '10:00')
  }
}, [defaultStartTime, defaultEndTime])
```

---

### 4. Modify: `schedule.utils.ts`

Thêm 2 helper functions:

```typescript
/**
 * minutesToTimeString — convert minutes-from-midnight → 'HH:mm'
 * Input: 0–1440. 1440 maps to '00:00' (midnight next day).
 */
export function minutesToTimeString(minutes: number): string {
  const totalMins = minutes % (24 * 60)  // wrap at 24h
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * snapTo30 — snap minutes to nearest 30-minute boundary
 * snap(45) = 30, snap(46) = 60 (rounds up at 15-min mark)
 */
export function snapTo30(minutes: number): number {
  return Math.round(minutes / 30) * 30
}
```

---

### 5. Modify: `my-schedule.tsx`

**Thay đổi week navigation section:**

```tsx
{/* Week navigation — centered */}
<div className="flex items-center justify-center gap-1">
  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePrevWeek}>
    <ChevronLeft className="h-4 w-4" />
  </Button>

  {/* THAY THẾ: text range → WeekPickerPopover */}
  <WeekPickerPopover weekOf={currentWeekOf} onWeekChange={setCurrentWeekOf} />

  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNextWeek}>
    <ChevronRight className="h-4 w-4" />
  </Button>
  {!isViewingCurrentWeek && (
    <Button variant="ghost" size="sm" className="h-6 text-xs px-2 text-blue-600"
      onClick={handleGoToCurrentWeek}>
      Tuần này
    </Button>
  )}
</div>
```

**Thêm drag-create state:**
```typescript
const [dragCreateDefaults, setDragCreateDefaults] = useState<{
  startTime: string
  endTime: string
} | null>(null)

function handleDragCreate({ date, startMinutes, durationMinutes }: DragCreateParams) {
  const startTime = minutesToTimeString(startMinutes)
  const endTime = minutesToTimeString(startMinutes + durationMinutes)
  setSlotFormDefaultDate(date)
  setDragCreateDefaults({ startTime, endTime })
  setSlotFormOpen(true)
}

// Reset drag defaults khi form đóng
function handleSlotFormOpenChange(open: boolean) {
  setSlotFormOpen(open)
  if (!open) setDragCreateDefaults(null)
}
```

**Conditional render TimeGrid vs ScheduleGrid:**
```tsx
{isLoading ? (
  <ScheduleGridSkeleton />
) : isMobile ? (
  <ScheduleGrid
    slots={slots}
    weekOf={currentWeekOf}
    userTimezone={userTimezone}
    onAddSlot={handleAddSlot}
    onEditSlot={handleEditSlot}
    onDeleteSlot={handleDeleteSlot}
    isDeletingSlotId={...}
  />
) : (
  <TimeGrid
    slots={slots}
    weekOf={currentWeekOf}
    userTimezone={userTimezone}
    onAddSlot={handleAddSlot}
    onEditSlot={handleEditSlot}
    onDeleteSlot={handleDeleteSlot}
    onDragCreate={handleDragCreate}
    isDeletingSlotId={...}
    className="flex-1"
  />
)}
```

**SlotForm — pass drag defaults:**
```tsx
<SlotForm
  open={slotFormOpen}
  onOpenChange={handleSlotFormOpenChange}
  weekOf={currentWeekOf}
  defaultDate={slotFormDefaultDate}
  defaultStartTime={dragCreateDefaults?.startTime}
  defaultEndTime={dragCreateDefaults?.endTime}
  existingSlots={slots}
  onSubmit={handleAddSlotSubmit}
  isLoading={upsertSlots.isPending}
  userTimezone={userTimezone}
  tenantTimezone={tenantTimezone}
/>
```

**Import thêm:**
```typescript
import { WeekPickerPopover } from '@/features/schedule/components/WeekPickerPopover'
import { TimeGrid, type DragCreateParams } from '@/features/schedule/components/TimeGrid'
import { minutesToTimeString } from '@/features/schedule/utils/schedule.utils'
```

---

## Helpers đã có sẵn — TÁI SỬ DỤNG

| Helper | File | Dùng cho |
|--------|------|---------|
| `getSlotEditMode(date, tz)` | `schedule.utils.ts` | Xác định locked/reason-required/free |
| `toZonedTime`, `formatTz` | `date-fns-tz` | UTC → user timezone display |
| `formatSlotTime`, `formatSlotDuration` | `ScheduleGrid.tsx` (hiện inline) | Time display trong slot blocks |
| `useIsMobile()` | `@/hooks/use-mobile` | Switch TimeGrid vs ScheduleGrid |
| `QUERY_KEYS` | `@/lib/query-keys` | Không cần new queries trong story này |
| `cn()` | `@/lib/utils` | classNames |

> **Lưu ý về `formatSlotTime` và `formatSlotDuration`:** Hiện tại 2 functions này được define inline trong `ScheduleGrid.tsx`. Để tái dùng trong `TimeGrid.tsx`, có 2 lựa chọn:
> 1. Di chuyển chúng vào `schedule.utils.ts` (preferred — clean)
> 2. Re-define inline trong TimeGrid (acceptable nếu muốn ScheduleGrid không bị chạm)
> **Khuyến nghị:** Di chuyển vào `schedule.utils.ts` và update import trong `ScheduleGrid.tsx`.

---

## Key Technical Constraints

| Constraint | Rule |
|-----------|------|
| Drag library | ❌ KHÔNG dùng `@dnd-kit` — pointer events thuần túy |
| New dependency | ❌ KHÔNG install thêm thư viện nào |
| ScheduleGrid | ❌ KHÔNG thay đổi logic — mobile vẫn dùng nguyên |
| SlotForm | ✅ Chỉ add 2 optional props — backward compatible |
| Export style | Named exports — `export function X`, KHÔNG `export default` |
| Route paths | Dùng `ROUTES.app.schedule` — KHÔNG hardcode |
| ClassNames | Dùng `cn()` — KHÔNG `clsx()` hay `twMerge()` |
| Barrel exports | ❌ KHÔNG tạo `index.ts` |
| Toast | Dùng `toast` từ `sonner` |
| Timezone | Mọi slot time đều stored UTC, display qua `toZonedTime` + `formatTz` |

---

## Timezone Pitfall (quan trọng)

Slot `start_time` là UTC timestamp. Khi tính `top` position trên time-grid:

```typescript
// ✅ ĐÚNG
const startInUserTz = toZonedTime(new Date(slot.start_time), userTimezone)
const startMinutes = startInUserTz.getHours() * 60 + startInUserTz.getMinutes()

// ❌ SAI — sẽ sai khi timezone khác UTC
const startMinutes = new Date(slot.start_time).getHours() * 60 + ...
```

Tương tự cho drag-to-create: khi user drag ở vị trí `y=540px` (09:00 user time), SlotForm nhận `defaultStartTime="09:00"` — và SlotForm.handleSubmit sẽ convert về UTC qua `convertSlotToUTC(values, userTimezone, tenantTimezone)`. **Không cần convert trong TimeGrid** — chỉ cần pass HH:mm string.

---

## Testing Checklist

```bash
# Không có thay đổi DB trong story này
npx supabase test db   # phải PASS
```

**Manual verification:**
- [ ] Desktop: click text range → Calendar Popover mở, click ngày → navigate + close
- [ ] Desktop: ◀ ▶ buttons và "Tuần này" vẫn hoạt động
- [ ] Desktop: time-grid hiện slot đúng vị trí (top/height theo giờ thực)
- [ ] Desktop: slot click → EditSlotDialog mở
- [ ] Desktop: scroll tự động đến giờ hiện tại khi mount
- [ ] Desktop: đường kẻ đỏ hiện đúng vị trí hôm nay
- [ ] Desktop: locked days (T2–T7 tuần trước) có overlay mờ, không drag được
- [ ] Desktop: drag trên cột trống → ghost slot hiện, snap 30 phút
- [ ] Desktop: drag < 30 phút → tự extend thành 30 phút
- [ ] Desktop: release drag → SlotForm mở pre-filled đúng giờ
- [ ] Desktop: "+ Thêm ca làm việc" button vẫn hoạt động
- [ ] Mobile: list card view không thay đổi
- [ ] Mobile: week picker Popover thay thế plain text

---

## Anti-Patterns to Avoid

- ❌ Dùng `@dnd-kit` cho drag-to-create (nó cho drag-sort, không phải draw-to-create)
- ❌ Fetch data bên trong `TimeGrid` hay `WeekPickerPopover`
- ❌ Thay đổi logic trong `ScheduleGrid.tsx` (mobile code)
- ❌ Breaking change trong `SlotForm` props (chỉ thêm optional props)
- ❌ Dùng `new Date(slot.start_time).getHours()` để tính position (phải qua `toZonedTime`)
- ❌ Copy-paste `formatSlotTime`/`formatSlotDuration` — di chuyển sang utils hoặc define một lần
- ❌ Hardcode `'09:00'` hay `'17:00'` — dùng `minutesToTimeString(snapTo30(minutes))`
- ❌ Quên `setPointerCapture` → drag sẽ break khi chuột ra ngoài element
- ❌ Tính `top` từ `e.clientY - rect.top` mà quên cộng `scrollTop` của container

## Dev Notes

Sau khi implement, cập nhật phần này với:
- Quyết định về `formatSlotTime`/`formatSlotDuration` (move to utils hoặc inline)
- Bất kỳ edge case nào gặp phải với timezone calculation
- Performance notes (1440px grid với nhiều slots)

**Quyết định thực tế (2026-03-25):**
- `formatSlotTime` và `formatSlotDuration` đã được di chuyển vào `schedule.utils.ts` và import lại trong `ScheduleGrid.tsx` — clean approach, reusable.
- `minutesToTimeString` và `snapTo30` được thêm vào `schedule.utils.ts`.
- `containerRef` không cần truyền vào `DayColumn` props — handlers trong `TimeGrid` đọc trực tiếp.
- `toZonedTime` dùng để compute `todayStr` và `currentTimeTop` tại render time trong `TimeGrid` (không cần lazy init).
- Drag scroll correction: `containerRef.current?.scrollTop` được đọc tại thời điểm pointer move để tính đúng y position.

---

## Dev Agent Record

### Implementation Plan

1. ✅ `schedule.utils.ts`: thêm `formatSlotTime`, `formatSlotDuration`, `minutesToTimeString`, `snapTo30`
2. ✅ `ScheduleGrid.tsx`: update imports để dùng utils thay vì inline helpers
3. ✅ `WeekPickerPopover.tsx`: tạo mới với Calendar mode="range" + onDayClick
4. ✅ `TimeGrid.tsx`: tạo mới với 24h grid, DayColumn, drag-to-create, current time line
5. ✅ `SlotForm.tsx`: thêm `defaultStartTime`/`defaultEndTime` props
6. ✅ `my-schedule.tsx`: tích hợp WeekPickerPopover + TimeGrid + handleDragCreate

### Completion Notes

**Story 8-16 hoàn thành ngày 2026-03-25:**

- **AC1 ✅** WeekPickerPopover với Calendar mode="range", onDayClick → startOfISOWeek → onWeekChange
- **AC2 ✅** ◀ ▶ buttons và "Tuần này" preserved (không đổi logic trong my-schedule.tsx)
- **AC3 ✅** TimeGrid trên desktop: 1440px tall, flex-1 overflow-y-auto, auto-scroll mount
- **AC4 ✅** Slot blocks: top = startMinutes px, height = durationMinutes px qua toZonedTime
- **AC5 ✅** Current time red line với circle, chỉ hiện trên today column
- **AC6 ✅** Locked day: opacity-60 overlay, cursor-default, no pointer events
- **AC7 ✅** Drag-to-create: ghost preview dashed border, 30-min snap, min 30 min
- **AC8 ✅** onDragCreate → handleDragCreate → SlotForm mở với pre-filled time
- **AC9 ✅** "+ Thêm ca làm việc" button vẫn hoạt động bình thường
- **AC10 ✅** Mobile: ScheduleGrid list view unchanged + WeekPickerPopover thay text range

**Tests:** TypeScript pass (0 new errors), Supabase DB tests 80/80 pass.

---

## File List

- `src/features/schedule/utils/schedule.utils.ts` — thêm `formatSlotTime`, `formatSlotDuration`, `minutesToTimeString`, `snapTo30`; update import `formatTz`
- `src/features/schedule/components/ScheduleGrid.tsx` — update imports để dùng utils
- `src/features/schedule/components/WeekPickerPopover.tsx` — **NEW**
- `src/features/schedule/components/TimeGrid.tsx` — **NEW**
- `src/features/schedule/components/SlotForm.tsx` — thêm `defaultStartTime`/`defaultEndTime` props
- `src/routes/_app/my-schedule.tsx` — tích hợp WeekPickerPopover + TimeGrid + drag handlers

---

## Change Log

| Date | Change |
|------|--------|
| 2026-03-25 | Story 8-16 implemented: WeekPickerPopover + TimeGrid 24h + drag-to-create + SlotForm pre-fill |
