# Story 2.5: UX Polish & Behavior Corrections

**Status:** review
**Epic:** 2 — Schedule Registration
**Story ID:** 2.5
**Story Key:** 2-5-ux-polish-behavior-corrections
**Created:** 2026-03-24 (từ Epic 2 Retrospective)

---

## Story

As a member,
I want the schedule registration UI to behave correctly and look clean,
So that I can manage my work schedule without confusion or friction.

---

## Background — Nguồn Gốc

Story này được tạo từ **Epic 2 Retrospective (2026-03-24)** sau khi Thắng (Project Lead) review screenshots và clarify business requirements. Gồm:
- 2 bug fixes confirmed từ screenshot review
- 4 UX fixes từ screenshot review
- 1 behavior change từ Q1 clarification (3-tier lock model)
- 1 behavior change từ Q2 clarification (no reason for future-week edits)
- 1 overnight form fix (cap + hint text)
- 1 UI redesign (slot card + dialog)

---

## Acceptance Criteria

### AC1 — Bug Fix: Deadline Badge Hiển Thị Đúng Timezone
Khi `ScheduleDeadlineBadge` render deadline time, phải hiển thị theo **user timezone** (ICT = UTC+7), không phải UTC. Ví dụ: deadline `2026-03-22T16:59:00Z` phải hiện là `"CN 22/03 23:59"`, không phải `"CN 22/03 16:59"`.

### AC2 — Bug Fix: Column Header Format
Các header của ngày trong `ScheduleGrid` phải hiển thị day name và date rõ ràng, không bị concatenate. Ví dụ: `"T2\n23/03"` hoặc `"THỨ 2 · 23/03"` thay vì `"THỨ 223/03"`.

### AC3 — Pre-fill Ngày Khi Click "+"
Khi member click nút "+" trong column của một ngày cụ thể (ví dụ: Thứ Sáu), dropdown "Ngày" trong `SlotForm` dialog phải được pre-fill với ngày đó (`"2026-03-27"`). Nếu click "+" ở header/tổng quát thì giữ nguyên default (ngày đầu tiên của tuần).

### AC4 — Week Navigation Ra Giữa
Week navigation bar (nút `<` và `>` + label tuần + link "Tuần này") phải được căn giữa trang, không nằm flush-left dưới title "Lịch làm việc".

### AC5 — 3-Tier Lock Model (Thay Thế Timestamp-Based Lock)

Lock behavior dựa theo `slot_date` so với ngày hôm nay (theo **user timezone**):

| Tầng | Điều kiện | Hành vi |
|------|-----------|---------|
| **LOCKED** | `slot_date < today` | Card grayed out, không có edit/delete |
| **REASON-REQUIRED** | `today <= slot_date <= end_of_current_week (Sunday)` | Edit/delete hiển thị, click → dialog yêu cầu lý do, RPC gọi, manager nhận notification |
| **FREE** | `slot_date >= next_monday` | Edit/delete hiển thị, click → confirm đơn giản, direct Supabase call, không notify |

`today` và `next_monday` phải tính theo **user timezone** (không phải UTC).

**Emergency Override flow bị xóa hoàn toàn** — thay bằng 3-tier model này.

**Server-side**: RPC `update_slot_with_reason` / `delete_slot_with_reason` chỉ được gọi cho Tier 2 (REASON-REQUIRED). Tier 3 dùng direct `.update()` / `.delete()` qua Supabase client.

### AC6 — Không Cần Lý Do Cho Future-Week Edits (Tier 3)
Khi edit/delete slot thuộc Tier 3 (tuần sau trở đi):
- Không hiển thị reason dialog
- Chỉ cần confirm đơn giản (hoặc click trực tiếp không cần confirm)
- Không gọi RPC, không gửi notification tới manager
- Manager **không được notify** — đây là design decision có chủ đích (future week = đang lên kế hoạch, chưa committed)

### AC7 — Slot Card Redesign (3 Visual States)

**Tier 3 — FREE (tuần sau+):**
```
┌──────────────────────┐
│  09:00 → 17:00       │  ← bold, single line, "→" rõ ràng
│  8 giờ               │  ← muted, nhỏ hơn
│                      │
│  [✏ Sửa]  [🗑 Xóa]  │  ← buttons có label, không chỉ icon
└──────────────────────┘
```

**Tier 2 — REASON-REQUIRED (hôm nay → CN tuần này):**
```
┌──────────────────────┐
│  09:00 → 17:00       │
│  8 giờ               │
│                      │
│  [✏ Sửa]  [🗑 Xóa]  │  ← giống Tier 3, nhưng click → reason dialog
└──────────────────────┘
```

**Tier 1 — LOCKED (ngày trước):**
```
┌──────────────────────┐
│  🔒 09:00 → 17:00    │  ← icon lock trước time, toàn bộ card muted/gray
│  8 giờ · Đã qua      │  ← "Đã qua" label
└──────────────────────┘
  (không có buttons)
```

### AC8 — Dialog Add Slot Redesign

**Layout mới:**
```
┌─ Thêm ca làm việc ────────────────────┐
│                                        │
│ Ngày                                   │
│ [Thứ Ba 24/03                    ▼]    │
│                                        │
│ Thời gian                              │
│ [22:00 ▼]  →  [02:00 ▼  +1 ngày]      │
│                                        │
│ ⏱ 4 giờ (qua đêm)                     │
│                                        │
│ ⚠ Thời gian trùng với slot khác       │  ← error dưới cả time row
│                                        │
│             [Hủy]  [Thêm slot →]       │  ← disabled khi có lỗi
└────────────────────────────────────────┘
```

**Thay đổi cụ thể:**
1. Dấu `→` giữa start time và end time (visual flow)
2. `+1 ngày` badge inline cạnh end time thay vì "Hủy qua đêm" link text
3. "Thêm slot" button **disabled** khi có validation error bất kỳ
4. Error message hiển thị dưới cả time row (không chỉ dưới start time)
5. Consistent bold labels cho "Bắt đầu" và "Kết thúc"

### AC9 — Cap Overnight End Time Tại 06:00

Khi `isOvernight = true`, dropdown end time "hôm sau" chỉ hiển thị:
`00:00, 00:30, 01:00, 01:30, 02:00, 02:30, 03:00, 03:30, 04:00, 04:30, 05:00, 05:30, 06:00`

**Không hiển thị** các giờ từ 06:30 trở đi khi ở overnight mode.

Validation: duration tối đa 720 phút (12h) vẫn apply — nếu start quá sớm và end = 06:00 → duration > 720 min → lỗi.

### AC10 — Hint Text Cho Early Morning "Hôm Sau" Slots

Khi `isOvernight = true` và user chọn end time `hôm sau` **và** start time là 00:00–06:00 (sáng sớm của ngày được chọn), hiển thị hint:

```
💡 Ca hoàn toàn trong sáng ngày hôm sau?
   Hãy chọn ngày Thứ [X+1] trong dropdown bên trên.
```

Ví dụ: user chọn Thứ Năm, start=00:30, end=hôm sau 02:00 → hint xuất hiện.
Ví dụ: user chọn Thứ Năm, start=22:00, end=hôm sau 02:00 → không hiện hint (đây là legitimate overnight shift).

---

## Dev Context — Đọc Kỹ Trước Khi Code

### Tech Stack

- **UI**: shadcn/ui + Tailwind CSS + Radix UI
- **State**: TanStack Query (React Query) — `useMutation`, `useQueryClient`
- **Router**: TanStack Router
- **Date Handling**: `date-fns` + `date-fns-tz` (luôn lưu UTC, hiển thị theo timezone)
- **Forms**: React Hook Form + Zod
- **Icons**: Lucide React

### Codebase Hiện Tại — Những Gì Đã Có

**Files cần SỬA:**
```
src/features/schedule/utils/schedule.utils.ts
src/features/schedule/components/ScheduleDeadlineBadge.tsx
src/features/schedule/components/ScheduleGrid.tsx
src/features/schedule/components/SlotForm.tsx
src/routes/_app/schedule.tsx
src/features/schedule/__tests__/schedule.test.ts
```

**Files cần TẠO MỚI:**
```
src/features/schedule/hooks/use-update-slot-direct.ts
src/features/schedule/hooks/use-delete-slot-direct.ts
```

**Files KHÔNG được chạm vào:**
```
src/features/schedule/schemas/schedule.schema.ts     ← không thay đổi
src/features/schedule/services/schedule.service.ts   ← không thay đổi
src/features/schedule/hooks/use-update-slot.ts       ← giữ nguyên (Tier 2)
src/features/schedule/hooks/use-delete-slot-with-reason.ts  ← giữ nguyên (Tier 2)
src/features/schedule/components/EditSlotDialog.tsx  ← giữ nguyên (vẫn dùng cho Tier 2)
src/features/schedule/components/DeleteSlotDialog.tsx  ← giữ nguyên (vẫn dùng cho Tier 2)
supabase/migrations/                                 ← KHÔNG có DB change
supabase/tests/                                      ← không cần pgTAP mới
```

---

## Hướng Dẫn Implement Từng File

### 1. `schedule.utils.ts` — Thay `isSlotLocked` bằng `getSlotEditMode`

**Hiện tại:**
```typescript
export function isSlotLocked(slotStartTime: string): boolean {
  return Date.now() >= new Date(slotStartTime).getTime()
}
```

**Thay bằng:**
```typescript
import { addDays, format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'

export type SlotEditMode = 'locked' | 'reason-required' | 'free'

export function getSlotEditMode(
  slotDate: string,       // "2026-03-25" — slot_date từ DB
  userTimezone: string,   // "Asia/Ho_Chi_Minh"
): SlotEditMode {
  const todayInUserTz = format(
    toZonedTime(new Date(), userTimezone),
    'yyyy-MM-dd'
  )
  const todayDate = new Date(todayInUserTz)

  // Next Monday = start of next week
  const dayOfWeek = todayDate.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
  const nextMondayISO = format(
    addDays(todayDate, daysUntilMonday),
    'yyyy-MM-dd'
  )

  if (slotDate < todayInUserTz) return 'locked'           // Tầng 1
  if (slotDate < nextMondayISO) return 'reason-required'  // Tầng 2
  return 'free'                                            // Tầng 3
}
```

**⚠️ Xóa `isSlotLocked` hoàn toàn** — không được giữ lại để tránh nhầm lẫn. Tất cả nơi import `isSlotLocked` phải được cập nhật.

**Import cần thêm vào đầu file**: `import { addDays, format } from 'date-fns'` (thay vì chỉ `format`).

---

### 2. `ScheduleDeadlineBadge.tsx` — Fix timezone display (AC1)

**Bug root cause**: `format` từ `date-fns-tz` kết hợp với `toZonedTime` → double timezone conversion. Fix bằng cách dùng `format` từ `date-fns-tz` trực tiếp với `timeZone` option (bỏ `toZonedTime`):

```typescript
import { format } from 'date-fns-tz'
import { formatDistanceToNow, isPast } from 'date-fns'
import { vi } from 'date-fns/locale'
// ... (bỏ toZonedTime import)

// Thay đổi duy nhất: bỏ toZonedTime, dùng format trực tiếp
const deadlineFormatted = format(deadlineDate, 'EEE dd/MM HH:mm', {
  timeZone: userTimezone,
  locale: vi,
})
```

**Xóa dòng này:**
```typescript
const deadlineLocal = toZonedTime(deadlineDate, userTimezone)
```

---

### 3. `ScheduleGrid.tsx` — Column header fix, 3-tier SlotCard, pre-fill date (AC2, AC5, AC7)

#### 3a. Fix column header format (AC2)

**Hiện tại** (gây concatenate trên desktop):
```typescript
const dayLabel = isMobile
  ? format(date, 'EEEE dd/MM', { locale: vi })
  : format(date, 'EEE\ndd/MM', { locale: vi })
```

**Fix**: Tách dayName và dateStr thành 2 phần riêng biệt trong JSX, không dùng `\n`:
```typescript
const dayName  = isMobile ? format(date, 'EEEE', { locale: vi }) : format(date, 'EEE', { locale: vi })
const dateStr  = format(date, 'dd/MM')
// Trả về object thay vì string:
return { date: dateStr, dayName, dateFormatted: dateStr }
```

Trong JSX của `DayColumn`:
```tsx
<div className="text-center">
  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
    {dayName}
  </p>
  <p className="text-xs text-muted-foreground">
    {dateFormatted}
  </p>
</div>
```

#### 3b. Cập nhật interface SlotCard — bỏ emergency, thêm editMode

**Hiện tại**: Props `isLocked`, `onEmergencyOverride`, `onEmergencyDelete`
**Mới**: Prop `editMode: SlotEditMode`, bỏ toàn bộ emergency props

```typescript
import { getSlotEditMode, type SlotEditMode } from '../utils/schedule.utils'

interface SlotCardProps {
  slot: ScheduleSlot
  userTimezone: string
  editMode: SlotEditMode           // ← thay isLocked
  onEdit: (slotId: string) => void
  onDelete: (slotId: string) => void
  isDeleting?: boolean
  // KHÔNG còn: onEmergencyOverride, onEmergencyDelete
}
```

#### 3c. SlotCard visual theo 3 tiers (AC7)

```tsx
function SlotCard({ slot, userTimezone, editMode, onEdit, onDelete, isDeleting }: SlotCardProps) {
  const timeStr = formatSlotTime(slot.start_time, slot.duration_minutes, userTimezone)
  const durationStr = formatSlotDuration(slot.duration_minutes)

  if (editMode === 'locked') {
    return (
      <div className="flex flex-col rounded-md border bg-muted/50 p-2 text-sm opacity-60">
        <p className="font-medium tabular-nums flex items-center gap-1.5">
          <Lock className="h-3 w-3 shrink-0" />
          {timeStr}
        </p>
        <p className="text-xs text-muted-foreground">{durationStr} · Đã qua</p>
      </div>
    )
  }

  // Tier 2 và Tier 3 cùng layout — chỉ khác handler behavior ở route level
  return (
    <div className="flex flex-col gap-1.5 rounded-md border bg-card p-2 text-sm shadow-sm hover:border-primary/50 transition-colors">
      <p className="font-medium tabular-nums">{timeStr}</p>
      <p className="text-xs text-muted-foreground">{durationStr}</p>
      <div className="flex gap-1.5 mt-1">
        <Button
          variant="outline"
          size="sm"
          className="h-6 px-2 text-xs flex-1"
          onClick={() => onEdit(slot.id)}
          disabled={isDeleting}
        >
          <Pencil className="h-3 w-3 mr-1" />
          Sửa
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-6 px-2 text-xs flex-1 text-destructive hover:text-destructive"
          onClick={() => onDelete(slot.id)}
          disabled={isDeleting}
        >
          <Trash2 className="h-3 w-3 mr-1" />
          Xóa
        </Button>
      </div>
    </div>
  )
}
```

#### 3d. Cập nhật DayColumn/DayRow để pass `editMode`

```typescript
// Khi render SlotCard:
<SlotCard
  key={slot.id}
  slot={slot}
  userTimezone={userTimezone}
  editMode={getSlotEditMode(slot.slot_date, userTimezone)}
  onEdit={onEditSlot}
  onDelete={onDeleteSlot}
  isDeleting={isDeletingSlotId === slot.id}
/>
```

**`userTimezone` phải được pass xuống `DayColumn` và `DayRow`** — kiểm tra props hiện tại đã có `userTimezone` chưa. Nếu chưa có, thêm vào.

#### 3e. Cập nhật ScheduleGrid interface — bỏ emergency handlers

```typescript
interface ScheduleGridProps {
  slots: ScheduleSlot[]
  weekOf: string
  userTimezone: string
  onAddSlot: (date: string) => void
  onEditSlot: (slotId: string) => void
  onDeleteSlot: (slotId: string) => void
  isDeletingSlotId?: string
  className?: string
  // KHÔNG còn: onEmergencyOverride, onEmergencyDelete
}
```

---

### 4. `SlotForm.tsx` — defaultDate, overnight cap, hint text, dialog redesign (AC3, AC8, AC9, AC10)

#### 4a. Thêm `defaultDate` prop (AC3)

```typescript
interface SlotFormProps {
  // ... (giữ nguyên props hiện có)
  defaultDate?: string   // ← THÊM: "YYYY-MM-DD", nếu có → pre-fill dropdown Ngày
}

// Trong component:
export function SlotForm({ ..., defaultDate }: SlotFormProps) {
  const form = useForm<SlotFormValues>({
    resolver: zodResolver(slotFormSchema),
    defaultValues: {
      slotDate: defaultDate ?? weekOf,   // ← ưu tiên defaultDate
      startTime: '09:00',
      endTime: '17:00',
      isOvernight: false,
    },
  })
```

**⚠️ QUAN TRỌNG**: Form phải reset khi `defaultDate` hoặc dialog `open` thay đổi:
```typescript
useEffect(() => {
  if (open) {
    form.reset({
      slotDate: defaultDate ?? weekOf,
      startTime: '09:00',
      endTime: '17:00',
      isOvernight: false,
    })
  }
}, [open, defaultDate, weekOf])
```

#### 4b. Overnight end time cap tại 06:00 (AC9)

```typescript
// Overnight end time options: chỉ 00:00 → 06:00
const overnightEndOptions = TIME_OPTIONS.filter(t => {
  const [h] = t.split(':').map(Number)
  return h <= 6  // 00:00, 00:30, ..., 06:00
})

// Thay thế endTimeOptions computation:
const endTimeOptions = (() => {
  if (isOvernight) {
    // Overnight mode: chỉ sáng sớm hôm sau (00:00–06:00)
    return overnightEndOptions
  }
  // Normal mode: chỉ times > startTime
  return TIME_OPTIONS.filter(t => t > startTime)
})()
```

**Xóa section "Overnight section" hiện tại** (các `SelectItem` với `value="__overnight_separator__"` và `overnight-*`). Thay bằng approach mới: khi user chọn end time nhỏ hơn start time trong non-overnight mode → set `isOvernight = true` → dropdown tự cập nhật về overnightEndOptions.

#### 4c. Hint text (AC10)

```typescript
const showNextDayHint = isOvernight
  && endTime !== ''
  && (() => {
    const [startH] = startTime.split(':').map(Number)
    return startH <= 6  // start time sáng sớm = có thể nhầm
  })()
```

Render hint trong form (dưới duration preview):
```tsx
{showNextDayHint && (
  <div className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 rounded p-2">
    💡 Ca hoàn toàn trong sáng ngày hôm sau? Hãy chọn ngày tiếp theo trong dropdown bên trên.
  </div>
)}
```

#### 4d. Dialog UI redesign (AC8)

**Layout time row: 2 fields với dấu `→` ở giữa:**
```tsx
<div className="flex items-end gap-2">
  {/* Start time field */}
  <div className="flex-1">
    <FormLabel>Bắt đầu</FormLabel>
    {/* Select... */}
  </div>

  <span className="text-muted-foreground pb-2">→</span>

  {/* End time field với "+1 ngày" badge */}
  <div className="flex-1">
    <FormLabel>Kết thúc</FormLabel>
    <div className="flex items-center gap-1.5">
      {/* Select... */}
      {isOvernight && (
        <span className="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 px-1.5 py-0.5 rounded font-medium whitespace-nowrap">
          +1 ngày
        </span>
      )}
    </div>
  </div>
</div>
```

**Error dưới time row** (thay vì dưới start time field):
Validation error `form.setError('startTime', ...)` sẽ vẫn trigger, nhưng **không hiển thị** `<FormMessage />` dưới start time field. Thay vào đó, render `<FormMessage />` sau cả `div` time row.

**Disabled submit khi có error:**
```typescript
const hasAnyError = Object.keys(form.formState.errors).length > 0

// Trong footer:
<Button type="submit" disabled={isLoading || hasAnyError}>
  {isLoading ? 'Đang lưu...' : 'Thêm slot →'}
</Button>
```

**Bỏ "Hủy qua đêm" link** — thay bằng `+1 ngày` badge inline. Function `cancelOvernight` sẽ không còn cần thiết.

---

### 5. `schedule.tsx` (route) — Week nav center, 3-tier routing, pre-fill date (AC4, AC5, AC6)

#### 5a. Centering week navigation (AC4)

**Hiện tại**: Week nav nằm trong `<div className="flex items-center gap-3">` bên trái header
**Thay đổi**: Di chuyển week nav ra ngoài, đặt riêng trong block căn giữa:

```tsx
<div className="flex flex-col gap-4 p-4 md:p-6">
  {/* Title row */}
  <div className="flex items-center gap-2">
    <CalendarDays className="h-6 w-6 text-muted-foreground" />
    <h1 className="text-xl font-semibold">Lịch làm việc</h1>
  </div>

  {/* Week navigation — centered */}
  <div className="flex items-center justify-center gap-1">
    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePrevWeek} title="Tuần trước">
      <ChevronLeft className="h-4 w-4" />
    </Button>
    <span className="text-sm text-muted-foreground tabular-nums px-2">
      {format(parseISO(currentWeekOf), 'dd/MM')} – {format(addDays(parseISO(currentWeekOf), 6), 'dd/MM/yyyy')}
    </span>
    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNextWeek} title="Tuần sau">
      <ChevronRight className="h-4 w-4" />
    </Button>
    {!isViewingCurrentWeek && (
      <Button variant="ghost" size="sm" className="h-6 text-xs px-2 text-blue-600 hover:text-blue-700" onClick={handleGoToCurrentWeek}>
        Tuần này
      </Button>
    )}
  </div>

  {/* Right side: deadline badge + add button */}
  <div className="flex items-center justify-between gap-4 flex-wrap">
    {/* ... deadline badge ... */}
    {/* ... add button ... */}
  </div>
```

#### 5b. State cho defaultDate và bỏ emergency state

```typescript
// THÊM:
const [slotFormDefaultDate, setSlotFormDefaultDate] = useState<string | undefined>(undefined)

// XÓA các state này:
// const [editIsEmergency, setEditIsEmergency] = useState(false)
// const [deleteIsEmergency, setDeleteIsEmergency] = useState(false)

// SỬA handleAddSlot — lưu date để pre-fill:
function handleAddSlot(date: string) {
  setSlotFormDefaultDate(date)
  setSlotFormOpen(true)
}
```

#### 5c. Thêm mutation hooks cho Tier 3

```typescript
import { useUpdateSlotDirect } from '@/features/schedule/hooks/use-update-slot-direct'
import { useDeleteSlotDirect } from '@/features/schedule/hooks/use-delete-slot-direct'
import { getSlotEditMode } from '@/features/schedule/utils/schedule.utils'

// Trong component:
const updateSlotDirect = useUpdateSlotDirect(scheduleWeek?.id)
const deleteSlotDirect = useDeleteSlotDirect(scheduleWeek?.id)
```

#### 5d. 3-tier routing cho edit và delete handlers

```typescript
function handleEditSlot(slotId: string) {
  const slot = findSlot(slotId)
  if (!slot) return
  const mode = getSlotEditMode(slot.slot_date, userTimezone)

  if (mode === 'reason-required') {
    // Tier 2: mở EditSlotDialog (cần reason, gọi RPC)
    setEditingSlot(slot)
    setEditDialogOpen(true)
  } else if (mode === 'free') {
    // Tier 3: mở EditSlotDialog KHÔNG cần reason (direct call)
    setEditingSlot(slot)
    setEditDialogOpen(true)
    // EditSlotDialog đang được reuse — cần truyền isEmergency=false để không hỏi reason?
    // Xem chi tiết ở phần "Reuse EditSlotDialog cho Tier 3" bên dưới
  }
  // Tier 1 (locked): không làm gì — UI đã không hiển thị button
}

function handleDeleteSlot(slotId: string) {
  const slot = findSlot(slotId)
  if (!slot) return
  const mode = getSlotEditMode(slot.slot_date, userTimezone)

  if (mode === 'reason-required') {
    // Tier 2: mở DeleteSlotDialog
    setDeletingSlot(slot)
    setDeleteDialogOpen(true)
  } else if (mode === 'free') {
    // Tier 3: direct delete — không cần dialog, hoặc confirm đơn giản
    // Implement: direct delete ngay khi click (không cần confirm)
    deleteSlotDirect.mutate({ slotId })
  }
}
```

**⚠️ Reuse `EditSlotDialog` cho Tier 3**: `EditSlotDialog` hiện có prop `isEmergency` để hiển thị warning. Với Tier 3, truyền `isEmergency={false}`. Nhưng EditSlotDialog vẫn yêu cầu nhập reason (kiểm tra code). Nếu EditSlotDialog bắt buộc reason field, có 2 lựa chọn:
- **Option A (đơn giản hơn)**: Trong `handleEditSubmit`, check mode của slot và route sang `updateSlotDirect` hoặc `updateSlot` RPC tương ứng
- **Option B**: Tạo SimpleEditDialog riêng cho Tier 3

**Khuyến nghị Option A** (ít code mới hơn):

```typescript
function handleEditSubmit(data: {
  newStartTimeUTC: Date
  newDurationMinutes: number
  reason: string
  isEmergency: boolean
}) {
  if (!editingSlot) return
  const mode = getSlotEditMode(editingSlot.slot_date, userTimezone)

  if (mode === 'free') {
    // Tier 3: direct update — không cần reason, không notify
    updateSlotDirect.mutate(
      {
        slotId: editingSlot.id,
        newStartTimeUTC: data.newStartTimeUTC,
        newDurationMinutes: data.newDurationMinutes,
        slotDate: ??? // cần tính slot_date mới
      },
      { onSuccess: () => { setEditDialogOpen(false); setEditingSlot(null) } }
    )
  } else {
    // Tier 2: RPC với reason bắt buộc
    updateSlot.mutate(
      { slotId: editingSlot.id, newStartTimeUTC: data.newStartTimeUTC, newDurationMinutes: data.newDurationMinutes, reason: data.reason, isEmergencyOverride: false },
      { onSuccess: () => { setEditDialogOpen(false); setEditingSlot(null) } }
    )
  }
}
```

#### 5e. XÓA các handler emergency cũ

```typescript
// XÓA hoàn toàn:
// function handleEmergencyOverride(slotId: string) { ... }
// function handleEmergencyDelete(slotId: string) { ... }
```

#### 5f. Cập nhật SlotForm props

```tsx
<SlotForm
  open={slotFormOpen}
  onOpenChange={setSlotFormOpen}
  weekOf={currentWeekOf}
  defaultDate={slotFormDefaultDate}   // ← THÊM
  existingSlots={slots}
  onSubmit={handleAddSlotSubmit}
  isLoading={upsertSlots.isPending}
  userTimezone={userTimezone}
  tenantTimezone={tenantTimezone}
/>
```

---

### 6. `use-update-slot-direct.ts` (TẠO MỚI)

**⚠️ CRITICAL: DB trigger `validate_slot_date` fires on UPDATE** — khi update `start_time`, BẮT BUỘC phải update `slot_date` tương ứng. Nếu không, trigger sẽ throw exception `'slot_date (X) không khớp với ngày của start_time (Y)'`.

**RLS đã cho phép**: `schedule_slots_update_policy` cho phép `user_id = auth.uid()` update trực tiếp.

```typescript
// src/features/schedule/hooks/use-update-slot-direct.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { supabase } from '@/lib/supabase-browser'
import { QUERY_KEYS } from '@/lib/query-keys'

/**
 * useUpdateSlotDirect — Tier 3 direct update (không cần reason, không notify)
 *
 * ⚠️ MUST update slot_date along with start_time (DB trigger validate_slot_date fires on UPDATE)
 * slot_date tính theo tenantTimezone (không phải userTimezone)
 */
export function useUpdateSlotDirect(weekId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      slotId,
      newStartTimeUTC,
      newDurationMinutes,
      tenantTimezone,
    }: {
      slotId: string
      newStartTimeUTC: Date
      newDurationMinutes: number
      tenantTimezone: string
    }) => {
      // Tính slot_date mới từ start_time UTC theo tenant timezone
      const newSlotDate = format(
        toZonedTime(newStartTimeUTC, tenantTimezone),
        'yyyy-MM-dd'
      )

      const { error } = await supabase
        .from('schedule_slots')
        .update({
          start_time: newStartTimeUTC.toISOString(),
          duration_minutes: newDurationMinutes,
          slot_date: newSlotDate,         // ← BẮT BUỘC, trigger validate
        })
        .eq('id', slotId)

      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Đã cập nhật ca làm việc')
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.scheduleSlots, weekId] })
    },
    onError: (error: Error) => {
      toast.error('Không thể cập nhật: ' + error.message)
    },
  })
}
```

**Về `tenantTimezone`**: Hook này cần `tenantTimezone` vì slot_date phải tính theo TENANT timezone (không phải user timezone). Truyền vào từ route level.

---

### 7. `use-delete-slot-direct.ts` (TẠO MỚI)

**RLS đã cho phép**: `schedule_slots_delete_policy` cho phép `user_id = auth.uid()` delete trực tiếp.

```typescript
// src/features/schedule/hooks/use-delete-slot-direct.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase-browser'
import { QUERY_KEYS } from '@/lib/query-keys'

/**
 * useDeleteSlotDirect — Tier 3 direct delete (không cần reason, không notify)
 */
export function useDeleteSlotDirect(weekId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ slotId }: { slotId: string }) => {
      const { error } = await supabase
        .from('schedule_slots')
        .delete()
        .eq('id', slotId)

      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Đã xóa ca làm việc')
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.scheduleSlots, weekId] })
    },
    onError: (error: Error) => {
      toast.error('Không thể xóa: ' + error.message)
    },
  })
}
```

---

### 8. `schedule.test.ts` — Cập nhật tests (thay `isSlotLocked` bằng `getSlotEditMode`)

**XÓA** các test cases của `isSlotLocked` (5 tests).

**THÊM** test suite cho `getSlotEditMode`:

```typescript
import { getSlotEditMode } from '../utils/schedule.utils'
// Xóa: import { isSlotLocked } từ utils

describe('getSlotEditMode', () => {
  const TZ = 'Asia/Ho_Chi_Minh'

  // Để test deterministic, cần mock date hoặc dùng dates trong quá khứ/tương lai cụ thể
  // Dùng vi.useFakeTimers() để control "today"

  beforeEach(() => {
    // Set fake today = Thứ Tư 2026-03-25 12:00 ICT = 2026-03-25T05:00:00Z
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-25T05:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('slot_date trước today → locked', () => {
    expect(getSlotEditMode('2026-03-24', TZ)).toBe('locked')
  })

  it('slot_date = today → reason-required', () => {
    expect(getSlotEditMode('2026-03-25', TZ)).toBe('reason-required')
  })

  it('slot_date = Sunday (cuối tuần này) → reason-required', () => {
    // Thứ Tư 25/03, Sunday = 29/03
    expect(getSlotEditMode('2026-03-29', TZ)).toBe('reason-required')
  })

  it('slot_date = next Monday → free', () => {
    // Thứ Tư 25/03, next Monday = 30/03
    expect(getSlotEditMode('2026-03-30', TZ)).toBe('free')
  })

  it('slot_date 2 tuần sau → free', () => {
    expect(getSlotEditMode('2026-04-06', TZ)).toBe('free')
  })

  it('khi today là Sunday, next_monday = tomorrow', () => {
    vi.setSystemTime(new Date('2026-03-29T05:00:00Z')) // Sunday 29/03 ICT
    // Sunday 29/03 = reason-required (còn trong current week)
    expect(getSlotEditMode('2026-03-29', TZ)).toBe('reason-required')
    // Monday 30/03 = free
    expect(getSlotEditMode('2026-03-30', TZ)).toBe('free')
  })
})
```

**⚠️ Import `vi`** từ `vitest` nếu chưa có:
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
```

---

## Guardrails Quan Trọng

### ❌ KHÔNG ĐƯỢC làm

1. **Đừng thay đổi `EditSlotDialog.tsx` và `DeleteSlotDialog.tsx`** — các component này vẫn được dùng cho Tier 2 và sẽ được tái sử dụng cho Tier 3 edit (xem Option A ở trên)

2. **Đừng sửa `schedule.service.ts`** — service đã đầy đủ, không cần thêm method mới. Direct update/delete dùng `supabase` client trực tiếp trong hook

3. **Đừng quên `slot_date` khi update** — DB trigger `validate_slot_date` BẮT BUỘC `slot_date` khớp với `start_time` theo tenant timezone. Bỏ sót sẽ throw exception mà user không hiểu

4. **Đừng notify manager cho Tier 3** — intentional design decision. Tier 3 = future planning, chưa committed

5. **Đừng dùng `isSlotLocked` ở bất kỳ đâu** sau khi sửa — xóa hẳn, import nào cũng phải cập nhật

6. **Đừng thêm migration** — không có DB change trong story này. RLS policies đã đủ

### ✅ PHẢI làm

1. **Tìm và cập nhật TẤT CẢ references** tới `isSlotLocked`, `onEmergencyOverride`, `onEmergencyDelete` trong codebase (dùng search)

2. **Test `getSlotEditMode` với fake date** — function phụ thuộc `new Date()`, test không fake = flaky

3. **Pass `tenantTimezone`** xuống `useUpdateSlotDirect` khi gọi — cần để tính `slot_date` đúng

4. **Reset SlotForm khi `open` thay đổi** — form reset với `defaultDate` mới khi mở dialog

---

## File Structure Summary

```
SỬA:
├── src/features/schedule/utils/schedule.utils.ts          ← xóa isSlotLocked, thêm getSlotEditMode
├── src/features/schedule/components/ScheduleDeadlineBadge.tsx  ← fix timezone display
├── src/features/schedule/components/ScheduleGrid.tsx      ← header fix, 3-tier SlotCard
├── src/features/schedule/components/SlotForm.tsx          ← defaultDate, cap overnight, hint, redesign
├── src/routes/_app/schedule.tsx                           ← week nav center, 3-tier routing
└── src/features/schedule/__tests__/schedule.test.ts       ← replace isSlotLocked tests

TẠO MỚI:
├── src/features/schedule/hooks/use-update-slot-direct.ts  ← Tier 3 direct update
└── src/features/schedule/hooks/use-delete-slot-direct.ts  ← Tier 3 direct delete

KHÔNG THAY ĐỔI:
├── src/features/schedule/schemas/schedule.schema.ts
├── src/features/schedule/services/schedule.service.ts
├── src/features/schedule/hooks/use-update-slot.ts         (Tier 2 giữ nguyên)
├── src/features/schedule/hooks/use-delete-slot-with-reason.ts  (Tier 2)
├── src/features/schedule/components/EditSlotDialog.tsx    (reused for Tier 2 + Tier 3)
├── src/features/schedule/components/DeleteSlotDialog.tsx  (reused for Tier 2)
└── supabase/                                              (không có DB change)
```

---

## Checklist Trước Khi Done

- [ ] `npm run lint` — 0 errors, 0 warnings
- [ ] `npm run test` — Vitest tests pass (thêm tests cho `getSlotEditMode`, xóa `isSlotLocked` tests)
- [ ] `npx supabase test db` — tất cả pgTAP tests pass (no regression)
- [ ] Manual AC1: Deadline badge hiển thị "23:59" thay vì "16:59" (test với deadline UTC)
- [ ] Manual AC2: Column header "T2" và "23/03" hiển thị rõ ràng, không concatenate
- [ ] Manual AC3: Click "+" trên Thứ Sáu → dialog pre-fill "Thứ Sáu"
- [ ] Manual AC4: Week nav centered giữa trang
- [ ] Manual AC5: Slot ngày hôm qua → grayed out, không có buttons
- [ ] Manual AC5: Slot hôm nay → Sửa/Xóa → reason dialog → manager notified (Tier 2)
- [ ] Manual AC5: Slot Thứ Hai tuần sau → Sửa/Xóa → no reason dialog, direct call (Tier 3)
- [ ] Manual AC6: Tier 3 edit/delete không gọi RPC, manager không nhận notification
- [ ] Manual AC7: Slot card 3 visual states đúng theo spec
- [ ] Manual AC8: Add slot dialog có "→" giữa time pickers, "+1 ngày" badge, disabled button khi error
- [ ] Manual AC9: Overnight end time dropdown dừng ở 06:00
- [ ] Manual AC10: Hint text xuất hiện khi start=00:30, isOvernight=true
- [ ] Tất cả references `isSlotLocked` đã bị xóa — search codebase kiểm tra
- [ ] `onEmergencyOverride`, `onEmergencyDelete` không còn ở bất kỳ file nào
- [ ] Dev Agent Record đầy đủ trước khi mark done

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5 — 2026-03-24

### Debug Log References

Không có issue phát sinh trong quá trình implement.

### Completion Notes List

- **AC1 (Bug Fix timezone)**: Xóa `toZonedTime` trong `ScheduleDeadlineBadge.tsx`, dùng `format` với `timeZone` option trực tiếp → tránh double conversion.
- **AC2 (Column header)**: Tách `dayName` và `dateFormatted` thành 2 `<p>` riêng trong `DayColumn`, không dùng `\n` nữa → không bị concatenate.
- **AC3 (Pre-fill date)**: Thêm prop `defaultDate?: string` vào `SlotForm`, reset form với `defaultDate ?? weekOf` khi `open` thay đổi. `handleAddSlot` truyền `date` vào `setSlotFormDefaultDate`.
- **AC4 (Week nav centered)**: Di chuyển week navigation ra thành block riêng với `justify-center`, tách khỏi title row.
- **AC5 (3-tier lock model)**: Xóa `isSlotLocked`, thêm `getSlotEditMode` với 3 tier: locked/reason-required/free. `ScheduleGrid` dùng `getSlotEditMode(slot.slot_date, userTimezone)` thay vì `isSlotLocked(slot.start_time)`.
- **AC6 (No reason for Tier 3 delete)**: `handleDeleteSlot` route Tier 3 → `deleteSlotDirect.mutate()` trực tiếp, không mở dialog.
- **AC7 (Slot card 3 states)**: `SlotCard` có 3 visual state: locked (opacity-50, disabled icon-only buttons), reason-required/free (active icon-only Pencil + Trash2 buttons, không có text label). Slot bị khoá không hiển thị lock icon hay text "Đã qua" — chỉ disable buttons để giao diện nhất quán.
- **AC8 (Dialog redesign)**: `SlotForm` redesigned với `→` giữa time pickers, `+1 ngày` badge thay `Hủy qua đêm` link, error message dưới cả time row, submit disabled khi có error.
- **AC9 (Overnight cap 06:00)**: `OVERNIGHT_END_OPTIONS` chỉ gồm 00:00–06:00. End time dropdown dùng list này khi `isOvernight=true`.
- **AC10 (Hint text)**: `showNextDayHint` hiện khi `isOvernight=true` và `startH <= 6`.
- **Tier 3 edit (no reason dialog)**: Thêm prop `requireReason?: boolean` vào `EditSlotDialog`. `schedule.tsx` truyền `requireReason={getSlotEditMode(...) === 'reason-required'}` — Tier 3 ẩn reason field, submit thẳng. `handleEditSubmit` route sang `updateSlotDirect` cho Tier 3.
- **Hooks mới**: `use-update-slot-direct.ts` và `use-delete-slot-direct.ts` — direct `.update()`/`.delete()` qua Supabase client, không gọi RPC, không notify manager.
- **Tests**: Thay 5 tests `isSlotLocked` bằng 6 tests `getSlotEditMode` với `vi.useFakeTimers()` để deterministic.

### File List

```
MODIFIED:
├── src/features/schedule/utils/schedule.utils.ts               ← xóa isSlotLocked, thêm getSlotEditMode + SlotEditMode type
├── src/features/schedule/components/ScheduleDeadlineBadge.tsx  ← fix timezone double conversion (AC1)
├── src/features/schedule/components/ScheduleGrid.tsx           ← column header fix, 3-tier SlotCard icon-only buttons
├── src/features/schedule/components/SlotForm.tsx               ← defaultDate, overnight cap, hint text, dialog redesign
├── src/features/schedule/components/EditSlotDialog.tsx         ← thêm prop requireReason, ẩn reason field cho Tier 3
├── src/routes/_app/schedule.tsx                                ← week nav center, 3-tier routing, requireReason prop
└── src/features/schedule/__tests__/schedule.test.ts            ← thay isSlotLocked tests bằng getSlotEditMode tests

CREATED:
├── src/features/schedule/hooks/use-update-slot-direct.ts  ← Tier 3 direct update
└── src/features/schedule/hooks/use-delete-slot-direct.ts  ← Tier 3 direct delete
```

---

## Change Log

- **2026-03-24** — Story tạo từ Epic 2 Retrospective với status backlog
- **2026-03-24** — Story enriched với comprehensive dev context, status: ready-for-dev
- **2026-03-24** — Implementation hoàn thành, status: review (AC1–AC10 satisfied, 115 unit tests pass, 56 pgTAP tests pass, lint clean)
- **2026-03-25** — Post-review UX fixes: (1) SlotCard buttons → icon-only, bỏ text "Sửa"/"Xóa"; (2) Locked slot → disable buttons thay vì ẩn + lock icon; (3) `EditSlotDialog` thêm prop `requireReason` — Tier 3 không hỏi lý do khi sửa slot
