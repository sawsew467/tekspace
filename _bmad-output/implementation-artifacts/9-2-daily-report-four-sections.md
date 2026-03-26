# Story 9.2: Daily Report Form — 4 Sections

Status: done
Epic: 9 — Product Quality & Feature Completion
Story ID: 9.2
Story Key: 9-2-daily-report-four-sections
Created: 2026-03-26

---

## Story

Là một member,
tôi muốn submit daily report với 4 sections có cấu trúc phản ánh đúng cách team thực tế làm việc,
để report của tôi bao gồm đầy đủ: công việc đã hoàn thành, việc đang dở, kế hoạch ngày mai, và blockers.

---

## Acceptance Criteria

**Given** member mở Daily Report form
**When** form render
**Then** form hiển thị 4 sections rõ ràng:
- Section 1: Tasks Completed Today (required — min 1 task)
- Section 2: In Progress / Ongoing (optional — danh sách tasks)
- Section 3: Plan for Tomorrow (optional — textarea tự do)
- Section 4: Blockers / Issues (optional — textarea tự do)

**Given** member thêm task vào Section 1 (Tasks Completed Today)
**When** member điền task
**Then** mỗi task có: [Project tag — optional] + description + output_type + output_link + hours
**And** project_tag là free-text input, optional, hiển thị như badge prefix nhỏ gọn trước description
**And** hours vẫn required trong Section 1 (backward compat với Story 4.5)

**Given** member thêm item vào Section 2 (In Progress / Ongoing)
**When** member nhập
**Then** mỗi item có: description + project_tag (optional) + hours (bắt buộc)
**And** hours bắt buộc để đảm bảo `hours_logged` phản ánh đầy đủ năng suất ngày
**And** KHÔNG có output_type, output_link (task chưa xong)

**Given** member điền Section 3 (Plan for Tomorrow) và Section 4 (Blockers / Issues)
**When** member nhập
**Then** đây là `<Textarea>` tự do, optional, không validation bắt buộc

**Given** member không điền Section 2, 3, 4
**When** member submit (chỉ có Section 1)
**Then** report submit bình thường — backward compatible với form cũ

**Given** manager xem daily report của member (TeamReportList → DailyReportView)
**When** manager click mở report
**Then** hiển thị đầy đủ cả 4 sections
**And** Section 2 chỉ hiển thị khi có in_progress items (ẩn nếu rỗng)
**And** Section 3 + 4 chỉ hiển thị khi có content (ẩn nếu null/empty)

**Given** member xem lại report cũ (không có 4 sections)
**When** DailyReportView render report từ trước Story 9.2
**Then** chỉ thấy Section 1 tasks (backward compat) — không hiển thị sections rỗng

---

## Tasks / Subtasks

### Task 1: DB Migration

- [ ] Tạo file `supabase/migrations/20260326000001_9-2-daily-report-four-sections.sql`
  - [ ] Add column `plan_for_tomorrow TEXT` (nullable) vào `daily_reports`
  - [ ] Add column `blockers TEXT` (nullable) vào `daily_reports`
  - [ ] **KHÔNG** cần ALTER TABLE cho task fields — task data vẫn lưu trong JSONB `tasks` column (xem Dev Notes — Critical JSONB Architecture)
  - [ ] Apply: `npx supabase db push --local`
  - [ ] Run `npx supabase gen types typescript --local > src/lib/supabase-types.ts` để update types

### Task 2: Schema Updates

- [ ] Cập nhật `src/features/daily-report/schemas/daily-report.schema.ts`
  - [ ] Add `project_tag?: string` vào `taskItemSchema` (optional, backward compat)
  - [ ] Add `task_type?: z.enum(['completed', 'in_progress'])` vào `taskItemSchema` (optional)
  - [ ] `taskItemFormSchema`: giữ `hours` required, thêm `project_tag?: string`
  - [x] Tạo `inProgressTaskFormSchema`: `{ task_type: 'in_progress', description: required, project_tag?: string, hours: required (min 0.5) }` — KHÔNG có output_type, output_link
  - [ ] Cập nhật `dailyReportFormSchema`: thêm `in_progress_tasks: z.array(inProgressTaskFormSchema).optional().default([])`, `plan_for_tomorrow: z.string().optional()`, `blockers: z.string().optional()`
  - [ ] Export `InProgressTaskFormItem` type
  - [ ] Cập nhật `DailyReportFormValues` type (tự động từ z.infer)
  - [ ] Cập nhật `hasDiscrepancy()`: chỉ check `tasks` (completed) — exclude `in_progress_tasks`

### Task 3: Service Layer Updates

- [ ] Cập nhật `src/features/daily-report/services/daily-report.service.ts`
  - [ ] Thêm `task_type?: 'completed' | 'in_progress'` và `project_tag?: string` vào `TaskPayload` type
  - [ ] `submitReport`: thêm `planForTomorrow?: string` và `blockers?: string` vào payload type và insert object
  - [ ] `updateReport`: thêm `planForTomorrow?: string` và `blockers?: string` vào params và update object
  - [ ] `getAllReports` explicit select: thêm `plan_for_tomorrow, blockers` vào select string
  - [ ] `updateReport` explicit select: thêm `plan_for_tomorrow, blockers`
  - [ ] `getTeamReportsForDate` explicit select: thêm `plan_for_tomorrow, blockers, updated_at`
  - [ ] Cập nhật `TeamReportRow` type: thêm `plan_for_tomorrow: string | null`, `blockers: string | null`

### Task 4: DailyReportForm Component

- [ ] Cập nhật `src/features/daily-report/components/DailyReportForm.tsx`
  - [ ] Thêm `project_tag` field vào `TaskRow` (input text, optional, hiển thị trước description)
  - [x] Tạo sub-component `InProgressTaskRow`: project_tag + description + hours (required) + delete button
  - [x] Thêm `useFieldArray` thứ 2 cho `in_progress_tasks` — tên field: `in_progress_tasks`
  - [x] Chia form thành 4 sections có heading rõ ràng với `Separator` giữa các sections
  - [x] Section 3 + 4: `<Textarea>` với `placeholder` gợi ý
  - [x] Cập nhật `defaultValues`: thêm `in_progress_tasks: [], plan_for_tomorrow: '', blockers: ''`
  - [x] Auto-compute `hours_logged` = sum(Section 1 hours) + sum(Section 2 hours) — trigger khi TẤT CẢ tasks cả 2 section đều đã nhập
  - [x] `hasDiscrepancy` vẫn nhận `tasksWatched` của Section 1, không đổi call signature
  - [x] `append` buttons cho mỗi section riêng biệt

### Task 5: DailyReportView Component

- [ ] Cập nhật `src/features/daily-report/components/DailyReportView.tsx`
  - [ ] Thêm `TaskData` fields: `task_type?: string`, `project_tag?: string`
  - [ ] Hiển thị `project_tag` như badge nhỏ trước description trong task cards (nếu có)
  - [ ] Section 1 (Tasks Completed): hiện task với `task_type === 'completed'` hoặc `task_type === undefined` (backward compat)
  - [ ] Section 2 (In Progress): hiện tasks với `task_type === 'in_progress'` — ẩn section nếu không có task nào
  - [ ] Section 3: hiển thị `report.plan_for_tomorrow` nếu non-empty (ẩn nếu null/empty)
  - [ ] Section 4: hiển thị `report.blockers` nếu non-empty (ẩn nếu null/empty)
  - [ ] Dùng `<Separator>` và heading giống DailyReportForm để UX đồng nhất

---

## Dev Notes

### ✅ Kiến Trúc Thực Tế: Relational `report_tasks` Table

Dev đã upgrade kiến trúc từ JSONB → relational table trong quá trình implement. **Đã được review và chấp thuận.**

**Migration thực tế** (`supabase/migrations/20260326000003_daily_report_four_sections.sql`):
```sql
-- 1. Thêm 2 columns mới vào daily_reports:
ALTER TABLE public.daily_reports
  ADD COLUMN plan_for_tomorrow text,
  ADD COLUMN blockers          text;

-- 2. Tạo bảng report_tasks (relational thay thế JSONB tasks):
CREATE TABLE public.report_tasks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  report_id   uuid NOT NULL REFERENCES public.daily_reports(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.users(id),  -- denormalized cho RLS
  task_type   text NOT NULL DEFAULT 'completed' CHECK (task_type IN ('completed', 'in_progress')),
  project_tag text,
  description text NOT NULL CHECK (description <> ''),
  sort_order  integer NOT NULL DEFAULT 0,
  output_type text CHECK (output_type IS NULL OR output_type IN ('pr', 'figma', 'document', 'other')),
  output_link text,
  hours       numeric(4,1) CHECK (hours IS NULL OR (hours >= 0 AND hours <= 24)),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 3. Migrate dữ liệu từ JSONB daily_reports.tasks → report_tasks rows
-- (safe cast cho hours, giữ NULL nếu output_type không hợp lệ)

-- 4. DROP COLUMN tasks khỏi daily_reports

-- 5. RLS: SELECT + INSERT + DELETE + explicit DENY UPDATE policy
```

**RLS notes:**
- `daily_reports` policies không cần thay đổi — cover columns mới tự động
- `report_tasks` có 4 policies: SELECT (member + manager), INSERT (owner only), DELETE (owner only), UPDATE DENY (explicit false)

---

### report_tasks Row — Cấu Trúc Thực Tế

```typescript
// Completed task (Section 1):
{
  task_type: 'completed',    // NOT NULL DEFAULT 'completed'
  project_tag: 'TekSpace',  // nullable — optional badge
  description: 'Fix login bug',
  output_type: 'pr',
  output_link: 'https://github.com/...',
  hours: 2,                  // required trong form (min 0.5)
  sort_order: 0,
}

// In-progress task (Section 2):
{
  task_type: 'in_progress',
  project_tag: 'Backend',   // nullable — optional
  description: 'Đang viết API cho notifications',
  hours: 1.5,               // required trong form (min 0.5) để tính hours_logged
  // output_type, output_link: NULL (task chưa xong)
  sort_order: 0,
}
```

**Rule filter trong DailyReportView:**
```typescript
const completedTasks  = report_tasks.filter(t => t.task_type !== 'in_progress')  // backward compat
const inProgressTasks = report_tasks.filter(t => t.task_type === 'in_progress')
```

---

### Form Data Flow — Merge khi Submit

Form dùng 2 `useFieldArray` riêng nhưng merge khi gọi service:

```typescript
const completedTasks: TaskPayload[] = values.tasks.map(t => ({
  task_type: 'completed' as const,
  project_tag: t.project_tag || undefined,
  description: t.description,
  output_type: t.output_type,
  output_link: t.output_link || undefined,
  hours: t.hours,
}))
const inProgressTasks: TaskPayload[] = (values.in_progress_tasks ?? []).map(t => ({
  task_type: 'in_progress' as const,
  project_tag: t.project_tag || undefined,
  description: t.description,
  hours: t.hours,  // ← required, luôn có
}))

submitReport({
  tasks: [...completedTasks, ...inProgressTasks],  // merge vào 1 array
  hoursLogged: values.hours_logged,
  planForTomorrow: values.plan_for_tomorrow || undefined,
  blockers: values.blockers || undefined,
})
```

---

### Schema Design — Zod Thực Tế

```typescript
// taskItemSchema — base, dùng cho DB read path:
export const taskItemSchema = z.object({
  task_type: z.enum(['completed', 'in_progress']).default('completed'),  // default cho backward compat
  project_tag: z.string().optional(),
  description: z.string().min(1),
  output_type: outputTypeSchema,
  output_link: z.union([z.literal(''), z.string().url()]).optional(),
  hours: z.number().min(0).max(24).multipleOf(0.5).optional(),
})

// taskItemFormSchema — Section 1, hours required:
export const taskItemFormSchema = taskItemSchema.extend({
  hours: z.number().min(0.5).max(24).multipleOf(0.5),
})

// inProgressTaskFormSchema — Section 2, hours required, không có output:
export const inProgressTaskFormSchema = z.object({
  task_type: z.literal('in_progress').default('in_progress'),
  project_tag: z.string().optional(),
  description: z.string().min(1),
  hours: z.number().min(0.5).max(24).multipleOf(0.5),  // ← required để tính hours_logged
})

// dailyReportFormSchema:
export const dailyReportFormSchema = z.object({
  tasks: z.array(taskItemFormSchema).min(1),          // Section 1 — min 1
  in_progress_tasks: z.array(inProgressTaskFormSchema).optional().default([]),  // Section 2
  plan_for_tomorrow: z.string().optional(),            // Section 3
  blockers: z.string().optional(),                     // Section 4
  hours_logged: z.number().min(0).multipleOf(0.5),
})
```

---

### Auto-Compute Hours — Cả Hai Sections

`hours_logged` = sum(Section 1 hours) + sum(Section 2 hours).
Auto-compute trigger khi **tất cả** tasks ở cả 2 section đã nhập đủ giờ:

```typescript
const tasksWatched      = useWatch({ control, name: 'tasks' })
const inProgressWatched = useWatch({ control, name: 'in_progress_tasks' })

useEffect(() => {
  const completed   = tasksWatched ?? []
  const inProgress  = inProgressWatched ?? []
  const allFilled   = completed.length > 0
    && completed.every(t => t.hours > 0)
    && inProgress.every(t => t.hours > 0)  // empty array = trivially true
  if (allFilled) {
    const sum = completed.reduce((a, t) => a + t.hours, 0)
              + inProgress.reduce((a, t) => a + t.hours, 0)
    form.setValue('hours_logged', sum)
  }
}, [tasksWatched, inProgressWatched, form])
```

`hasDiscrepancy()` vẫn chỉ nhận `tasksWatched` (Section 1) — không đổi.

---

### Migration File — Chính Xác

**File:** `supabase/migrations/20260326000003_daily_report_four_sections.sql`

Xem file migration trực tiếp cho full SQL. Tóm tắt:
- ADD COLUMN `plan_for_tomorrow`, `blockers` vào `daily_reports`
- CREATE TABLE `report_tasks` với đầy đủ constraints + indexes
- INSERT migrate data từ JSONB (safe cast cho hours, NULL thay vì 'other' cho invalid output_type)
- DROP COLUMN `tasks` khỏi `daily_reports`
- 4 RLS policies: SELECT, INSERT, DELETE, UPDATE DENY

---

### updateReport — Safe Replace Pattern

Flow thực tế tránh window zero tasks:
1. UPDATE `daily_reports`
2. Fetch old task IDs (`SELECT id FROM report_tasks WHERE report_id = ?`)
3. INSERT new tasks
4. DELETE old tasks **bằng ID cụ thể** (không dùng `eq('report_id')` để tránh xóa new tasks)

`submitReport`: nếu task INSERT fail → compensating DELETE orphaned `daily_reports` row.

### Service — Cập Nhật Cụ Thể

**`TaskPayload` type (thêm 2 fields):**
```typescript
export type TaskPayload = {
  task_type?: 'completed' | 'in_progress'  // ← MỚI (optional, backward compat)
  project_tag?: string                      // ← MỚI (optional)
  description: string
  output_type?: string   // only for completed tasks
  output_link?: string
  hours?: number
}
```

**`submitReport` payload thêm:**
```typescript
submitReport: async (payload: {
  tenantId: string
  userId: string
  reportDate: string
  tasks: TaskPayload[]
  hoursLogged: number
  planForTomorrow?: string    // ← MỚI
  blockers?: string           // ← MỚI
}): Promise<DailyReport>
```

Insert object:
```typescript
.insert({
  tenant_id: payload.tenantId,
  user_id: payload.userId,
  report_date: payload.reportDate,
  tasks: payload.tasks,
  hours_logged: payload.hoursLogged,
  plan_for_tomorrow: payload.planForTomorrow ?? null,  // ← MỚI
  blockers: payload.blockers ?? null,                  // ← MỚI
})
```

**`updateReport` thêm params tương tự.**

**`getAllReports` select string** — thêm `plan_for_tomorrow, blockers`:
```typescript
.select('id, tenant_id, user_id, report_date, tasks, hours_logged, is_late, submitted_at, updated_at, created_at, plan_for_tomorrow, blockers')
```

**`getTeamReportsForDate` select** — thêm `plan_for_tomorrow, blockers, updated_at`:
```typescript
.select('id, tenant_id, user_id, report_date, tasks, hours_logged, is_late, submitted_at, updated_at, created_at, plan_for_tomorrow, blockers, users(id, full_name, avatar_url)')
```

**`TeamReportRow` type** — thêm:
```typescript
updated_at: string | null     // missing từ trước
plan_for_tomorrow: string | null  // ← MỚI
blockers: string | null           // ← MỚI
```

---

### Edit Mode (Story 4.6) — Backward Compat

`DailyReportForm` nhận `defaultValues?: DailyReportFormValues` khi edit.

Khi load report cũ (không có `in_progress_tasks` trong JSONB), cần split tasks thành đúng array:

**Trong `daily-report.tsx` (Page) — logic convert report → defaultValues:**
```typescript
// Hiện tại (Story 4.6):
const defaultValues: DailyReportFormValues = {
  tasks: report.tasks as TaskFormItem[],
  hours_logged: report.hours_logged,
}

// Sau Story 9.2:
const allTasks = Array.isArray(report.tasks) ? report.tasks as TaskItem[] : []
const completedTasks = allTasks.filter(t => t.task_type !== 'in_progress')
const inProgressItems = allTasks.filter(t => t.task_type === 'in_progress')

const defaultValues: DailyReportFormValues = {
  tasks: completedTasks as TaskFormItem[],
  in_progress_tasks: inProgressItems as InProgressTaskFormItem[],
  plan_for_tomorrow: report.plan_for_tomorrow ?? '',
  blockers: report.blockers ?? '',
  hours_logged: report.hours_logged,
}
```

---

### DailyReportView — Layout 4 Sections

```typescript
// DailyReportView.tsx — mở rộng TaskData type:
type TaskData = {
  task_type?: string      // ← MỚI: 'completed' | 'in_progress' | undefined
  project_tag?: string    // ← MỚI: optional badge
  description: string
  output_type: string
  output_link?: string
  hours?: number
}

// Render logic — KHÔNG đổi TaskData type khi render, chỉ filter:
const completedTasks = tasks.filter(t => t.task_type !== 'in_progress')  // backward compat
const inProgressTasks = tasks.filter(t => t.task_type === 'in_progress')
```

**Project tag display trong task card:**
```tsx
{task.project_tag && (
  <Badge variant='outline' className='text-xs font-mono shrink-0'>
    {task.project_tag}
  </Badge>
)}
<p className='text-sm font-medium leading-snug'>{task.description}</p>
```

---

### DailyReportForm — UI Layout

```tsx
{/* Section 1: Tasks Completed Today */}
<div className='space-y-4'>
  <h3 className='text-sm font-semibold'>✅ Tasks Completed Today</h3>
  {/* existing TaskRow — thêm project_tag field */}
  ...
  <Button onClick={() => append(...)}>+ Thêm task</Button>
</div>

<Separator />

{/* Section 2: In Progress / Ongoing */}
<div className='space-y-4'>
  <h3 className='text-sm font-semibold'>🔄 In Progress / Ongoing</h3>
  {/* InProgressTaskRow — chỉ project_tag + description */}
  ...
  <Button onClick={() => appendInProgress(...)}>+ Thêm</Button>
</div>

<Separator />

{/* Tổng giờ — từ Section 1 */}
<div className='...'>Tổng giờ làm: {hoursWatched}h</div>

{/* Section 3: Plan for Tomorrow */}
<FormField name='plan_for_tomorrow' render={...}>
  <FormLabel>📋 Plan for Tomorrow</FormLabel>
  <Textarea placeholder='Kế hoạch ngày mai...' rows={3} />
</FormField>

{/* Section 4: Blockers */}
<FormField name='blockers' render={...}>
  <FormLabel>🚧 Blockers / Issues</FormLabel>
  <Textarea placeholder='Có blockers hay issues nào không?' rows={3} />
</FormField>
```

---

### Project Tag Field trong TaskRow

Thêm field `project_tag` TRƯỚC description — optional, text input nhỏ:

```tsx
{/* Project tag (optional) — thêm trên cùng trong TaskRow */}
<FormField
  control={control}
  name={`tasks.${index}.project_tag`}
  render={({ field }) => (
    <FormItem>
      <FormLabel className='text-xs text-muted-foreground'>Project Tag (optional)</FormLabel>
      <FormControl>
        <Input
          {...field}
          placeholder='VD: TekSpace, Backend, Mobile...'
          className='h-8 text-sm'  // compact
        />
      </FormControl>
    </FormItem>
  )}
/>
```

---

### useSubmitReport / useUpdateReport — Hook Layer

Các hooks hiện tại chỉ pass-through params từ page xuống service. Sau khi service update, hooks cũng cần cập nhật để pass `planForTomorrow` và `blockers`:

- `use-submit-report.ts`: thêm `planForTomorrow?: string`, `blockers?: string` vào `MutationParams` type
- `use-update-report.ts`: thêm `planForTomorrow?: string`, `blockers?: string` vào params

Nếu hooks hiện tại dùng destructuring rõ ràng, thêm vào. Nếu spread `...rest`, cần check.

---

### Thứ Tự Implementation

1. **Migration** → apply → gen types
2. **Schema** (daily-report.schema.ts) — nền tảng cho tất cả
3. **Service** (daily-report.service.ts) — TaskPayload + new methods
4. **Hooks** (use-submit-report.ts, use-update-report.ts) — nếu cần
5. **DailyReportView** (display component — đơn giản hơn)
6. **DailyReportForm** (form component — phức tạp nhất)
7. **daily-report.tsx** (page) — wire up edit mode defaultValues split

---

### Files KHÔNG cần thay đổi

- `src/routes/_app/daily-report.tsx` — **có thể** cần update defaultValues split logic cho edit mode (Story 4.6)
- `src/features/daily-report/components/ReportHistoryList.tsx` — không đổi (embed DailyReportView)
- `src/features/daily-report/components/TeamReportList.tsx` — không đổi (embed DailyReportView)
- `src/features/daily-report/components/ReportStatusBadge.tsx` — không đổi
- `src/features/daily-report/hooks/use-team-reports.ts` — không đổi (query key không đổi)
- `src/features/daily-report/hooks/use-today-report.ts` — không đổi
- `src/features/daily-report/hooks/use-report-dates.ts` — không đổi (lightweight query)
- DB triggers: `compute_daily_report_is_late`, `daily_reports_set_updated_at` — không đổi

---

### Supabase Types Sau Migration

Sau `npx supabase db push --local && npx supabase gen types typescript --local > src/lib/supabase-types.ts`:

`Tables<'daily_reports'>` sẽ có thêm:
```typescript
plan_for_tomorrow: string | null
blockers: string | null
```

`DailyReport` type (alias từ `Tables<'daily_reports'>`) tự động có các fields này — không cần update thủ công.

---

### hasDiscrepancy — Không Cần Thay Đổi Call Signature

Function `hasDiscrepancy(hoursLogged, tasks)` nhận mảng `tasks` của Section 1 (completed). Trong form:
```typescript
// Chỉ pass tasks (Section 1), không pass in_progress_tasks
const showFlag = hasDiscrepancy(hoursWatched ?? 0, tasksWatched ?? [])
```
Logic nội tại của function không thay đổi — nó đã đúng khi chỉ nhận completed tasks.

---

### RLS — Không Cần Thay Đổi

Policies hiện tại cover cả columns mới tự động vì:
- `daily_reports_select_policy`: dùng `USING (tenant_id = current_tenant_id() AND ...)` — không filter theo column name
- `daily_reports_insert_policy` / `daily_reports_update_policy`: tương tự
- Không cần `SECURITY DEFINER` mới vì không tạo function mới query bảng có RLS

---

### Test Bắt Buộc Trước Khi Done

```bash
npx supabase test db  # tất cả phải PASS
```

**Manual test checklist:**
```
1. Submit report chỉ có Section 1 (backward compat):
   → Form submit → report lưu → view hiện Section 1 tasks ✓
   → Section 2, 3, 4 không hiển thị (không có data) ✓

2. Submit report đầy đủ 4 sections:
   → Section 1: 2 completed tasks + project tags ✓
   → Section 2: 1 in-progress item ✓
   → Section 3: "Sẽ làm X ngày mai" ✓
   → Section 4: "Blocked bởi API chưa xong" ✓
   → DailyReportView hiển thị đủ 4 sections ✓

3. Manager view (TeamReportList → DailyReportView):
   → Thấy 4 sections của member's report ✓
   → Old reports (không có in_progress/plan/blockers) vẫn hiển thị đúng ✓

4. Edit mode (Story 4.6 backward compat):
   → Open report có 4 sections → form pre-fill đúng vào đúng sections ✓
   → Old report (chỉ có completed tasks) → in_progress empty, plan/blockers empty ✓
   → Edit → submit → view cập nhật ✓

5. Project tag display:
   → Badge hiển thị trước description ✓
   → Task không có project_tag → không hiển thị badge (không crash) ✓
```

---

## Project Structure Notes

**Files đã tạo mới:**
- `supabase/migrations/20260326000003_daily_report_four_sections.sql`

**Files đã chỉnh sửa:**
- `src/features/daily-report/schemas/daily-report.schema.ts`
- `src/features/daily-report/services/daily-report.service.ts`
- `src/features/daily-report/hooks/use-submit-report.ts`
- `src/features/daily-report/hooks/use-update-report.ts`
- `src/features/daily-report/components/DailyReportForm.tsx`
- `src/features/daily-report/components/DailyReportView.tsx`
- `src/routes/_app/daily-report.tsx`
- `src/lib/supabase-types.ts` (auto-generated sau `npx supabase gen types`)

---

## References

- Sprint Change Proposal: `_bmad-output/implementation-artifacts/sprint-change-proposal-2026-03-26.md` — Story 9-2 requirements
- Epics: `_bmad-output/planning-artifacts/epics.md` — Epic 9, Story 9.2 acceptance criteria
- Story 4.5 (`4-5-per-task-hours.md`) — pattern: JSONB field thêm không cần migration
- Story 4.6 (`4-6-edit-report-window.md`) — edit mode logic (defaultValues, canEdit, isEditing state)
- Migration: `supabase/migrations/20260323000007_create_daily_reports.sql` — schema gốc
- `src/features/daily-report/schemas/daily-report.schema.ts` — schemas cần update
- `src/features/daily-report/services/daily-report.service.ts` — service cần update
- `src/features/daily-report/components/DailyReportForm.tsx` — form cần update
- `src/features/daily-report/components/DailyReportView.tsx` — view cần update
- Architecture: `_bmad-output/planning-artifacts/architecture.md` — coding conventions

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5

### Completion Notes List

- Kiến trúc upgrade từ JSONB → relational `report_tasks` table (code review decision)
- `hours` bắt buộc cho cả Section 1 và Section 2 để tính đủ `hours_logged`
- `hours_logged` auto-compute từ sum cả 2 sections
- `updateReport`: safe replace pattern — fetch old IDs → INSERT new → DELETE old by ID
- `submitReport`: compensating DELETE nếu task INSERT fail
- Code review fixes: safe hours cast, NULL output_type, explicit UPDATE DENY policy, sortTasks null-guard

### File List

- `supabase/migrations/20260326000003_daily_report_four_sections.sql` (created)
- `src/features/daily-report/schemas/daily-report.schema.ts` (modified)
- `src/features/daily-report/services/daily-report.service.ts` (modified)
- `src/features/daily-report/hooks/use-submit-report.ts` (modified)
- `src/features/daily-report/hooks/use-update-report.ts` (modified)
- `src/features/daily-report/components/DailyReportForm.tsx` (modified)
- `src/features/daily-report/components/DailyReportView.tsx` (modified)
- `src/routes/_app/daily-report.tsx` (modified)
- `src/lib/supabase-types.ts` (auto-generated)