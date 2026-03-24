# Story 4.5: Per-task Hours

**Status:** done
**Epic:** 4 — Daily Report
**Story ID:** 4.5
**Story Key:** 4-5-per-task-hours
**Created:** 2026-03-24

---

## Story

As a member,
I want to log how many hours I spent on each individual task,
So that my daily report provides granular effort tracking rather than just a total.

---

## Acceptance Criteria

1. **Thêm hours field vào mỗi task** — Trong form submit, mỗi `TaskRow` có thêm 1 input số giờ (numeric, 0.5–24, step 0.5, **bắt buộc**). Input có `FormLabel` riêng "Số giờ *", nằm bên trái nhóm output type/link trong cùng 1 hàng flex.

2. **Auto-compute total hours** — Khi tất cả tasks đều có `hours > 0`, field `hours_logged` tự động được tính bằng `sum(task.hours)` qua `useEffect`. `hours_logged` **không hiển thị dưới dạng input** — thay bằng read-only display text "Tổng giờ làm việc: Xh".

3. **hours là bắt buộc cho submission mới** — `taskItemFormSchema` (dùng trong form) require `hours >= 0.5`. Validation error "Số giờ phải lớn hơn 0" khi để trống hoặc điền 0. `taskItemSchema` gốc vẫn giữ `hours` optional để backward compat với data cũ trong DB.

4. **Hiển thị per-task hours trong read-only view** — `DailyReportView` hiển thị `Xh` badge nhỏ cạnh task description nếu `task.hours > 0`. Nếu `task.hours` undefined hoặc 0 → không hiện (backward compat).

5. **Backward compatible** — Reports cũ không có `task.hours` trong DB → render bình thường trong `DailyReportView`, `ReportHistoryList`, `TeamReportList`. `taskItemSchema` (optional hours) dùng cho display/read path. `taskItemFormSchema` (required hours) chỉ dùng cho form submit path.

6. **`hasDiscrepancy` cập nhật** — Khi tất cả tasks đều có `hours > 0` → dùng `sum(task.hours)` để detect discrepancy, thay vì `hoursLogged`. Khi không có per-task hours → giữ nguyên logic cũ.

7. **Không có DB migration** — `tasks` là `jsonb`. Thêm field `hours` vào object trong array mà không cần migration. Schema validation chỉ ở FE/TypeScript.

---

## Tasks / Subtasks

### Schema

- [x] Task 1: Cập nhật `src/features/daily-report/schemas/daily-report.schema.ts`
  - [x] `taskItemSchema` giữ `hours` optional (backward compat cho display/DB read path):
    - [x] `hours: z.number().min(0).max(24).multipleOf(0.5).optional()`
  - [x] Thêm mới `taskItemFormSchema` (extend `taskItemSchema`, override `hours` thành required):
    - [x] `hours: z.number({ invalid_type_error: ... }).min(0.5, 'Số giờ phải lớn hơn 0').max(24).multipleOf(0.5)`
  - [x] Export `type TaskFormItem = z.infer<typeof taskItemFormSchema>`
  - [x] `dailyReportFormSchema` dùng `z.array(taskItemFormSchema)` (thay vì `taskItemSchema`)
  - [x] `DailyReportFormValues` tự update qua infer
  - [x] Cập nhật `hasDiscrepancy(hoursLogged, tasks)`:
    - [x] Compute: `const allHasTaskHours = tasks.length > 0 && tasks.every(t => t.hours !== undefined && t.hours > 0)`
    - [x] `effectiveHours = allHasTaskHours ? tasks.reduce((sum, t) => sum + (t.hours ?? 0), 0) : hoursLogged`
    - [x] `return effectiveHours > 4 && tasks.length <= 1 && !hasAnyOutputLink`

### Service

- [x] Task 2: Cập nhật `src/features/daily-report/services/daily-report.service.ts`
  - [x] Thêm `hours?: number` vào `TaskPayload` type
  - [x] Không thay đổi function nào — `submitReport` pass `tasks` as-is

### Form Component

- [x] Task 3: Cập nhật `TaskRow` trong `src/features/daily-report/components/DailyReportForm.tsx`
  - [x] Thêm `FormField` cho `tasks.${index}.hours` với `FormLabel` riêng "Số giờ *":
    - [x] `<Input type="number" min={0.5} max={24} step={0.5} placeholder="VD: 2" />`
    - [x] `onChange: (e) => { const val = parseFloat(e.target.value); field.onChange(isNaN(val) ? undefined : val) }`
    - [x] Width: `className="w-[80px] shrink-0"`
  - [x] Layout: 2 nhóm riêng trong 1 flex row: `[Số giờ * · 80px] | [Output link (optional) · flex-1]`
    - [x] Hours có `FormLabel` "Số giờ *" (với `<span className='text-destructive'>*</span>`)
    - [x] Output type + link vẫn có section label `<p>` "Output link (optional)" như cũ
  - [x] `append()` default: `append({ description: '', output_type: 'other', output_link: '', hours: undefined })`
  - [x] Cập nhật cả 2 chỗ gọi `append()`: button "Thêm task" và button trong discrepancy alert

- [x] Task 4: Auto-compute `hours_logged` và ẩn input trong `DailyReportForm`
  - [x] `tasksWatched` + `hoursWatched` đều dùng `useWatch`
  - [x] `useEffect` auto-compute: khi `allFilled = true` → `form.setValue('hours_logged', sum, { shouldDirty: false, shouldValidate: false })`
  - [x] **Ẩn `hours_logged` FormField** — thay bằng read-only display:
    - [x] `<div className='flex items-center justify-between rounded-lg border px-4 py-3'>`
    - [x] Hiện `{hoursWatched}h` nếu `hoursWatched > 0`, ngược lại hiện `"—"`
  - [x] `hours_logged` vẫn được submit đúng (RHF giữ field value mà không cần render input)
  - [x] `showFlag = hasDiscrepancy(hoursWatched ?? 0, tasksWatched ?? [])` vẫn đúng

### View Component

- [x] Task 5: Cập nhật `src/features/daily-report/components/DailyReportView.tsx`
  - [x] Cập nhật `TaskData` type: thêm `hours?: number` (optional — backward compat)
  - [x] Trong task row render: nếu `task.hours && task.hours > 0` → hiện hours badge
  - [x] Vị trí: trong `div` cùng description, giữa description và output_type badge
  - [x] Không thay đổi phần nào khác

### Tests

- [x] Task 6: Cập nhật `src/features/daily-report/__tests__/daily-report.test.ts`
  - [x] `taskItemSchema` hours tests (optional, backward compat):
    - [x] `hours: 0.5` → valid
    - [x] `hours: 0` → valid (optional, min 0)
    - [x] `hours: undefined` → valid (optional)
    - [x] `hours: -1` → invalid (min 0)
    - [x] `hours: 25` → invalid (max 24)
    - [x] `hours: 0.3` → invalid (bội số 0.5)
    - [x] `hours: 24` → valid (boundary)
  - [x] `taskItemFormSchema` hours tests (required — test suite mới):
    - [x] valid task với hours → valid
    - [x] hours missing → invalid (required)
    - [x] `hours: undefined` → invalid (required)
    - [x] `hours: 0` → invalid (min 0.5)
    - [x] `hours: 0.5` → valid
    - [x] `hours: 24` → valid (boundary)
    - [x] `hours: 25` → invalid (max 24)
    - [x] `hours: 1.3` → invalid (bội số 0.5, dùng 1.3 thay vì 0.3 để pass min trước)
  - [x] `dailyReportFormSchema` — cập nhật `validForm` và fixtures thêm `hours` (required):
    - [x] `validForm.tasks[0].hours = 2`
    - [x] `accepts multiple tasks` — thêm `hours` vào mỗi task
  - [x] `hasDiscrepancy` per-task hours tests (giữ nguyên — dùng `TaskItem` optional hours):
    - [x] 1 task `hours: 5` → discrepancy true
    - [x] 1 task `hours: 2`, sum = 2 ≤ 4 → false
    - [x] 1 task `hours: 2`, sum = 4 boundary → false
    - [x] task có output_link → false dù sum > 4
    - [x] partial hours → fallback về `hoursLogged`

---

## Dev Notes

### Tổng Quan

Story 4.5 là **pure FE** — không có DB migration. Thay đổi thực tế (bao gồm cả update sau review):
1. **Schema**: `taskItemSchema` giữ `hours` optional. Tạo mới `taskItemFormSchema` với `hours` required (min 0.5). `dailyReportFormSchema` dùng `taskItemFormSchema`.
2. **Form**: `TaskRow` có hours input bắt buộc với `FormLabel` riêng. `hours_logged` ẩn input, hiển thị dạng read-only text.
3. **Service**: `TaskPayload` thêm `hours?: number`.
4. **Route**: `daily-report.tsx` mapping tasks thêm `hours` field.
5. **View**: Show per-task hours nếu `task.hours > 0` (backward compat).

### Schema — 2 Schemas Riêng Biệt

```typescript
// taskItemSchema — optional hours, dùng cho display/DB read path (backward compat)
export const taskItemSchema = z.object({
  description: z.string().min(1, 'Mô tả task không được để trống'),
  output_type: outputTypeSchema,
  output_link: z.union([z.literal(''), z.string().url('Link không hợp lệ')]).optional(),
  hours: z.number().min(0, 'Số giờ không được âm').max(24, 'Tối đa 24h').multipleOf(0.5, 'Bội số 0.5').optional(),
})
export type TaskItem = z.infer<typeof taskItemSchema>  // hours?: number

// taskItemFormSchema — required hours, dùng cho form submission mới
export const taskItemFormSchema = taskItemSchema.extend({
  hours: z
    .number({ invalid_type_error: 'Vui lòng nhập số giờ' })
    .min(0.5, 'Số giờ phải lớn hơn 0')
    .max(24, 'Tối đa 24h')
    .multipleOf(0.5, 'Bội số 0.5'),
})
export type TaskFormItem = z.infer<typeof taskItemFormSchema>  // hours: number

// dailyReportFormSchema dùng taskItemFormSchema
export const dailyReportFormSchema = z.object({
  tasks: z.array(taskItemFormSchema).min(1, 'Cần ít nhất 1 task'),
  hours_logged: z.number()...,
})
```

**Lý do tách 2 schemas:** `DailyReportView` và `ReportHistoryList` đọc data từ DB (old reports không có `hours`) → dùng `TaskItem` (optional). Form submit mới → dùng `TaskFormItem` (required). Tránh breaking change TypeScript.

### TaskRow Layout Mới

```tsx
// SAU (Story 4.5 — final):
<div className='flex gap-3 items-start'>
  {/* Hours — required, có FormLabel riêng */}
  <FormField name={`tasks.${index}.hours`}>
    <FormItem className='w-[80px] shrink-0'>
      <FormLabel>Số giờ <span className='text-destructive'>*</span></FormLabel>
      <FormControl>
        <Input type='number' min={0.5} max={24} step={0.5} placeholder='VD: 2'
          value={field.value ?? ''}
          onChange={(e) => { const val = parseFloat(e.target.value); field.onChange(isNaN(val) ? undefined : val) }}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  </FormField>

  {/* Output type + link — nhóm riêng, flex-1 */}
  <div className='flex-1 space-y-1.5'>
    <p className='text-sm font-medium leading-none'>
      {outputType === 'other' ? 'Output / Ghi chú' : 'Output link'}
      {' '}<span className='text-muted-foreground font-normal'>(optional)</span>
    </p>
    <div className='flex gap-2'>
      <FormItem className='w-[150px] shrink-0'> {/* Output type */} </FormItem>
      <FormItem className='flex-1'> {/* Output link */} </FormItem>
    </div>
  </div>
</div>
```

### Tổng Giờ — Read-only Display (không phải input)

```tsx
{/* Thay thế FormField hours_logged — giá trị vẫn được submit qua RHF form state */}
<div className='flex items-center justify-between rounded-lg border px-4 py-3'>
  <p className='text-sm font-medium'>Tổng giờ làm việc</p>
  {(hoursWatched ?? 0) > 0 ? (
    <p className='text-sm font-semibold'>{hoursWatched}h</p>
  ) : (
    <p className='text-sm text-muted-foreground'>—</p>
  )}
</div>
```

**Lưu ý:** `hours_logged` vẫn có trong `defaultValues: { hours_logged: 0 }` và được set bởi `useEffect`. RHF không cần rendered input để include field value khi submit.

### Auto-compute `hours_logged` — Pattern An Toàn

```typescript
useEffect(() => {
  const tasks = tasksWatched ?? []
  const allFilled = tasks.length > 0 && tasks.every(t => t.hours !== undefined && t.hours > 0)
  if (allFilled) {
    const sum = tasks.reduce((acc, t) => acc + (t.hours ?? 0), 0)
    form.setValue('hours_logged', sum, { shouldDirty: false, shouldValidate: false })
  }
  // Không allFilled → giữ nguyên hours_logged (không reset về 0)
}, [tasksWatched, form])
```

### Route `daily-report.tsx` — Mapping tasks thêm hours

```typescript
tasks: values.tasks.map((t) => ({
  description: t.description,
  output_type: t.output_type,
  ...(t.output_link ? { output_link: t.output_link } : {}),
  ...(t.hours !== undefined ? { hours: t.hours } : {}),  // ← thêm hours
})),
```

### DailyReportView — Backward Compat

`TaskData` (local type) dùng `hours?: number` — independent với `TaskItem`/`TaskFormItem` schema. Old reports từ DB không có `hours` → render bình thường, không crash.

### Regression Checklist — Files Không Được Thay Đổi

```
KHÔNG THAY ĐỔI:
  supabase/migrations/*                                     ← không có migration mới
  src/features/daily-report/components/ReportHistoryList.tsx
  src/features/daily-report/components/TeamReportList.tsx
  src/features/daily-report/components/ReportStatusBadge.tsx
  src/features/daily-report/hooks/use-all-reports.ts
```

### File Structure

```
KHÔNG CÓ FILE MỚI.

MODIFY:
  src/features/daily-report/schemas/daily-report.schema.ts    ← thêm taskItemFormSchema, cập nhật dailyReportFormSchema + hasDiscrepancy
  src/features/daily-report/services/daily-report.service.ts  ← TaskPayload thêm hours
  src/features/daily-report/components/DailyReportForm.tsx    ← TaskRow layout mới, hours bắt buộc, ẩn hours_logged input
  src/features/daily-report/components/DailyReportView.tsx    ← TaskData thêm hours?, hiện badge
  src/routes/_app/daily-report.tsx                            ← tasks mapping thêm hours
  src/features/daily-report/__tests__/daily-report.test.ts    ← thêm taskItemFormSchema test suite, cập nhật dailyReportFormSchema fixtures
```

### Thực Tế Khác Với Spec Gốc

| Spec gốc (story tạo ra) | Thực tế implement |
|---|---|
| `hours` optional, min 0 | `hours` bắt buộc trong form (min 0.5), optional trong `taskItemSchema` (backward compat) |
| `hours_logged` vẫn hiện dưới dạng input | `hours_logged` ẩn, hiện dạng read-only display text |
| Hours input không có label riêng | Có `FormLabel` "Số giờ *" riêng |
| Hours input đầu flex row chung với output | Tách thành 2 nhóm riêng trong 1 flex row ngang |
| `dailyReportFormSchema` dùng `taskItemSchema` | `dailyReportFormSchema` dùng `taskItemFormSchema` mới |

---

## Checklist Trước Khi Done

- [x] `npm run lint` — 0 errors
- [x] `npm run test` — 123/123 pass (bao gồm `taskItemFormSchema` required hours suite + cập nhật `dailyReportFormSchema` fixtures)
- [x] `npx supabase test db` — 56/56 pass, 0 regression
- [ ] Manual test — Submit new report:
  - [ ] Bỏ trống hours → validation error "Số giờ phải lớn hơn 0"
  - [ ] Điền hours cho TẤT CẢ tasks → tổng giờ display tự động cập nhật
  - [ ] `hours = 0.5` → valid; `hours = 0` → lỗi; `hours = -1` → lỗi
  - [ ] Submit → verify `hours_logged` trong DB = sum per-task hours
- [ ] Manual test — Read-only view:
  - [ ] Task có `hours > 0` → hiện badge `Xh`
  - [ ] Task `hours = 0` hoặc undefined → không hiện gì
- [ ] Manual test — Old report backward compat:
  - [ ] Mở report cũ (tasks không có `hours`) → không crash
  - [ ] `ReportHistoryList` collapsed row vẫn hiện `Xh` từ `hours_logged`
- [ ] Manual test — Discrepancy flag:
  - [ ] 1 task, `hours: 5`, no link → flag hiện
  - [ ] 1 task, no hours, `hours_logged = 5`, no link → flag hiện (fallback)

---

## Dev Agent Record

### Implementation Notes

**Approach:** Pure FE implementation — không có DB migration, `tasks` là jsonb column.

**Key decisions:**
1. **2-schema pattern**: `taskItemSchema` (optional hours) cho display/backward compat. `taskItemFormSchema` (required hours min 0.5) cho form. Tránh breaking change TypeScript với old data.
2. **`hasDiscrepancy`**: Vẫn nhận `TaskItem[]` (optional hours) — backward compat. Logic `allHasTaskHours` detect per-task path.
3. **DailyReportForm layout**: Hours tách thành nhóm riêng với `FormLabel` "Số giờ *". Output type + link nhóm riêng bên phải.
4. **`hours_logged` ẩn**: Giá trị set qua `useEffect` + `form.setValue`. RHF include trong submit payload mà không cần rendered input.
5. **Route mapping**: `daily-report.tsx` có explicit tasks mapping → cần thêm `hours` field explicitly.
6. **`parseFloat || undefined` → `isNaN` check**: Sửa từ `parseFloat(e.target.value) || undefined` thành `isNaN(val) ? undefined : val` để handle `0` đúng.

### Completion Notes

✅ Story 4.5 hoàn thành (bao gồm post-review updates):
- `taskItemSchema` — `hours?: number` (optional, backward compat)
- `taskItemFormSchema` mới — `hours: number` (required, min 0.5)
- `dailyReportFormSchema` dùng `taskItemFormSchema`
- `DailyReportForm` — hours input bắt buộc có label riêng, `hours_logged` ẩn + display text
- `DailyReportView` — badge `Xh` per-task (backward compat)
- `TaskPayload` + route mapping thêm `hours`
- `npm run lint` — 0 errors
- `npm run test` — 123/123 pass
- `npx supabase test db` — 56/56 pass

## File List

- `src/features/daily-report/schemas/daily-report.schema.ts` — Thêm `taskItemFormSchema` + `TaskFormItem`, cập nhật `dailyReportFormSchema` + `hasDiscrepancy`
- `src/features/daily-report/services/daily-report.service.ts` — `TaskPayload` thêm `hours?: number`
- `src/features/daily-report/components/DailyReportForm.tsx` — `TaskRow` layout mới (hours label riêng), `hours_logged` ẩn → display, `useEffect` auto-compute
- `src/features/daily-report/components/DailyReportView.tsx` — `TaskData` thêm `hours?`, hiện badge `Xh`
- `src/routes/_app/daily-report.tsx` — tasks mapping thêm `hours` field
- `src/features/daily-report/__tests__/daily-report.test.ts` — Thêm `taskItemFormSchema` test suite (8 tests), cập nhật `dailyReportFormSchema` fixtures, import `taskItemFormSchema`

## Change Log

- 2026-03-24: Story 4.5 created — Per-task Hours. Pure FE: thêm `hours?: number` per task (optional, backward compat), auto-compute `hours_logged` khi allFilled.
- 2026-03-24: Story 4.5 enhanced — Comprehensive dev context: exact TaskRow layout, schema changes, auto-compute pattern, backward compat, regression checks.
- 2026-03-25: Story 4.5 implemented — 6 tasks hoàn thành. `hours?: number` vào schema/service/form/view/route. 115 Vitest pass, 56 pgTAP pass, 0 lint errors.
- 2026-03-25: Post-review updates — (1) `hours` bắt buộc: tách `taskItemFormSchema` với min 0.5; (2) `hours_logged` ẩn input → display text; (3) Layout fix: hours có FormLabel riêng, tách khỏi nhóm output. 123/123 Vitest pass, 56/56 pgTAP pass.
