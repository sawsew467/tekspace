# Story 4.6: Edit Report Window

**Status:** review
**Epic:** 4 — Daily Report
**Story ID:** 4.6
**Story Key:** 4-6-edit-report-window
**Created:** 2026-03-24
**Updated:** 2026-03-25

---

## Story

As a member,
I want to edit my daily report after submitting it, within the deadline window,
So that I can fix mistakes or add forgotten tasks before the deadline passes.

---

## Acceptance Criteria

1. **Nút "Chỉnh sửa"** — Trong `DailyReportView` (tab "Hôm nay"), khi report hôm nay còn trong deadline window → hiển thị button **"Chỉnh sửa"**. Sau deadline hoặc xem report ngày cũ → không hiện nút.

2. **Deadline window** — Window = `report_date + tenant.daily_report_deadline_hour` (theo team timezone). Nếu `now() < deadline` → còn trong window → cho phép edit. Logic này tính ở FE (không cần DB function).

3. **Edit mode** — Khi click "Chỉnh sửa", form hiển thị với giá trị **pre-filled** từ report hiện tại (tasks, hours_logged). User chỉnh sửa rồi submit.

4. **Submit chỉnh sửa** — Submit gọi `updateReport` (UPDATE, không INSERT). Sau khi thành công: form biến mất, `DailyReportView` re-render với dữ liệu mới. Badge **"Đã chỉnh sửa"** hiện cạnh timestamp.

5. **`updated_at` tracking** — Khi UPDATE, DB set `updated_at = now()`. `DailyReportView` hiển thị `updated_at` nếu khác với `submitted_at` (tức là đã chỉnh sửa).

6. **`is_late` không thay đổi khi edit** — `is_late` được set lúc submit lần đầu và **không** tính lại khi edit. Nếu nộp muộn rồi edit → vẫn là "Nộp muộn". Chỉ `tasks`, `hours_logged`, `updated_at` được update.

7. **Report ngày cũ không thể edit** — Chỉ report `report_date = today` và còn trong window mới có nút "Chỉnh sửa". Report trong tab "Lịch sử" (ngày cũ) → read-only hoàn toàn, không có nút edit.

8. **RLS UPDATE policy** — DB-level policy: member chỉ UPDATE report của `user_id = auth.uid()` trong `tenant_id = current_tenant_id()`. Deadline window check ở FE, không ở RLS.

9. **`is_late` trigger không chạy lại** — Trigger `is_late` hiện tại chỉ BEFORE INSERT. Không thêm BEFORE UPDATE trigger. `is_late` là immutable sau khi set.

---

## Tasks / Subtasks

### DB Migration

- [ ] Task 1: Tạo migration `supabase/migrations/20260325000002_daily_report_edit_window.sql`
  - [ ] Thêm column: `ALTER TABLE public.daily_reports ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NULL;`
  - [ ] Thêm UPDATE RLS policy:
    ```sql
    CREATE POLICY daily_reports_update_policy ON public.daily_reports
      FOR UPDATE USING (
        tenant_id = public.current_tenant_id()
        AND user_id = auth.uid()
      )
      WITH CHECK (
        tenant_id = public.current_tenant_id()
        AND user_id = auth.uid()
      );
    ```
  - [ ] Index: không cần (update theo PK `id` đã indexed)
  - [ ] Sau khi apply: `npx supabase db push --local` rồi `npx supabase gen types typescript --local > src/lib/supabase-types.ts` để `updated_at` tự động có trong `Tables<'daily_reports'>`
  - [ ] Viết pgTAP test cho UPDATE policy (xem phần Tests)

### Service Update

- [ ] Task 2: Thêm `updateReport` vào `src/features/daily-report/services/daily-report.service.ts`
  - [ ] Function signature: `updateReport(reportId, tasks, hoursLogged)`
  - [ ] UPDATE `tasks`, `hours_logged`, `updated_at = now()` — KHÔNG update `is_late`, `report_date`, `submitted_at`
  - [ ] `select()` explicit fields bao gồm `updated_at` (architecture rule: explicit fields khi không có JOIN)
  - [ ] **Cập nhật `getAllReports`**: Thêm `updated_at` vào explicit select trong `.select('id, tenant_id, ..., updated_at')`
  - [ ] **Cập nhật `getTodayReport`**: Dùng `select('*')` → tự pick up `updated_at` sau khi regenerate types ✓

### Service — Lấy Deadline Từ Tenant

- [ ] Task 3: Thêm `getTenantDailyReportDeadline` vào `src/features/schedule/services/schedule.service.ts`
  - [ ] Fetch `daily_report_deadline_hour` từ `tenants` table (column đã tồn tại)
  - [ ] Return type: `number`
  - [ ] Pattern giống `getTenantTimezone` (cùng file, cùng table) — không reinvent:
    ```typescript
    getTenantDailyReportDeadline: async (tenantId: string): Promise<number> => {
      const { data, error } = await supabase
        .from('tenants')
        .select('daily_report_deadline_hour')
        .eq('id', tenantId)
        .single()
      if (error) throw error
      if (!data) throw new Error('Tenant không tồn tại')
      return data.daily_report_deadline_hour
    },
    ```

### Hook

- [ ] Task 4: Tạo `src/features/daily-report/hooks/use-update-report.ts`
  - [ ] `useUpdateReport()` — `useMutation` gọi `DailyReportService.updateReport`
  - [ ] `onSuccess`: `queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.dailyReports] })` + toast "Đã cập nhật report"
  - [ ] `onError`: toast error "Cập nhật thất bại"
  - [ ] Pattern giống `use-submit-report.ts` (đã có trong codebase)

### Deadline Window Helper

- [ ] Task 5: Thêm `isWithinEditWindow` vào `src/features/daily-report/schemas/daily-report.schema.ts`
  - [ ] `isWithinEditWindow(reportDate: string, deadlineHour: number, tenantTimezone: string): boolean`
  - [ ] Logic: compute `deadline = reportDate ngày tiếp theo, giờ deadlineHour, theo tenantTimezone` → so sánh với `now()`
  - [ ] Dùng `fromZonedTime` từ `date-fns-tz` — **đã có trong codebase** (`schedule.service.ts` import `fromZonedTime, toZonedTime from 'date-fns-tz'`). Không cần install mới.
  - [ ] Unit tests bắt buộc (xem phần Tests)

### View Update

- [ ] Task 6: Cập nhật `src/features/daily-report/components/DailyReportView.tsx`
  - [ ] Thêm props: `showEditButton?: boolean`, `onEdit?: () => void`
  - [ ] Render button "Chỉnh sửa" khi `showEditButton === true`:
    ```tsx
    {showEditButton && onEdit && (
      <Button variant="outline" size="sm" onClick={onEdit}>
        <Pencil className="h-3.5 w-3.5 mr-1" />
        Chỉnh sửa
      </Button>
    )}
    ```
  - [ ] "Đã chỉnh sửa" badge: nếu `report.updated_at && report.updated_at !== report.submitted_at` → hiện `<Badge variant="outline">Đã chỉnh sửa</Badge>` cạnh timestamp
  - [ ] `Pencil` icon từ `lucide-react` — đã có dependency

### Route Update

- [ ] Task 7: Cập nhật `src/routes/_app/daily-report.tsx`
  - [ ] Import `useUpdateReport` + `isWithinEditWindow`
  - [ ] Thêm query `daily_report_deadline_hour` (dùng `ScheduleService.getTenantDailyReportDeadline`):
    ```typescript
    const { data: deadlineHour = 3 } = useQuery({
      queryKey: ['tenant-deadline', activeTenantId],
      queryFn: () => ScheduleService.getTenantDailyReportDeadline(activeTenantId!),
      enabled: !!activeTenantId,
      staleTime: 10 * 60 * 1000,  // 10 phút — giống tenantTimezone query
    })
    ```
  - [ ] State: `const [isEditing, setIsEditing] = useState(false)`
  - [ ] Compute: `const canEdit = useMemo(() => todayReport ? isWithinEditWindow(todayReport.report_date, deadlineHour, timezone) : false, [todayReport, deadlineHour, timezone])`
  - [ ] Reset editing khi chuyển ngày: `useEffect(() => { setIsEditing(false) }, [reportDate])`
  - [ ] `editDefaultValues` — derive từ `todayReport` (xem Dev Notes cho full code)
  - [ ] `handleUpdate(values)`: gọi `updateReport.mutate(...)` → `onSuccess`: `setIsEditing(false)`
  - [ ] Trong render (tab "Hôm nay" — `viewDate === today`): toggle giữa `DailyReportForm` (edit mode) và `DailyReportView` (view mode với `showEditButton={canEdit}`)

### DailyReportForm Update

- [ ] Task 8: Cập nhật `src/features/daily-report/components/DailyReportForm.tsx`
  - [ ] Thêm optional prop: `defaultValues?: DailyReportFormValues`
  - [ ] Dùng trong `useForm`: `defaultValues: props.defaultValues ?? { tasks: [...], hours_logged: 0 }`
  - [ ] Thêm optional prop: `submitLabel?: string` (default: "Nộp Daily Report") → edit mode dùng "Cập nhật Report"
  - [ ] Thêm optional prop: `onCancel?: () => void` → hiển thị button "Huỷ" khi có, click → `onCancel()`

### Tests

- [ ] Task 9: pgTAP tests cho UPDATE RLS — thêm vào `supabase/tests/rls_policies.test.sql`
  - [ ] Member có thể UPDATE report của chính mình trong cùng tenant
  - [ ] Member KHÔNG thể UPDATE report của người khác
  - [ ] Member KHÔNG thể UPDATE report của tenant khác
  - [ ] Verify `is_late` không bị thay đổi khi UPDATE (field không nằm trong UPDATE payload)

- [ ] Task 10: Unit tests cho `isWithinEditWindow` — thêm vào `src/features/daily-report/__tests__/daily-report.test.ts`
  - [ ] Within window: reportDate = today, deadline = 3am tomorrow, now = 11pm → true
  - [ ] After window: reportDate = today, deadline = 3am tomorrow, now = 4am tomorrow → false
  - [ ] Yesterday report: reportDate = yesterday → always false (window đã qua)
  - [ ] Boundary: deadline = 3am, now = 3am exactly → false (≥ deadline → closed)
  - [ ] Timezone handling: tenant TZ = "Asia/Ho_Chi_Minh", deadline 3am ICT
  - [ ] Invalid timezone → return false (safe default từ try/catch)

---

## Dev Notes

### Migration File

Tên file: `supabase/migrations/20260325000002_daily_report_edit_window.sql`

> ⚠️ **Sequence update**: Migration gốc story ghi `20260324000019` nhưng thực tế last migration hiện tại là `20260325000001_fix_notifications_select_policy_for_realtime.sql` → dùng `20260325000002`.

```sql
-- Add updated_at column to daily_reports
ALTER TABLE public.daily_reports
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NULL;

-- UPDATE RLS policy — member có thể UPDATE report của chính mình
-- Deadline window check được thực hiện ở FE, không ở RLS
CREATE POLICY daily_reports_update_policy ON public.daily_reports
  FOR UPDATE
  USING (
    tenant_id = public.current_tenant_id()
    AND user_id = auth.uid()
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND user_id = auth.uid()
  );

-- Note: Không cần UPDATE trigger cho is_late
-- is_late được set lúc INSERT và immutable sau đó
-- Trigger hiện tại chỉ BEFORE INSERT — giữ nguyên
```

**Sau khi apply migration:**
```bash
npx supabase db push --local
npx supabase gen types typescript --local > src/lib/supabase-types.ts
```
`updated_at` sẽ tự động có trong `Tables<'daily_reports'>` → `DailyReport` type tự update (đang dùng `export type DailyReport = Tables<'daily_reports'>`).

### `updateReport` Service Function

```typescript
// Thêm vào DailyReportService (daily-report.service.ts)
updateReport: async (
  reportId: string,
  tasks: TaskPayload[],
  hoursLogged: number,
): Promise<DailyReport> => {
  const { data, error } = await supabase
    .from('daily_reports')
    .update({
      tasks,
      hours_logged: hoursLogged,
      updated_at: new Date().toISOString(),
      // KHÔNG update: is_late, report_date, submitted_at, tenant_id, user_id
    })
    .eq('id', reportId)
    .select('id, tenant_id, user_id, report_date, tasks, hours_logged, is_late, submitted_at, updated_at, created_at')
    .single()
  if (error) throw error
  return data as DailyReport
},
```

**Cập nhật `getAllReports`** — thêm `updated_at` vào explicit select:
```typescript
.select('id, tenant_id, user_id, report_date, tasks, hours_logged, is_late, submitted_at, updated_at, created_at')
```

### isWithinEditWindow Helper

```typescript
// Thêm vào daily-report.schema.ts
// date-fns-tz v3.2.0 đã có trong package.json — fromZonedTime export sẵn
import { fromZonedTime } from 'date-fns-tz'
import { addDays, parseISO, isBefore } from 'date-fns'

/**
 * Kiểm tra xem report có còn trong edit window không.
 * Window: từ lúc submit đến deadline (reportDate+1 ngày, giờ deadlineHour, theo tenantTimezone)
 *
 * @param reportDate - ISO date string 'yyyy-MM-dd' của report
 * @param deadlineHour - giờ deadline (0-23) theo tenant timezone (VD: 3 = 3am)
 * @param tenantTimezone - IANA timezone string (VD: 'Asia/Ho_Chi_Minh')
 * @returns true nếu now() < deadline
 */
export function isWithinEditWindow(
  reportDate: string,
  deadlineHour: number,
  tenantTimezone: string,
): boolean {
  try {
    const nextDay = addDays(parseISO(reportDate), 1)
    const deadlineInTz = new Date(
      nextDay.getFullYear(),
      nextDay.getMonth(),
      nextDay.getDate(),
      deadlineHour,
      0, 0, 0,
    )
    const deadlineUTC = fromZonedTime(deadlineInTz, tenantTimezone)
    return isBefore(new Date(), deadlineUTC)
  } catch {
    return false  // Timezone invalid → không cho edit (safe default)
  }
}
```

> **Note về `date-fns-tz`**: `fromZonedTime` đã được import và dùng trong `src/features/schedule/services/schedule.service.ts` → không phải api mới lạ.

### Edit Mode Flow Trong Route

```typescript
// daily-report.tsx
const [isEditing, setIsEditing] = useState(false)
const updateReport = useUpdateReport()

// Reset khi chuyển ngày
useEffect(() => { setIsEditing(false) }, [reportDate])

const canEdit = useMemo(() => {
  if (!todayReport) return false
  return isWithinEditWindow(todayReport.report_date, deadlineHour, timezone)
}, [todayReport, deadlineHour, timezone])

// Derive defaultValues từ todayReport cho edit form
const editDefaultValues = useMemo((): DailyReportFormValues | undefined => {
  if (!todayReport) return undefined
  const tasks = Array.isArray(todayReport.tasks)
    ? (todayReport.tasks as TaskData[]).map(t => ({
        description: t.description,
        output_type: t.output_type as OutputType,
        output_link: t.output_link ?? '',
        hours: t.hours,  // Story 4.5: per-task hours (optional, backward compat)
      }))
    : [{ description: '', output_type: 'other' as const, output_link: '', hours: undefined }]
  return { tasks, hours_logged: todayReport.hours_logged }
}, [todayReport])

function handleUpdate(values: DailyReportFormValues) {
  if (!todayReport) return
  updateReport.mutate({
    reportId: todayReport.id,
    tasks: values.tasks.map(t => ({
      description: t.description,
      output_type: t.output_type,
      ...(t.output_link ? { output_link: t.output_link } : {}),
      ...(t.hours ? { hours: t.hours } : {}),
    })),
    hoursLogged: values.hours_logged,
  }, {
    onSuccess: () => setIsEditing(false)
  })
}

// Trong render (tab "Hôm nay", viewDate === today):
{todayReport ? (
  isEditing ? (
    <DailyReportForm
      onSubmit={handleUpdate}
      isPending={updateReport.isPending}
      defaultValues={editDefaultValues}
      submitLabel="Cập nhật Report"
      onCancel={() => setIsEditing(false)}
    />
  ) : (
    <DailyReportView
      report={todayReport}
      timezone={timezone}
      showEditButton={canEdit}
      onEdit={() => setIsEditing(true)}
    />
  )
) : (
  <DailyReportForm onSubmit={handleSubmit} isPending={submitReport.isPending} />
)}
```

> **Quan trọng**: Edit button chỉ hiện ở tab "Hôm nay" khi `viewDate === today`. Report ngày cũ (tab "Lịch sử") render `DailyReportView` không truyền `showEditButton`.

### Integration Với Story 4.5 (Per-task Hours)

Story 4.5 đã implement `taskItemFormSchema` với `hours` **bắt buộc** (min 0.5). Khi edit mode dùng `DailyReportForm` với `defaultValues` từ report cũ, phải đảm bảo:
- `editDefaultValues.tasks[i].hours` được map đúng từ `todayReport.tasks`
- Report cũ không có `hours` (backward compat) → `hours: undefined` → form validation sẽ yêu cầu nhập lại
- Đây là behavior mong muốn (edit form enforce per-task hours cho submissions mới)

### File Structure

```
TẠO MỚI:
  supabase/migrations/20260325000002_daily_report_edit_window.sql   ← DB migration
  src/features/daily-report/hooks/use-update-report.ts              ← mutation hook

MODIFY:
  src/features/daily-report/services/daily-report.service.ts        ← thêm updateReport + cập nhật getAllReports select
  src/features/schedule/services/schedule.service.ts                ← thêm getTenantDailyReportDeadline
  src/features/daily-report/schemas/daily-report.schema.ts          ← thêm isWithinEditWindow
  src/features/daily-report/components/DailyReportView.tsx          ← thêm showEditButton, onEdit props + badge
  src/features/daily-report/components/DailyReportForm.tsx          ← thêm defaultValues, submitLabel, onCancel props
  src/routes/_app/daily-report.tsx                                  ← edit mode state + canEdit logic + render toggle
  src/features/daily-report/__tests__/daily-report.test.ts          ← thêm isWithinEditWindow tests
  supabase/tests/rls_policies.test.sql                              ← thêm UPDATE policy tests

KHÔNG THAY ĐỔI:
  src/features/daily-report/components/ReportHistoryList.tsx        ← read-only, không edit
  src/features/daily-report/components/TeamReportList.tsx           ← manager view, không edit
  src/features/daily-report/components/ReportStatusBadge.tsx
  src/features/daily-report/hooks/use-all-reports.ts
  src/features/daily-report/hooks/use-today-report.ts
```

### Không Làm Trong Story 4.6

- ❌ Edit report ngày cũ (past dates) — chỉ today + trong window
- ❌ Versioning / audit trail của edit history — append-only cho now
- ❌ Manager override edit (thay report của member) — không trong scope
- ❌ Edit window khác nhau per-member — dùng tenant setting cho tất cả
- ❌ Confirm dialog trước khi submit update — UX đơn giản là đủ (có "Huỷ" button)
- ❌ `is_late` recompute khi edit — immutable sau INSERT

---

## Checklist Trước Khi Done

- [ ] `npx supabase db push --local` — migration apply thành công
- [ ] `npx supabase gen types typescript --local > src/lib/supabase-types.ts` — `updated_at` có trong generated types
- [ ] `npm run lint` — 0 errors
- [ ] `npm run test` — Vitest pass (bao gồm tests mới cho `isWithinEditWindow`)
- [ ] `npx supabase test db` — pgTAP pass (bao gồm tests mới cho UPDATE RLS policy)
- [ ] Manual test (Member, trong deadline window):
  - [ ] Report hôm nay đã submit → thấy nút "Chỉnh sửa"
  - [ ] Click "Chỉnh sửa" → form hiện với dữ liệu cũ pre-filled
  - [ ] Sửa task, submit → view cập nhật, badge "Đã chỉnh sửa" hiện
  - [ ] Click "Huỷ" → form biến, view cũ lại
  - [ ] `is_late` không thay đổi sau khi edit
- [ ] Manual test (Member, sau deadline):
  - [ ] Nút "Chỉnh sửa" KHÔNG hiện
- [ ] Manual test (Lịch sử):
  - [ ] Report ngày cũ → không có nút "Chỉnh sửa" (bất kể deadline)
- [ ] Manual test RLS (dùng Supabase Dashboard hoặc MCP):
  - [ ] Member A KHÔNG thể UPDATE report của Member B

---

## Change Log

- 2026-03-24: Story 4.6 created — Edit Report Window. Context từ Epic 4 retro, daily-report.tsx, DailyReportView.tsx, DailyReportForm.tsx source review. Migration sequence: 20260324000019.
- 2026-03-25: Story 4.6 implemented — Đầy đủ các tasks. Migration apply OK, types regenerated, 167/167 Vitest pass, 60/60 pgTAP pass, 0 lint errors.
- 2026-03-25: Story 4.6 updated — Cập nhật migration sequence → `20260325000002` (last migration là 20260325000001). Thêm `getTenantDailyReportDeadline` vào ScheduleService (pattern giống `getTenantTimezone`). Ghi rõ `fromZonedTime` đã available từ date-fns-tz trong codebase. Thêm note về regenerate types sau migration. Cập nhật `getAllReports` explicit select. Thêm integration notes với Story 4.5 per-task hours. Status: ready-for-dev.
