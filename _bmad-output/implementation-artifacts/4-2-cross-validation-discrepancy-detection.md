# Story 4.2: Cross-validation & Discrepancy Detection

**Status:** done
**Epic:** 4 — Daily Report
**Story ID:** 4.2
**Story Key:** 4-2-cross-validation-discrepancy-detection
**Created:** 2026-03-24

---

## Story

As a member,
I want the system to flag potential discrepancies in my report before I submit,
So that I can catch mistakes and ensure my report accurately reflects my work.

---

## Acceptance Criteria

1. **Hiển thị flag khi phát hiện discrepancy** — Khi member nhập `hours_logged > 4` AND số lượng tasks `≤ 1` AND không có `output_link` nào (tất cả đều rỗng) → form hiển thị inline alert: `"Bạn báo cáo Xh nhưng số lượng tasks có vẻ ít — muốn thêm task không?"` (X là giá trị `hours_logged` thực tế).

2. **Flag là suggestion — không block submit** — Member vẫn có thể submit bình thường. Flag chỉ là gợi ý, không disable form hay submit button.

3. **"Thêm task" từ flag** — Khi member click "Thêm task" trong alert → append task row mới vào form (giống behavior button "Thêm task" hiện có). Flag tự biến mất khi `tasks.length > 1`.

4. **"Bỏ qua, nộp luôn"** — Khi member click "Bỏ qua, nộp luôn" trong alert → form submit ngay lập tức với dữ liệu hiện tại (gọi `form.handleSubmit(onSubmit)`). Behavior giống nhấn submit button chính.

5. **Flag tự ẩn khi condition không còn thỏa** — Alert tự disappear (reactive) khi: `hours_logged ≤ 4` HOẶC `tasks.length > 1` HOẶC có ít nhất 1 task có `output_link` non-empty.

6. **Không lưu trạng thái flag vào DB** — Flag là pure UI/client-side logic. Không thêm field nào vào `daily_reports` table. DB không biết flag có xuất hiện hay không.

---

## Tasks / Subtasks

### Utility Function

- [x] Task 1: Thêm `hasDiscrepancy` vào `src/features/daily-report/schemas/daily-report.schema.ts` (AC: #1, #5)
  - [x] Export `hasDiscrepancy(hoursLogged: number, tasks: TaskItem[]): boolean`
  - [x] Logic: `hoursLogged > 4 && tasks.length <= 1 && !tasks.some(t => t.output_link && t.output_link.trim() !== '')`
  - [x] Đặt sau các schema exports hiện có — không xóa/sửa gì đã có

### Component Enhancement

- [x] Task 2: Cập nhật `src/features/daily-report/components/DailyReportForm.tsx` (AC: #1–#5)
  - [x] Thêm import: `TriangleAlert` từ `lucide-react`
  - [x] Thêm import: `Alert, AlertDescription` từ `@/components/ui/alert`
  - [x] Trong `DailyReportForm`, thêm `useWatch` cho `hours_logged` và toàn bộ `tasks` array
  - [x] Tính `showFlag = hasDiscrepancy(hoursWatched, tasksWatched)` (reactive, không cần useState)
  - [x] Render `DiscrepancyAlert` component (inline hoặc sub-component) khi `showFlag === true`
  - [x] "Thêm task" trong alert gọi `append({ description: '', output_type: 'other', output_link: '' })`
  - [x] "Bỏ qua, nộp luôn" gọi `form.handleSubmit(onSubmit)()` trực tiếp

### Tests

- [x] Task 3: Thêm tests vào `src/features/daily-report/__tests__/daily-report.test.ts` (AC: #1, #5)
  - [x] `hasDiscrepancy` returns `true`: `hours > 4`, `tasks.length = 1`, no output_link
  - [x] `hasDiscrepancy` returns `false`: `hours <= 4` (boundary: 4.0 → false)
  - [x] `hasDiscrepancy` returns `false`: `tasks.length > 1` (2 tasks)
  - [x] `hasDiscrepancy` returns `false`: 1 task có output_link non-empty
  - [x] `hasDiscrepancy` returns `false`: 1 task có output_link = `''` → true (empty không tính)
  - [x] Boundary: `hours = 4.5` (> 4) + 1 task no link → true
  - [x] Boundary: `hours = 5`, tasks = `[]` (empty array, length = 0 ≤ 1) → true

---

## Dev Notes

### Tổng Quan — Story này là Pure Frontend Enhancement

Story 4.2 **chỉ thay đổi 1 component** (`DailyReportForm.tsx`) và **thêm 1 pure function** vào schema. Không có:
- Migration mới (daily_reports table không thay đổi)
- Service/hook mới
- Route mới
- Supabase query mới

### Discrepancy Detection Logic — Pure Function

```typescript
// Thêm vào: src/features/daily-report/schemas/daily-report.schema.ts
// Đặt SAU tất cả exports hiện có, KHÔNG sửa gì đã có

/**
 * Phát hiện potential discrepancy: nhiều giờ nhưng ít task/output.
 * Pure function — không side effects, không async.
 */
export function hasDiscrepancy(hoursLogged: number, tasks: TaskItem[]): boolean {
  const hasAnyOutputLink = tasks.some(t => t.output_link && t.output_link.trim() !== '')
  return hoursLogged > 4 && tasks.length <= 1 && !hasAnyOutputLink
}
```

**Edge cases cần xử lý:**
- `tasks = []` (length 0, ≤ 1) → condition triggered nếu hours > 4
- `output_link = ''` (empty string) → KHÔNG tính là có link
- `output_link = '   '` (whitespace) → KHÔNG tính là có link (dùng `.trim()`)
- `hours_logged = 4.0` → `4 > 4` = false → KHÔNG hiện flag
- `hours_logged = 4.5` → `4.5 > 4` = true → có thể hiện flag

### DailyReportForm.tsx — Thay Đổi Cần Thiết

**Imports mới (thêm vào):**
```typescript
import { TriangleAlert } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { hasDiscrepancy } from '@/features/daily-report/schemas/daily-report.schema'
```

**Trong `DailyReportForm` component (sau `useFieldArray`):**
```typescript
// Watch reactive values cho discrepancy detection
const hoursWatched = useWatch({ control: form.control, name: 'hours_logged' })
const tasksWatched = useWatch({ control: form.control, name: 'tasks' })

// Computed — tự update khi field thay đổi, không cần useState
const showFlag = hasDiscrepancy(hoursWatched ?? 0, tasksWatched ?? [])
```

**DiscrepancyAlert — Render inline trong form (trước submit button, sau Separator):**
```tsx
{showFlag && (
  <Alert className='border-yellow-200 bg-yellow-50 text-yellow-800'>
    <TriangleAlert className='h-4 w-4 text-yellow-600' />
    <AlertDescription>
      <p>
        Bạn báo cáo {hoursWatched}h nhưng số lượng tasks có vẻ ít — muốn thêm task không?
      </p>
      <div className='mt-2 flex gap-2'>
        <Button
          type='button'
          size='sm'
          variant='outline'
          className='border-yellow-300 bg-white text-yellow-800 hover:bg-yellow-50'
          onClick={() => append({ description: '', output_type: 'other', output_link: '' })}
        >
          <Plus className='mr-1 h-3 w-3' />
          Thêm task
        </Button>
        <Button
          type='button'
          size='sm'
          variant='ghost'
          className='text-yellow-700 hover:bg-yellow-100'
          onClick={() => form.handleSubmit(onSubmit)()}
        >
          Bỏ qua, nộp luôn
        </Button>
      </div>
    </AlertDescription>
  </Alert>
)}
```

**Vị trí trong JSX của form:**
```tsx
<fieldset disabled={isPending} className='space-y-6'>
  {/* Tasks list */}
  <div className='space-y-4'>
    ...tasks và "Thêm task" button...
  </div>

  <Separator />

  {/* Hours logged */}
  <FormField name='hours_logged' ... />

  {/* ← THÊM VÀO ĐÂY — sau hours_logged, trước submit button */}
  {showFlag && <Alert>...</Alert>}

  <Button type='submit' className='w-full'>
    {isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
    Nộp Daily Report
  </Button>
</fieldset>
```

### Alert Component — Shadcn Alert Đã Có

`Alert` component tại `src/components/ui/alert.tsx` có 2 variants: `default` và `destructive`. Không có `warning` variant.

**Dùng `className` override để tạo warning style:**
```tsx
<Alert className='border-yellow-200 bg-yellow-50 text-yellow-800'>
```
Không cần thêm variant mới vào Alert — dùng inline Tailwind là đủ.

**Exports của Alert:**
```typescript
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
// AlertTitle là optional — story 4.2 không cần title riêng
```

### useWatch Pattern — Nhất Quán Với Codebase

`DailyReportForm` đã dùng `useWatch` trong `TaskRow` sub-component. Tương tự, dùng `useWatch` ở form level:

```typescript
// ✅ Pattern đã có trong codebase (từ TaskRow)
const outputType = useWatch({ control, name: `tasks.${index}.output_type` })

// ✅ Pattern mới tương tự — watch ở form level
const hoursWatched = useWatch({ control: form.control, name: 'hours_logged' })
const tasksWatched = useWatch({ control: form.control, name: 'tasks' })
```

`useWatch` là memoization-safe và tuân thủ React Compiler rules — nhất quán với comment `"useWatch là memoization-safe thay cho form.watch() trong loop"` đã có.

### "Bỏ qua, nộp luôn" — Gọi handleSubmit Directly

```typescript
// ✅ Cách đúng để trigger submit từ button không phải type="submit"
onClick={() => form.handleSubmit(onSubmit)()
// form.handleSubmit(onSubmit) → trả về event handler function
// () → gọi ngay lập tức (không cần event)
```

Khi `fieldset disabled={isPending}` → cả Alert buttons cũng bị disabled khi đang submit → consistent behavior.

### File Structure — Chỉ Modify, Không Tạo Mới

```
MODIFY:
  src/features/daily-report/components/DailyReportForm.tsx   ← chính
  src/features/daily-report/schemas/daily-report.schema.ts   ← thêm hasDiscrepancy
  src/features/daily-report/__tests__/daily-report.test.ts   ← thêm tests

KHÔNG TẠO MỚI:
  Không cần file mới — enhancement của existing feature

KHÔNG THAY ĐỔI:
  src/features/daily-report/services/daily-report.service.ts  (không logic mới)
  src/features/daily-report/hooks/use-submit-report.ts        (không thay đổi)
  src/features/daily-report/hooks/use-today-report.ts         (không thay đổi)
  src/features/daily-report/components/DailyReportView.tsx    (view-only, không liên quan)
  src/routes/_app/daily-report.tsx                            (không thay đổi)
  Tất cả migration files                                      (daily_reports table OK)
```

### DB Schema — Không Thay Đổi

`daily_reports` table đã đủ từ Story 4.1. Flag là pure FE — không cần field mới.

```sql
-- Không cần migration mới
-- daily_reports table hiện có (từ 20260323000007_create_daily_reports.sql):
-- id, tenant_id, user_id, report_date, tasks (jsonb), hours_logged, is_late, submitted_at, created_at
```

### Patterns Bắt Buộc — Codebase

```typescript
// ✅ Named export — không default export
export function DailyReportForm(...)
export function hasDiscrepancy(...)

// ✅ Import supabase singleton (không liên quan story này — nhắc để không quên)
import { supabase } from '@/lib/supabase-browser'

// ✅ cn() cho conditional className
import { cn } from '@/lib/utils'

// ✅ lucide-react icons (không cài icon lib khác)
import { TriangleAlert, Plus, Loader2 } from 'lucide-react'

// ✅ Sonner toast (nếu cần)
import { toast } from 'sonner'
```

### Không Làm Trong Story 4.2

- ❌ Lưu discrepancy flag vào DB → không bao giờ (pure FE suggestion)
- ❌ Manager view → Story 4.3
- ❌ Backend validation của discrepancy → không có (FE-only)
- ❌ Edit report đã submit → không bao giờ (append-only design)
- ❌ Thêm `warning` variant mới vào Alert component → dùng className override là đủ

### Learnings Từ Story 4.1

- **`useWatch` thay vì `form.watch()`** — Đã establish trong codebase. Dùng `useWatch` cho reactive values, không gọi `form.watch()` trong render.
- **`TaskRow` sub-component pattern** — Tách sub-component khi cần `useWatch` trong loop để tuân thủ Rules of Hooks.
- **Discrepancy flag trong story này KHÔNG phải sub-component** — chỉ là inline JSX trong `DailyReportForm` (không cần `useWatch` trong loop).
- **`fieldset disabled={isPending}`** — Tự động disable tất cả inputs + buttons bên trong khi pending. Alert buttons cũng được cover.
- **`output_link = ''` pattern** — Empty string là valid (dùng `.trim()` khi kiểm tra).

---

## Checklist Trước Khi Done

- [ ] `npm run lint` — 0 errors
- [ ] `npm run test` — Vitest pass (tất cả tests, bao gồm tests mới cho `hasDiscrepancy`)
- [ ] `npx supabase test db` — pgTAP pass (không có migration mới, nhưng chạy verify không có regression)
- [ ] Manual test: `hours_logged = 3`, 1 task, no link → flag KHÔNG hiện
- [ ] Manual test: `hours_logged = 5`, 1 task, no link → flag HIỆN với "5h"
- [ ] Manual test: `hours_logged = 5`, 2 tasks → flag TỰ ẨN
- [ ] Manual test: `hours_logged = 5`, 1 task có output_link → flag TỰ ẨN
- [ ] Manual test: click "Thêm task" trong flag → task row mới được thêm, flag biến mất
- [ ] Manual test: click "Bỏ qua, nộp luôn" → report được submit bình thường
- [ ] Manual test: `hours_logged = 4` (boundary) → flag KHÔNG hiện (4 không > 4)
- [ ] Manual test: `hours_logged = 4.5` (boundary) → flag HIỆN

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5

### Debug Log References

Không có issue nào — implementation straightforward.

### Completion Notes List

- Thêm `hasDiscrepancy(hoursLogged, tasks)` pure function vào schema — logic: `hours > 4 AND tasks.length ≤ 1 AND !hasAnyOutputLink`
- Cập nhật `DailyReportForm.tsx`: thêm 2x `useWatch` (hours_logged + tasks), discrepancy alert với 2 CTAs
- Alert render inline (không tách sub-component) — đúng theo story spec vì không cần `useWatch` trong loop
- `TriangleAlert` icon + yellow color scheme via Tailwind className override (Alert component không có warning variant)
- "Bỏ qua, nộp luôn" dùng `form.handleSubmit(onSubmit)()` — gọi direct submit từ non-submit button
- `fieldset disabled={isPending}` tự cover cả alert buttons — no extra logic needed
- 12 unit tests mới cho `hasDiscrepancy` — bao gồm boundary cases (4.0 vs 4.5), whitespace link, empty array, undefined output_link field
- Kết quả: 69/69 Vitest pass (tăng từ 57), 27/27 pgTAP pass, 0 lint errors

### File List

**Thay đổi:**
- `src/features/daily-report/schemas/daily-report.schema.ts`
- `src/features/daily-report/components/DailyReportForm.tsx`
- `src/features/daily-report/__tests__/daily-report.test.ts`

---

## Change Log

- 2026-03-24: Story 4.2 created — Cross-validation & Discrepancy Detection. Pure FE enhancement to DailyReportForm.
- 2026-03-24: Story 4.2 implemented — hasDiscrepancy function + DailyReportForm inline alert + 12 unit tests. 69/69 Vitest + 27/27 pgTAP pass.

---

## Completion Note

Story được tạo tự động bởi create-story workflow — 2026-03-24.
Context đầy đủ từ: epics.md (Epic 4, Story 4.2), story 4.1 patterns, DailyReportForm.tsx source, Alert component source.
