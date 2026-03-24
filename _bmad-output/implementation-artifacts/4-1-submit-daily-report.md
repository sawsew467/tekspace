# Story 4.1: Submit Daily Report

**Status:** review
**Epic:** 4 — Daily Report
**Story ID:** 4.1
**Story Key:** 4-1-submit-daily-report
**Created:** 2026-03-24

---

## Story

As a member,
I want to submit a structured daily report with my completed tasks, hours worked, and work output links,
So that my manager can see what I accomplished without needing to ask.

---

## Acceptance Criteria

1. **Form nhiều tasks** — Khi member mở `/daily-report`, form cho phép thêm nhiều tasks. Mỗi task có: `description` (bắt buộc), `output_type` (enum: pr/figma/document/other, bắt buộc), `output_link` (optional). Placeholder của `output_link` field thay đổi theo `output_type` đã chọn.

2. **Hours logged** — Form có field `hours_logged` (số thực, 0–24, bước 0.5). Validation: required, min 0, max 24.

3. **Submit thành công** — Khi submit: report được INSERT vào `daily_reports` với `tenant_id = current_tenant_id()`, `user_id = auth.uid()`, `report_date = today (user timezone)`, `tasks (jsonb array)`, `hours_logged`, `submitted_at = now()`. Trigger DB tự set `is_late`.

4. **Append-only** — Sau khi submit, report KHÔNG thể edit. Page chuyển sang chế độ read-only view hiển thị report đã nộp. Nếu member quay lại `/daily-report` cùng ngày → hiển thị read-only view ngay (không hiện form).

5. **Late badge** — Nếu `is_late = true` trong report đã nộp → hiển thị badge "Nộp muộn" trên read-only view. Không block member khỏi submit khi đang muộn.

6. **One report per day** — DB constraint `UNIQUE (tenant_id, user_id, report_date)` đảm bảo 1 report/ngày. FE kiểm tra trước: nếu đã có report hôm nay → hiển thị read-only ngay, không render form.

---

## Tasks / Subtasks

### Schema

- [x] Task 1: Tạo `src/features/daily-report/schemas/daily-report.schema.ts`
  - [x] `outputTypeSchema`: z.enum(['pr', 'figma', 'document', 'other'])
  - [x] `taskItemSchema`: z.object({ description: z.string().min(1), output_type: outputTypeSchema, output_link: z.string().url().optional().or(z.literal('')) })
  - [x] `dailyReportFormSchema`: z.object({ tasks: z.array(taskItemSchema).min(1, 'Cần ít nhất 1 task'), hours_logged: z.number().min(0).max(24) })
  - [x] Export types: `DailyReportFormValues`, `TaskItem`, `OutputType`
  - [x] Export `OUTPUT_TYPE_LABELS` và `OUTPUT_TYPE_PLACEHOLDERS` maps cho UI

### Service

- [x] Task 2: Tạo `src/features/daily-report/services/daily-report.service.ts`
  - [x] `DailyReportService.getTodayReport(tenantId, userId, reportDate)` — query `daily_reports` WHERE tenant_id + user_id + report_date, dùng `.maybeSingle()`, return `DailyReport | null`
  - [x] `DailyReportService.submitReport(payload)` — INSERT vào `daily_reports`, nhận `{ tenantId, userId, reportDate, tasks, hoursLogged }`. `is_late` do trigger tự set — KHÔNG truyền từ client
  - [x] Import `supabase` từ `@/lib/supabase-browser` — KHÔNG createClient lại
  - [x] Throw on error pattern (không return error object)
  - [x] Dùng `getSession()` (không `getUser()`)

### Hooks

- [x] Task 3: Tạo `src/features/daily-report/hooks/use-today-report.ts`
  - [x] `useTodayReport(tenantId, userId, reportDate)` — useQuery
  - [x] `queryKey: [QUERY_KEYS.dailyReports, tenantId, { userId, date: reportDate }]`
  - [x] `staleTime: 0` — report của ngày hôm nay có thể vừa submit xong
  - [x] `enabled: !!tenantId && !!userId && !!reportDate`

- [x] Task 4: Tạo `src/features/daily-report/hooks/use-submit-report.ts`
  - [x] `useSubmitReport()` — useMutation
  - [x] `onSuccess`: invalidate `[QUERY_KEYS.dailyReports]`, toast.success('Đã nộp daily report')
  - [x] `onError`: toast.error('Không thể nộp report: ' + error.message)

### Components

- [x] Task 5: Tạo `src/features/daily-report/components/DailyReportForm.tsx`
  - [x] React Hook Form + Zod resolver (`dailyReportFormSchema`)
  - [x] `useFieldArray` cho `tasks` field
  - [x] Default value: 1 task trống, hours_logged = 0
  - [x] "Thêm task" button để append task mới
  - [x] Mỗi task row: description input, output_type Select (shadcn), output_link input với placeholder động
  - [x] Nút xóa task (chỉ hiện khi có ≥ 2 tasks)
  - [x] `fieldset disabled={isPending}` khi đang submit
  - [x] Submit button với Loader2 spinner khi isPending

- [x] Task 6: Tạo `src/features/daily-report/components/DailyReportView.tsx`
  - [x] Hiển thị read-only report đã nộp
  - [x] Late badge: nếu `is_late === true` → Badge variant="destructive" text "Nộp muộn"
  - [x] Hiển thị submitted_at (convert UTC → user timezone bằng `date-fns-tz`)
  - [x] List tasks: description, output_type label, output_link (clickable `<a>` nếu có)
  - [x] Hiển thị hours_logged

### Route

- [x] Task 7: Tạo `src/routes/_app/daily-report.tsx`
  - [x] `createFileRoute('/_app/daily-report')` với `head: () => ({ meta: [{ title: 'Daily Report — TekSpace' }] })`
  - [x] Load user profile (timezone), activeTenantId từ stores
  - [x] Tính `reportDate = format(toZonedTime(new Date(), userTimezone), 'yyyy-MM-dd')`
  - [x] Gọi `useTodayReport()` → nếu data tồn tại → `<DailyReportView report={data} timezone={userTimezone} />`
  - [x] Nếu isLoading → Skeleton
  - [x] Nếu chưa có report → `<DailyReportForm onSubmit={handleSubmit} isPending={...} />`

---

## Dev Notes

### DB Schema — daily_reports ĐÃ TỒN TẠI

```sql
CREATE TABLE public.daily_reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.users(id),
  report_date  date NOT NULL,
  tasks        jsonb NOT NULL DEFAULT '[]'::jsonb
                    CONSTRAINT daily_reports_tasks_is_array CHECK (jsonb_typeof(tasks) = 'array'),
  hours_logged numeric(4,1) NOT NULL DEFAULT 0
                    CONSTRAINT daily_reports_hours_valid CHECK (hours_logged >= 0 AND hours_logged <= 24),
  is_late      boolean NOT NULL DEFAULT false,   -- ← SET BỞI TRIGGER, không truyền từ client
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id, report_date)       -- 1 report/ngày/member
);
```

**QUAN TRỌNG — tasks JSON schema (phải đúng format khi INSERT):**
```typescript
// tasks field trong DB là jsonb array với shape:
type TaskItem = {
  description: string        // required
  output_type: 'pr' | 'figma' | 'document' | 'other'  // required
  output_link?: string       // optional, có thể undefined/null/''
}
```

**KHÔNG có UPDATE policy** — append-only by design. Không implement edit functionality.

### RLS đã có — Không viết thêm migration

```sql
-- SELECT: member xem report của mình; manager xem tất cả trong tenant
"(tenant_id = current_tenant_id()) AND ((user_id = auth.uid()) OR is_tenant_manager())"

-- INSERT: member chỉ insert report của chính mình trong tenant
WITH CHECK: "(tenant_id = current_tenant_id()) AND (user_id = auth.uid())"
```

### `is_late` — Trigger tự tính, KHÔNG truyền từ client

Trigger `compute_daily_report_is_late` chạy BEFORE INSERT, tự so sánh `submitted_at` với `deadline = (report_date + 1 ngày) tại tenant.daily_report_deadline_hour` trong `tenants.timezone` (default 03:00 sáng, Asia/Ho_Chi_Minh).

**FE chỉ cần:** INSERT với `tenant_id, user_id, report_date, tasks, hours_logged`. Sau INSERT → đọc lại row để biết `is_late`.

### report_date — Tính từ User Timezone

```typescript
import { toZonedTime, format } from 'date-fns-tz'

// Lấy ngày hôm nay theo timezone của user (không phải UTC)
const reportDate = format(toZonedTime(new Date(), userProfile.timezone), 'yyyy-MM-dd')
// VD: UTC 21:00 ngày 23/03 = Asia/Ho_Chi_Minh 04:00 ngày 24/03 → reportDate = '2026-03-24'
```

**Fallback timezone:** Nếu user chưa set timezone → dùng `tenants.timezone`.

### Service Implementation — Đầy Đủ

```typescript
import { supabase } from '@/lib/supabase-browser'
import type { Tables, TablesInsert } from '@/lib/supabase-types'

export type DailyReport = Tables<'daily_reports'>

export const DailyReportService = {
  getTodayReport: async (
    tenantId: string,
    userId: string,
    reportDate: string  // 'yyyy-MM-dd'
  ): Promise<DailyReport | null> => {
    const { data, error } = await supabase
      .from('daily_reports')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .eq('report_date', reportDate)
      .maybeSingle()  // null nếu chưa submit hôm nay
    if (error) throw error
    return data
  },

  submitReport: async (payload: {
    tenantId: string
    userId: string
    reportDate: string
    tasks: Array<{ description: string; output_type: string; output_link?: string }>
    hoursLogged: number
  }): Promise<DailyReport> => {
    const { data, error } = await supabase
      .from('daily_reports')
      .insert({
        tenant_id: payload.tenantId,
        user_id: payload.userId,
        report_date: payload.reportDate,
        tasks: payload.tasks,           // jsonb
        hours_logged: payload.hoursLogged,
        // ← KHÔNG set is_late (trigger tự tính)
        // ← KHÔNG set submitted_at (DEFAULT now())
        // ← KHÔNG set created_at (DEFAULT now())
      })
      .select('*')
      .single()
    if (error) throw error
    return data
  },
}
```

### Output Type Labels & Placeholders

```typescript
// Đặt trong daily-report.schema.ts (hoặc separate constants file)
export const OUTPUT_TYPE_LABELS: Record<OutputType, string> = {
  pr: 'PR (GitHub/GitLab)',
  figma: 'Figma',
  document: 'Document',
  other: 'Other',
}

export const OUTPUT_TYPE_PLACEHOLDERS: Record<OutputType, string> = {
  pr: 'https://github.com/org/repo/pull/123',
  figma: 'https://figma.com/file/...',
  document: 'https://docs.google.com/... hoặc Notion link',
  other: 'Mô tả output (optional)',
}
```

### useFieldArray Pattern — DailyReportForm

```typescript
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

const form = useForm<DailyReportFormValues>({
  resolver: zodResolver(dailyReportFormSchema),
  defaultValues: {
    tasks: [{ description: '', output_type: 'other', output_link: '' }],
    hours_logged: 0,
  },
})

const { fields, append, remove } = useFieldArray({
  control: form.control,
  name: 'tasks',
})

// Append task mới
append({ description: '', output_type: 'other', output_link: '' })

// Remove task (chỉ khi fields.length > 1)
remove(index)
```

### Form Submit Handler — Route

```typescript
const submitReport = useSubmitReport()

const handleSubmit = (values: DailyReportFormValues) => {
  submitReport.mutate({
    tenantId: activeTenantId!,
    userId: user!.id,
    reportDate,
    tasks: values.tasks.map(t => ({
      description: t.description,
      output_type: t.output_type,
      ...(t.output_link ? { output_link: t.output_link } : {}),  // omit empty string
    })),
    hoursLogged: values.hours_logged,
  })
}
```

### Output Link Validation — Edge Case

`output_link` là optional. Nếu user nhập rỗng `''` → không lưu (omit từ payload). Validation Zod:
```typescript
output_link: z.string().url('Link không hợp lệ').optional().or(z.literal(''))
// → '' pass validation, URL string pass, non-URL non-empty string fail
```

Khi render read-only view: chỉ render link `<a href>` khi `output_link` là non-empty string.

### File Structure — Tất Cả Là File Mới

```
TẠO MỚI (feature chưa có gì):
  src/features/daily-report/schemas/daily-report.schema.ts
  src/features/daily-report/services/daily-report.service.ts
  src/features/daily-report/hooks/use-today-report.ts
  src/features/daily-report/hooks/use-submit-report.ts
  src/features/daily-report/components/DailyReportForm.tsx
  src/features/daily-report/components/DailyReportView.tsx
  src/routes/_app/daily-report.tsx

KHÔNG tạo migration — daily_reports table + RLS đã có từ migration 000007 + rls_policies.

KHÔNG thay đổi:
  src/lib/query-keys.ts     (QUERY_KEYS.dailyReports đã có = 'daily-reports')
  src/lib/routes.ts         (ROUTES.app.dailyReport đã có = '/daily-report')
  src/lib/permissions.ts    (submitDailyReport permission đã có)
  src/lib/supabase-browser.ts
  Tất cả schedule files
```

### Patterns Bắt Buộc — Từ Codebase Hiện Tại

```typescript
// ✅ Named export — không default export
export function DailyReportForm(...)
export const DailyReportService = { ... }

// ✅ Supabase singleton
import { supabase } from '@/lib/supabase-browser'
// KHÔNG createClient() thêm lần nào

// ✅ maybeSingle() cho query có thể không có kết quả
.maybeSingle()   // return null nếu không tồn tại

// ✅ getSession() thay vì getUser()
const { data: { session } } = await supabase.auth.getSession()

// ✅ Sonner toast
import { toast } from 'sonner'
toast.success('Đã nộp daily report')
toast.error('Không thể nộp: ' + error.message)

// ✅ cn() cho className
import { cn } from '@/lib/utils'

// ✅ QUERY_KEYS constant
import { QUERY_KEYS } from '@/lib/query-keys'
queryKey: [QUERY_KEYS.dailyReports, tenantId, { userId, date: reportDate }]

// ✅ ROUTES constant
import { ROUTES } from '@/lib/routes'
// Sidebar/nav đã link đến ROUTES.app.dailyReport

// ✅ fieldset disabled khi pending
<fieldset disabled={isPending}>...</fieldset>

// ✅ Loader2 spinner trên submit button
{isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}

// ✅ Throw on error trong service
if (error) throw error
return data

// ✅ Generated types
import type { Tables } from '@/lib/supabase-types'
type DailyReport = Tables<'daily_reports'>

// ✅ date-fns-tz cho timezone conversion
import { toZonedTime, format } from 'date-fns-tz'
```

### Scope Boundary — KHÔNG Làm Trong Story 4.1

- ❌ Cross-validation / discrepancy detection → Story 4.2
- ❌ Manager report view / team reports → Story 4.3
- ❌ Edit hoặc delete report đã submit → không bao giờ (append-only design)
- ❌ Report cho ngày khác (hôm qua, hôm kia) → out of scope MVP
- ❌ Notification reminder → Story 6.3
- ❌ Report history list (xem nhiều ngày) → out of scope Story 4.1

### NFR Requirements

- **NFR9:** Tenant isolation — RLS tự xử lý, không truyền tenantId thủ công vào WHERE clause (RLS filter tự động qua `current_tenant_id()`)
- **NFR4:** Submit form phải responsive — không lag sau khi click submit, `isPending` feedback ngay lập tức
- `tasks` array tối thiểu 1 item — enforce bằng Zod `z.array(...).min(1)` + disable "Xóa" button khi chỉ còn 1 task

### Không Có Migration Mới

`daily_reports` table + RLS + trigger đã tồn tại từ:
- `20260323000007_create_daily_reports.sql` — table + trigger
- `20260323000011_rls_policies.sql` — RLS policies

Không cần `npx supabase db push`. Chỉ cần chạy `npx supabase test db` để confirm test suite vẫn pass sau khi implement.

---

## Checklist Trước Khi Done

- [x] `npm run lint` — 0 errors
- [x] `npm run test` — Vitest pass (57/57)
- [x] `npx supabase test db` — Tất cả pgTAP tests PASS (27/27)
- [ ] Manual test: mở `/daily-report` → form trống hiển thị
- [ ] Manual test: add nhiều tasks → submit → read-only view hiển thị
- [ ] Manual test: submit với output_link rỗng → không lưu link (không crash)
- [ ] Manual test: submit với URL hợp lệ → link clickable trong read-only view
- [ ] Manual test: F5 sau khi submit cùng ngày → read-only view hiển thị ngay
- [ ] Manual test: submit sau deadline tenant (03:00 sáng) → is_late = true → badge "Nộp muộn"

---

## Dev Agent Record

### Implementation Plan

7 files mới, 0 file sửa đổi, 0 migration mới:
1. Schema + types + constants (daily-report.schema.ts)
2. Service layer: getTodayReport + submitReport (daily-report.service.ts)
3. React Query hooks: useTodayReport + useSubmitReport
4. Components: DailyReportForm (useFieldArray + useWatch pattern) + DailyReportView
5. Route page: DailyReportPage — orchestrates timezone, reportDate, form/view toggle

### Completion Notes

- Tất cả tasks hoàn thành 2026-03-24
- `DailyReportForm` dùng `useWatch` thay `form.watch()` trong loop để tránh React Compiler warning (incompatible-library)
- `TaskRow` sub-component được extract để `useWatch` gọi đúng theo rules of hooks
- `is_late` không bao giờ được truyền từ FE — DB trigger tự tính BEFORE INSERT
- `output_link` empty string được omit hoàn toàn khỏi payload khi submit
- Timezone fallback chain: user.timezone → tenant.timezone → 'UTC'
- 22 unit tests mới cho schema (outputTypeSchema, taskItemSchema, dailyReportFormSchema, labels/placeholders)
- Lint: 0 errors, 0 warnings

### Debug Log

_(trống — không có issue nào phát sinh)_

---

## File List

**Tạo mới:**
- `src/features/daily-report/schemas/daily-report.schema.ts`
- `src/features/daily-report/services/daily-report.service.ts`
- `src/features/daily-report/hooks/use-today-report.ts`
- `src/features/daily-report/hooks/use-submit-report.ts`
- `src/features/daily-report/components/DailyReportForm.tsx`
- `src/features/daily-report/components/DailyReportView.tsx`
- `src/routes/_app/daily-report.tsx`
- `src/features/daily-report/__tests__/daily-report.test.ts`

**Không thay đổi file nào khác.**

---

## Change Log

- 2026-03-24: Story 4.1 implemented — Submit Daily Report feature (7 new files + tests). No DB migrations needed.

---

## Completion Note

Story được tạo tự động bởi create-story workflow — 2026-03-24.
Context đầy đủ từ: epics.md (Epic 4), architecture.md, migration 000007, RLS policies, story 2.2 patterns.
Dev agent có đủ thông tin để implement flawlessly.
