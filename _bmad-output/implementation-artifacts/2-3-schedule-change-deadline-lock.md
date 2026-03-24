# Story 2.3: Schedule Change & Deadline Lock

**Status:** review
**Epic:** 2 — Schedule Registration
**Story ID:** 2.3
**Story Key:** 2-3-schedule-change-deadline-lock
**Created:** 2026-03-24

---

## Story

As a member,
I want to update my schedule when plans change, with the system requiring a reason and locking slots once they've started,
So that my manager is always informed and the schedule-as-commitment model is maintained.

---

## Acceptance Criteria

1. **Edit unlocked slot với reason bắt buộc** — Khi member edit slot chưa bị lock: hiển thị dialog yêu cầu nhập lý do (không được để trống). Sau khi confirm: slot được cập nhật, lý do được ghi vào `schedule_slot_changes` (change_type='updated'), Manager/Owner nhận in-app notification kèm lý do.

2. **Deadline lock** — Khi `NOW() UTC >= slot.start_time` UTC: slot được hiển thị với trạng thái "Đã khóa" (lock icon + badge). Member KHÔNG thể edit/delete bình thường. Nút Trash2 bị disabled hoặc ẩn.

3. **Emergency Override cho locked slot** — Khi member chọn "Emergency Override" trên locked slot và nhập lý do bắt buộc: slot được phép **edit hoặc delete**. Với **edit**: lý do được ghi vào `schedule_slot_changes` (change_type='emergency_override'), Manager/Owner nhận in-app notification về emergency override kèm lý do. Với **delete**: do `schedule_slot_changes.slot_id` có `ON DELETE CASCADE`, change record sẽ bị xóa cùng slot nên không insert — notification tới managers đóng vai trò audit trail cho deletion (intentional, MVP).

4. **Delete slot với reason** — Khi member xóa slot (locked hoặc unlocked): cũng yêu cầu reason dialog. Sau khi confirm: notification gửi tới managers/owners với lý do; slot bị xóa.

5. **Server-side lock enforcement** — RPC server từ chối update/delete slot locked mà không có `p_is_emergency_override = true` (RAISE EXCEPTION). Client-side lock check chỉ là UX, không phải security boundary.

---

## Tasks / Subtasks

### Task 1: DB Migration — RPCs `update_slot_with_reason` + `delete_slot_with_reason`

**File:** `supabase/migrations/20260324000011_schedule_change_rpcs.sql`

**Lý do cần RPC (không direct client call):**
- Phải atomic: update slot + insert change record + insert notifications trong 1 transaction
- Phải enforce deadline lock server-side (client-side chỉ là UX)
- Phải xác thực ownership (slot thuộc về caller)
- SECURITY DEFINER cho phép notify managers mà không bị RLS block (notifications_insert_policy chỉ check `tenant_id = current_tenant_id()`, nhưng insert cho other users cần bypass user_id check)

---

**RPC 1: `update_slot_with_reason`**

```sql
CREATE OR REPLACE FUNCTION public.update_slot_with_reason(
  p_slot_id              uuid,
  p_new_start_time       timestamptz,
  p_new_duration_minutes smallint,
  p_reason               text,
  p_is_emergency_override boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_user_id       uuid;
  v_tenant_id     uuid;
  v_tenant_tz     text;
  v_new_slot_date date;
  v_slot          public.schedule_slots%ROWTYPE;
  v_changer_name  text;
BEGIN
  v_user_id   := auth.uid();
  v_tenant_id := public.current_tenant_id();

  IF v_user_id IS NULL OR v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Chưa xác thực';
  END IF;

  -- Validate reason không rỗng
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'Lý do thay đổi là bắt buộc';
  END IF;

  -- Lấy slot — verify ownership + tenant
  SELECT * INTO v_slot
  FROM public.schedule_slots
  WHERE id = p_slot_id
    AND user_id   = v_user_id
    AND tenant_id = v_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Slot không tồn tại hoặc bạn không có quyền chỉnh sửa';
  END IF;

  -- Deadline lock check (server-side enforcement)
  IF NOT p_is_emergency_override AND now() >= v_slot.start_time THEN
    RAISE EXCEPTION 'Slot này đã bị khóa. Dùng Emergency Override để thay đổi.';
  END IF;

  -- Tính slot_date mới từ new start_time theo tenant timezone
  -- (Bắt buộc — DB trigger validate_slot_date sẽ kiểm tra lại)
  SELECT t.timezone INTO v_tenant_tz
  FROM public.tenants t WHERE t.id = v_tenant_id;

  v_new_slot_date := (p_new_start_time AT TIME ZONE v_tenant_tz)::date;

  -- Update slot
  UPDATE public.schedule_slots
  SET
    start_time       = p_new_start_time,
    duration_minutes = p_new_duration_minutes,
    slot_date        = v_new_slot_date,
    updated_at       = now()
  WHERE id = p_slot_id;

  -- Audit trail
  INSERT INTO public.schedule_slot_changes (tenant_id, slot_id, changed_by, change_type, reason)
  VALUES (
    v_tenant_id,
    p_slot_id,
    v_user_id,
    CASE WHEN p_is_emergency_override THEN 'emergency_override' ELSE 'updated' END,
    p_reason
  );

  -- Lấy tên người thay đổi để ghi vào notification message
  SELECT full_name INTO v_changer_name
  FROM public.users WHERE id = v_user_id;

  -- Notify tất cả managers/owners trong tenant (không self-notify)
  INSERT INTO public.notifications (tenant_id, user_id, type, message, link_to)
  SELECT
    v_tenant_id,
    tm.user_id,
    'schedule_changed',
    CASE
      WHEN p_is_emergency_override
        THEN coalesce(v_changer_name, 'Thành viên') || ' đã dùng Emergency Override để thay đổi lịch. Lý do: ' || p_reason
      ELSE
        coalesce(v_changer_name, 'Thành viên') || ' đã thay đổi lịch làm việc. Lý do: ' || p_reason
    END,
    '/schedule'
  FROM public.tenant_members tm
  WHERE tm.tenant_id = v_tenant_id
    AND tm.role IN ('owner', 'manager')
    AND tm.status = 'active'
    AND tm.user_id <> v_user_id;  -- không notify chính mình (nếu member cũng là manager)
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_slot_with_reason(uuid, timestamptz, smallint, text, boolean) TO authenticated;
```

---

**RPC 2: `delete_slot_with_reason`**

> ⚠️ **Lưu ý CASCADE limitation:** `schedule_slot_changes.slot_id` có `ON DELETE CASCADE`. Khi slot bị DELETE, mọi change record của slot đó cũng bị xóa. Do đó, với delete: KHÔNG insert change record (vô nghĩa vì sẽ bị cascade). Thay vào đó, notification tới managers đóng vai trò audit trail cho deletion (message chứa lý do). Đây là thiết kế intentional cho MVP.

```sql
CREATE OR REPLACE FUNCTION public.delete_slot_with_reason(
  p_slot_id              uuid,
  p_reason               text,
  p_is_emergency_override boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_user_id      uuid;
  v_tenant_id    uuid;
  v_slot         public.schedule_slots%ROWTYPE;
  v_changer_name text;
BEGIN
  v_user_id   := auth.uid();
  v_tenant_id := public.current_tenant_id();

  IF v_user_id IS NULL OR v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Chưa xác thực';
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'Lý do xóa là bắt buộc';
  END IF;

  SELECT * INTO v_slot
  FROM public.schedule_slots
  WHERE id = p_slot_id
    AND user_id   = v_user_id
    AND tenant_id = v_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Slot không tồn tại hoặc bạn không có quyền xóa';
  END IF;

  IF NOT p_is_emergency_override AND now() >= v_slot.start_time THEN
    RAISE EXCEPTION 'Slot này đã bị khóa. Dùng Emergency Override để xóa.';
  END IF;

  SELECT full_name INTO v_changer_name
  FROM public.users WHERE id = v_user_id;

  -- Notify managers TRƯỚC khi xóa slot (cần slot data cho message)
  INSERT INTO public.notifications (tenant_id, user_id, type, message, link_to)
  SELECT
    v_tenant_id,
    tm.user_id,
    'schedule_changed',
    CASE
      WHEN p_is_emergency_override
        THEN coalesce(v_changer_name, 'Thành viên') || ' đã xóa ca làm việc (Emergency Override). Lý do: ' || p_reason
      ELSE
        coalesce(v_changer_name, 'Thành viên') || ' đã xóa ca làm việc. Lý do: ' || p_reason
    END,
    '/schedule'
  FROM public.tenant_members tm
  WHERE tm.tenant_id = v_tenant_id
    AND tm.role IN ('owner', 'manager')
    AND tm.status = 'active'
    AND tm.user_id <> v_user_id;

  -- Xóa slot (sẽ cascade delete schedule_slot_changes của slot này — acceptable cho MVP)
  DELETE FROM public.schedule_slots
  WHERE id = p_slot_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_slot_with_reason(uuid, text, boolean) TO authenticated;
```

---

**RLS cho 2 RPCs:** Cả 2 functions đều SECURITY DEFINER — không cần thêm RLS policy mới. Chúng tự kiểm tra ownership + tenant_id internally.

---

### Task 2: Service Methods

**File:** `src/features/schedule/services/schedule.service.ts` ← thêm 2 methods mới

```typescript
// Thêm vào ScheduleService object:

updateSlotWithReason: async (
  slotId: string,
  newStartTimeUTC: Date,
  newDurationMinutes: number,
  reason: string,
  isEmergencyOverride: boolean = false
): Promise<void> => {
  const { error } = await supabase.rpc('update_slot_with_reason', {
    p_slot_id:               slotId,
    p_new_start_time:        newStartTimeUTC.toISOString(),
    p_new_duration_minutes:  newDurationMinutes,
    p_reason:                reason,
    p_is_emergency_override: isEmergencyOverride,
  })
  if (error) throw error
},

deleteSlotWithReason: async (
  slotId: string,
  reason: string,
  isEmergencyOverride: boolean = false
): Promise<void> => {
  const { error } = await supabase.rpc('delete_slot_with_reason', {
    p_slot_id:               slotId,
    p_reason:                reason,
    p_is_emergency_override: isEmergencyOverride,
  })
  if (error) throw error
},
```

---

### Task 3: Hooks mới

**File 1:** `src/features/schedule/hooks/use-update-slot.ts` ← TẠO MỚI

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { QUERY_KEYS } from '@/lib/query-keys'
import { ScheduleService } from '../services/schedule.service'

export function useUpdateSlot(weekId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      slotId,
      newStartTimeUTC,
      newDurationMinutes,
      reason,
      isEmergencyOverride,
    }: {
      slotId: string
      newStartTimeUTC: Date
      newDurationMinutes: number
      reason: string
      isEmergencyOverride?: boolean
    }) =>
      ScheduleService.updateSlotWithReason(
        slotId,
        newStartTimeUTC,
        newDurationMinutes,
        reason,
        isEmergencyOverride ?? false
      ),
    onSuccess: (_data, variables) => {
      toast.success(variables.isEmergencyOverride ? 'Emergency Override thành công' : 'Đã cập nhật ca làm việc')
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.scheduleSlots, weekId] })
    },
    onError: (error: Error) => {
      toast.error('Không thể cập nhật: ' + error.message)
    },
  })
}
```

**File 2:** `src/features/schedule/hooks/use-delete-slot-with-reason.ts` ← TẠO MỚI

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { QUERY_KEYS } from '@/lib/query-keys'
import { ScheduleService } from '../services/schedule.service'

export function useDeleteSlotWithReason(weekId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      slotId,
      reason,
      isEmergencyOverride,
    }: {
      slotId: string
      reason: string
      isEmergencyOverride?: boolean
    }) =>
      ScheduleService.deleteSlotWithReason(slotId, reason, isEmergencyOverride ?? false),
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

### Task 4: Utility — `isSlotLocked`

**File:** `src/features/schedule/utils/schedule.utils.ts` ← thêm function mới

```typescript
/**
 * isSlotLocked — deadline lock: slot bị lock khi current UTC >= slot start_time UTC
 * Client-side check chỉ dùng cho UX (disable buttons, show lock badge).
 * Server-side enforcement trong RPC update_slot_with_reason / delete_slot_with_reason.
 */
export function isSlotLocked(slotStartTime: string): boolean {
  return Date.now() >= new Date(slotStartTime).getTime()
}
```

---

### Task 5: Component `EditSlotDialog`

**File:** `src/features/schedule/components/EditSlotDialog.tsx` ← TẠO MỚI

Dialog để edit một slot đã có — reuse cùng time picker logic từ `SlotForm` nhưng:
- Pre-fill giá trị từ slot hiện tại
- Thêm "Lý do thay đổi" textarea (required)
- Khi `isEmergency = true`: hiển thị warning banner màu đỏ/vàng
- Overlap check phải exclude slot đang được edit (`excludeSlotId`)
- Submit: gọi `onSubmit({ newStartTimeUTC, newDurationMinutes, reason, isEmergency })`

**Props:**

```typescript
interface EditSlotDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  slot: ScheduleSlot                // slot đang edit (để pre-fill)
  existingSlots: ScheduleSlot[]     // để check overlap (exclude slot này)
  weekOf: string                    // để generate day options
  userTimezone: string
  tenantTimezone: string
  isEmergency?: boolean             // true = emergency override mode
  isLoading?: boolean
  onSubmit: (data: {
    newStartTimeUTC: Date
    newDurationMinutes: number
    reason: string
    isEmergency: boolean
  }) => void
}
```

**Emergency warning banner khi `isEmergency = true`:**
```tsx
<div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
  ⚠️ Emergency Override — ca này đã bắt đầu. Hành động này sẽ được ghi lại và manager sẽ được thông báo.
</div>
```

**Reason textarea (required, min 1 char sau trim):**
```tsx
<FormField
  name="reason"
  render={({ field }) => (
    <FormItem>
      <FormLabel>
        Lý do {isEmergency ? 'Emergency Override' : 'thay đổi'} <span className="text-destructive">*</span>
      </FormLabel>
      <FormControl>
        <Textarea
          {...field}
          placeholder="Nhập lý do thay đổi..."
          className="resize-none"
          rows={3}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

**Zod schema cho EditSlotDialog:**
```typescript
const editSlotDialogSchema = z.object({
  slotDate:  z.string(),
  startTime: z.string(),
  endTime:   z.string(),
  isOvernight: z.boolean(),
  reason:    z.string().trim().min(1, 'Lý do không được để trống'),
})
```

---

### Task 6: Component `DeleteSlotDialog`

**File:** `src/features/schedule/components/DeleteSlotDialog.tsx` ← TẠO MỚI

Dialog xác nhận xóa — đơn giản hơn (không cần time picker):
- Hiển thị thông tin slot (ngày, giờ) để user biết đang xóa slot nào
- Textarea lý do xóa (required)
- Khi `isEmergency = true`: warning banner
- Submit → gọi `onConfirm({ reason, isEmergency })`

**Props:**
```typescript
interface DeleteSlotDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  slot: ScheduleSlot | null       // null = closed
  userTimezone: string
  isEmergency?: boolean
  isLoading?: boolean
  onConfirm: (data: { reason: string; isEmergency: boolean }) => void
}
```

---

### Task 7: Cập nhật `ScheduleGrid` + `SlotCard`

**File:** `src/features/schedule/components/ScheduleGrid.tsx`

**SlotCard — thay đổi:**
1. Thêm prop `isLocked: boolean`
2. Thêm Edit button (Pencil icon) bên cạnh Trash2 button
3. Khi `isLocked`:
   - Hiển thị lock badge: `<Lock className="h-3 w-3 text-muted-foreground" />` trong slot card
   - Disable nút Trash2 và Edit bình thường
   - Thay bằng nút "Override" (hoặc tooltip "Đã khóa — Click để Emergency Override")
4. Khi không locked:
   - Trash2: trigger delete dialog
   - Pencil: trigger edit dialog

**SlotCard Props mới:**
```typescript
interface SlotCardProps {
  slot: ScheduleSlot
  userTimezone: string
  isLocked: boolean                   // NEW
  onEdit: (slotId: string) => void    // NEW — open EditSlotDialog
  onDelete: (slotId: string) => void  // existing — now opens DeleteSlotDialog (not direct delete)
  onEmergencyOverride: (slotId: string) => void  // NEW — emergency EDIT for locked slots
  onEmergencyDelete: (slotId: string) => void    // NEW — emergency DELETE for locked slots (AC3)
  isDeleting?: boolean
}
```

**SlotCard UI khi locked:**
```tsx
{isLocked ? (
  <>
    <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
    {/* AC3: Emergency Override mở EditSlotDialog */}
    <Button
      variant="ghost"
      size="sm"
      className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
      onClick={() => onEmergencyOverride(slot.id)}
    >
      Override
    </Button>
    {/* AC3: Emergency Delete mở DeleteSlotDialog với isEmergency=true */}
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 text-muted-foreground hover:text-destructive"
      onClick={() => onEmergencyDelete(slot.id)}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  </>
) : (
  <>
    <Button variant="ghost" size="icon" className="h-6 w-6 ..." onClick={() => onEdit(slot.id)}>
      <Pencil className="h-3.5 w-3.5" />
    </Button>
    <Button variant="ghost" size="icon" className="h-6 w-6 ... text-destructive ..." onClick={() => onDelete(slot.id)}>
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  </>
)}
```

**ScheduleGrid Props mới:**
```typescript
interface ScheduleGridProps {
  // ... existing props ...
  onEditSlot: (slotId: string) => void           // NEW
  onDeleteSlot: (slotId: string) => void         // existing (now triggers dialog)
  onEmergencyOverride: (slotId: string) => void  // NEW — emergency edit
  onEmergencyDelete: (slotId: string) => void    // NEW — emergency delete (AC3)
  isDeletingSlotId?: string
}
```

**isLocked calculation trong ScheduleGrid/DayColumn/DayRow:**
```typescript
// Truyền isLocked vào từng SlotCard:
<SlotCard
  slot={slot}
  isLocked={isSlotLocked(slot.start_time)}
  ...
/>
```

---

### Task 8: Cập nhật `schedule.tsx` (route)

**File:** `src/routes/_app/schedule.tsx`

**Thay đổi:**
1. Xóa `deleteSlot` mutation cũ (direct supabase delete)
2. Thêm `useUpdateSlot(scheduleWeek?.id)` hook
3. Thêm `useDeleteSlotWithReason(scheduleWeek?.id)` hook
4. Thêm state để track slot đang được thao tác:
   ```typescript
   const [editingSlot, setEditingSlot] = useState<ScheduleSlot | null>(null)
   const [deletingSlot, setDeletingSlot] = useState<ScheduleSlot | null>(null)
   const [editDialogOpen, setEditDialogOpen] = useState(false)
   const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
   const [isEmergencyMode, setIsEmergencyMode] = useState(false)
   ```
5. Helper để tìm slot từ ID:
   ```typescript
   function findSlot(slotId: string) {
     return slots.find(s => s.id === slotId) ?? null
   }
   ```
6. Handlers:
   ```typescript
   function handleEditSlot(slotId: string) {
     const slot = findSlot(slotId)
     if (!slot) return
     setEditingSlot(slot)
     setIsEmergencyMode(false)
     setEditDialogOpen(true)
   }

   function handleDeleteSlot(slotId: string) {
     const slot = findSlot(slotId)
     if (!slot) return
     setDeletingSlot(slot)
     setIsEmergencyMode(false)
     setDeleteDialogOpen(true)
   }

   function handleEmergencyOverride(slotId: string) {
     const slot = findSlot(slotId)
     if (!slot) return
     setEditingSlot(slot)
     setIsEmergencyMode(true)
     setEditDialogOpen(true)
   }
   ```
7. Submit handlers:
   ```typescript
   function handleEditSubmit(data: { newStartTimeUTC: Date; newDurationMinutes: number; reason: string; isEmergency: boolean }) {
     if (!editingSlot) return
     updateSlot.mutate({
       slotId: editingSlot.id,
       newStartTimeUTC: data.newStartTimeUTC,
       newDurationMinutes: data.newDurationMinutes,
       reason: data.reason,
       isEmergencyOverride: data.isEmergency,
     }, {
       onSuccess: () => setEditDialogOpen(false),
     })
   }

   function handleDeleteConfirm(data: { reason: string; isEmergency: boolean }) {
     if (!deletingSlot) return
     deleteSlotWithReason.mutate({
       slotId: deletingSlot.id,
       reason: data.reason,
       isEmergencyOverride: data.isEmergency,
     }, {
       onSuccess: () => setDeleteDialogOpen(false),
     })
   }
   ```
8. Truyền handlers xuống `ScheduleGrid`:
   ```tsx
   <ScheduleGrid
     ...
     onAddSlot={handleAddSlot}
     onEditSlot={handleEditSlot}
     onDeleteSlot={handleDeleteSlot}
     onEmergencyOverride={handleEmergencyOverride}
     onEmergencyDelete={handleEmergencyDelete}
   />
   ```
9. Thêm `EditSlotDialog` và `DeleteSlotDialog` ở cuối render

---

## Dev Notes

### Foundation từ Story 2.2 — ĐÃ CÓ SẴN

| File | Trạng thái | Ghi chú |
|------|-----------|---------|
| `src/features/schedule/services/schedule.service.ts` | ✅ có | Thêm 2 methods mới |
| `src/features/schedule/utils/schedule.utils.ts` | ✅ có | Thêm `isSlotLocked` function |
| `src/features/schedule/hooks/use-upsert-slots.ts` | ✅ có | KHÔNG thay đổi |
| `src/features/schedule/hooks/use-previous-week-slots.ts` | ✅ có | KHÔNG thay đổi |
| `src/routes/_app/schedule.tsx` | ✅ có | Cập nhật handlers + dialogs |
| `ScheduleGrid`, `SlotForm`, `ScheduleDeadlineBadge` | ✅ có | ScheduleGrid cập nhật; SlotForm KHÔNG thay đổi |
| `upsert_week_slots` RPC | ✅ có | KHÔNG thay đổi — vẫn dùng cho add slot + template apply |

### Schema Đã Có — KHÔNG Cần Migration Mới Cho Tables

**`schedule_slot_changes`** (migration 20260323000006):
```sql
-- slot_change_type: ('created', 'updated', 'deleted', 'emergency_override') -- ĐÃ CÓ!
-- Các columns: id, tenant_id, slot_id (FK CASCADE), changed_by, change_type, reason, created_at
```

**`notifications`** (migration 20260323000008):
```sql
-- notification_type: ..., 'schedule_changed', ... -- ĐÃ CÓ!
-- Columns: id, tenant_id, user_id, type, message, is_read, link_to, created_at
```

→ **Chỉ cần 1 migration mới:** `20260324000011_schedule_change_rpcs.sql` (2 RPCs)

### `upsert_week_slots` — KHÔNG Dùng Cho Story 2.3 Edit/Delete

`upsert_week_slots` vẫn dùng cho:
- Add slot mới (Story 2.1 flow — KHÔNG thay đổi)
- Apply template từ tuần trước (Story 2.2 — KHÔNG thay đổi)

Story 2.3 KHÔNG dùng `upsert_week_slots` cho edit/delete vì:
- `upsert_week_slots` delete ALL + insert ALL → không ghi lý do per-slot
- Edit/delete riêng lẻ cần audit trail với reason → dùng RPCs mới

### Deadline Lock — 2 Tầng

**Client-side (UX only):**
```typescript
import { isSlotLocked } from '../utils/schedule.utils'

// Trong SlotCard:
const locked = isSlotLocked(slot.start_time)
// → disabled buttons, lock icon, show "Override" button
```

**Server-side (security boundary):**
- RPC `update_slot_with_reason` + `delete_slot_with_reason` enforce lock check
- Nếu `NOT p_is_emergency_override AND now() >= slot.start_time` → RAISE EXCEPTION
- Client phải set `p_is_emergency_override = true` để bypass

### RPC `update_slot_with_reason` — Xử Lý `slot_date`

Khi update `start_time`, `slot_date` phải được tính lại:
```sql
-- RPC tự tính v_new_slot_date từ tenant timezone:
v_new_slot_date := (p_new_start_time AT TIME ZONE v_tenant_tz)::date;
```

DB trigger `validate_slot_date` sẽ validate lại sau UPDATE — không cần client tính.

**Trong frontend**, `EditSlotDialog.onSubmit`:
```typescript
// Client chỉ cần pass newStartTimeUTC và newDurationMinutes
// RPC tự tính lại slot_date → safe với mọi timezone
const { startTimeUTC, durationMinutes } = convertSlotToUTC(values, userTimezone, tenantTimezone)
onSubmit({
  newStartTimeUTC: startTimeUTC,
  newDurationMinutes: durationMinutes,
  reason: values.reason,
  isEmergency,
})
```

### CASCADE Limitation — Delete Audit Trail

`schedule_slot_changes.slot_id ON DELETE CASCADE` → khi slot bị DELETE, change records cũng bị xóa.

**Giải pháp cho MVP:** Notification tới managers (permanent, không cascade) chứa lý do đầy đủ → đủ để audit deletion.
- Notifications không có cascade → persist sau khi slot bị xóa
- Message format: `"[Tên] đã xóa ca làm việc. Lý do: [reason]"`

**Không cần migration để fix FK** — đây là known design trade-off, acceptable cho MVP.

### RLS cho RPCs — KHÔNG Cần Policy Mới

Cả 2 RPCs đều `SECURITY DEFINER`:
- Internal queries bypass RLS
- Functions validate ownership manually: `WHERE id = p_slot_id AND user_id = v_user_id AND tenant_id = v_tenant_id`
- INSERT notifications cho managers bypass notifications RLS (SECURITY DEFINER context)

Tuy nhiên, **GRANT EXECUTE** bắt buộc:
```sql
GRANT EXECUTE ON FUNCTION public.update_slot_with_reason(...) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_slot_with_reason(...) TO authenticated;
```

### Patterns Bắt Buộc — Từ Stories 2.1 + 2.2

```typescript
// ✅ Named export — không default export
export function useUpdateSlot(...)
export function useDeleteSlotWithReason(...)
export function isSlotLocked(...)

// ✅ Service: throw on error
if (error) throw error

// ✅ getSession() (cached) thay vì getUser() (network)
const { data: { session } } = await supabase.auth.getSession()

// ✅ Sonner toast
toast.success('...'), toast.error('...')

// ✅ QUERY_KEYS từ src/lib/query-keys.ts
queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.scheduleSlots, weekId] })

// ✅ shadcn/ui components: Dialog, Form, FormField, Textarea, Button
// ✅ Zod resolver với react-hook-form
// ✅ date-fns cho date manipulation

// ✅ Imports từ Lucide: Pencil, Lock (thêm vào ScheduleGrid imports)
import { Plus, Trash2, Clock, Pencil, Lock } from 'lucide-react'
```

### `EditSlotDialog` — Reuse Logic Từ `SlotForm`

`EditSlotDialog` phải reuse TIME_OPTIONS, overnight detection, overlap check — copy pattern từ `SlotForm`:
- TIME_OPTIONS array (giống SlotForm) — có thể extract vào shared constant sau này
- `endTimeOptions` filter logic (giống SlotForm)
- Overnight detection khi endTime <= startTime (giống SlotForm)
- `calcDurationMinutes` + `formatDuration` từ schedule.schema.ts
- `hasOverlapWithExisting` từ schedule.utils.ts với `excludeSlotId = slot.id`
- `convertSlotToUTC` từ schedule.service.ts

**Pre-fill từ slot hiện tại:**
```typescript
// Convert slot UTC time → user timezone để pre-fill form
import { toZonedTime, format as formatTz } from 'date-fns-tz'

const startInUserTz = toZonedTime(new Date(slot.start_time), userTimezone)
const defaultStartTime = formatTz(startInUserTz, 'HH:mm', { timeZone: userTimezone })

const endMs = new Date(slot.start_time).getTime() + slot.duration_minutes * 60 * 1000
const endInUserTz = toZonedTime(new Date(endMs), userTimezone)
const defaultEndTime = formatTz(endInUserTz, 'HH:mm', { timeZone: userTimezone })

const isOvernight = defaultEndTime <= defaultStartTime

defaultValues: {
  slotDate: slot.slot_date,  // YYYY-MM-DD
  startTime: defaultStartTime,
  endTime: defaultEndTime,
  isOvernight,
  reason: '',
}
```

### Scope Boundary — KHÔNG Làm Trong Story 2.3

- ❌ Manager xem/approve/reject change requests → out of scope
- ❌ Change history view cho member (list các lần edit) → out of scope
- ❌ Email notification (chỉ in-app cho MVP) → Story 6.2 scope
- ❌ Auto-create empty schedule → Story 2.4
- ❌ Supabase Realtime cho live notifications → Story 6.1 scope
- ❌ Modify `upsert_week_slots` RPC → KHÔNG làm, giữ nguyên

### NFR Requirements

- **NFR4:** Edit/delete dialog phải respond < 1 giây sau user interaction — mutations optimistic hoặc instant close on success
- **NFR2:** API response < 500ms p95 — RPCs làm ít queries (≤4 operations: validate + update/delete + change record + notifications)
- **NFR9:** Tenant isolation — RPCs validate tenant_id = current_tenant_id() trước mọi operation

---

## File Structure — Tóm Tắt Thay Đổi

```
TẠO MỚI:
  supabase/migrations/20260324000011_schedule_change_rpcs.sql   ← 2 RPCs
  src/features/schedule/hooks/use-update-slot.ts
  src/features/schedule/hooks/use-delete-slot-with-reason.ts
  src/features/schedule/components/EditSlotDialog.tsx
  src/features/schedule/components/DeleteSlotDialog.tsx

SỬA (không tạo mới):
  src/features/schedule/services/schedule.service.ts   ← thêm updateSlotWithReason, deleteSlotWithReason
  src/features/schedule/utils/schedule.utils.ts        ← thêm isSlotLocked
  src/features/schedule/components/ScheduleGrid.tsx    ← SlotCard + props mới
  src/routes/_app/schedule.tsx                         ← handlers + dialogs mới

KHÔNG thay đổi:
  SlotForm.tsx
  ScheduleDeadlineBadge.tsx
  use-schedule-week.ts, use-schedule-slots.ts, use-upsert-slots.ts, use-previous-week-slots.ts
  schedule.schema.ts
  Tất cả migrations trước 000011
```

---

## Checklist Trước Khi Done

- [ ] `npx supabase db push --local` — migration 000011 apply thành công
- [ ] `npx supabase test db` — 27+ pgTAP tests PASS (không có regressions)
- [ ] `npm run lint` — 0 errors, 0 warnings
- [ ] `npm run test` — Vitest tests pass (thêm tests cho `isSlotLocked`)
- [ ] Manual: Edit unlocked slot → dialog xuất hiện, reason required → save → slot updated, toast success
- [ ] Manual: Delete unlocked slot → dialog xuất hiện, reason required → confirm → slot xóa, toast success
- [ ] Manual: Slot đã qua start_time → lock icon hiện, nút edit/delete disabled → "Override" button hiện
- [ ] Manual: Emergency Override → warning banner xuất hiện → save → toast "Emergency Override thành công"
- [ ] Manual: Bỏ trống reason → form validation lỗi, không submit
- [ ] Manual: Check Supabase DB → `schedule_slot_changes` có record mới cho edit (không cho delete — cascade)
- [ ] Manual: Check notifications table → managers nhận notification với lý do đúng

---

## Completion Note

Story được tạo tự động bởi create-story workflow — 2026-03-24.
Context đầy đủ từ: epics.md, architecture.md, story 2-2 implementation, source code review (schedule.service.ts, ScheduleGrid.tsx, schedule.tsx, migrations 000006/000008/000009/000011).
Dev agent có đủ thông tin để implement flawlessly.
