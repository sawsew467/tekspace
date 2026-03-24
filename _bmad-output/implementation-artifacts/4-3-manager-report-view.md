# Story 4.3: Manager Report View

**Status:** done
**Epic:** 4 — Daily Report
**Story ID:** 4.3
**Story Key:** 4-3-manager-report-view
**Created:** 2026-03-24

---

## Story

As a Manager or Owner,
I want to view all team members' daily reports from one place,
So that I can track what everyone accomplished without asking individually.

---

## Acceptance Criteria

1. **Danh sách reports ngày hôm nay** — Khi Manager/Owner truy cập trang `/daily-report`, ngoài form nộp report của chính mình, còn thấy **panel Team Reports** hiển thị danh sách tất cả active members + report status của ngày hôm nay.

2. **Filter theo ngày** — Manager có thể chọn ngày để xem reports (mặc định: ngày hôm nay). Điều hướng qua `<` / `>` button hoặc date picker.

3. **Filter theo member** — Có ô tìm kiếm/filter để lọc theo tên member.

4. **Filter theo status** — Manager có thể filter theo: tất cả / submitted / missing / late.

5. **Hiển thị "Chưa nộp" cho missing members** — Member chưa nộp report vẫn xuất hiện trong danh sách với status badge "Chưa nộp" (không bị ẩn).

6. **Xem chi tiết report** — Khi Manager click vào report đã submit, hiển thị đầy đủ: tasks completed, hours logged, output links (clickable, mở tab mới).

7. **Output links clickable** — PR link, Figma link, v.v. đều có thể click trực tiếp từ manager view. URL được sanitize (chỉ allow http/https, reject javascript:).

8. **Member chỉ thấy form của mình** — Member role KHÔNG thấy Team Reports panel — chỉ thấy form submit/view của ngày hôm nay (behavior hiện tại không thay đổi).

---

## Tasks / Subtasks

### Service Layer

- [x] Task 1: Thêm `getTeamReportsForDate` vào `src/features/daily-report/services/daily-report.service.ts`
  - [x] Query `daily_reports` với explicit fields + JOIN `users(id, full_name, avatar_url)`, filter theo `tenant_id` + `report_date`
  - [x] Export type `TeamReportRow` (report data + embedded user)
  - [x] Đặt sau `submitReport` — không xóa/sửa function nào đã có

### Hook

- [x] Task 2: Tạo `src/features/daily-report/hooks/use-team-reports.ts`
  - [x] `useTeamReports(tenantId, date)` — `useQuery` gọi `DailyReportService.getTeamReportsForDate`
  - [x] `queryKey: [QUERY_KEYS.dailyReports, tenantId, { date }]` (khác key với useTodayReport)
  - [x] `enabled: !!tenantId && !!date`
  - [x] `useActiveMembers(tenantId)` — reuse `getMembers` từ `tenant.service.ts` (đã có sẵn, không viết lại)
    → Import `{ getMembers }` từ `@/features/tenant/services/tenant.service`

### Components

- [x] Task 3: Tạo `src/features/daily-report/components/ReportStatusBadge.tsx`
  - [x] Status: `'submitted'` → Badge variant secondary + text "Đã nộp"
  - [x] Status: `'late'` → Badge variant destructive + text "Nộp muộn" (dùng giống `DailyReportView`)
  - [x] Status: `'missing'` → Badge variant outline + text "Chưa nộp" (muted color)
  - [x] Export type `ReportStatus = 'submitted' | 'late' | 'missing'`

- [x] Task 4: Tạo `src/features/daily-report/components/TeamReportList.tsx`
  - [x] Props: `{ members: TenantMemberWithUser[], reports: TeamReportRow[], selectedDate: string, timezone: string }`
  - [x] Merge logic: với mỗi member trong `members`, tìm report tương ứng trong `reports` (by `user_id`)
  - [x] Status derive: `report.is_late ? 'late' : report ? 'submitted' : 'missing'`
  - [x] Filter UI: search by name (useState), filter by status (tab hoặc select)
  - [x] Render danh sách: mỗi row có avatar/tên, `ReportStatusBadge`, hours (nếu có), click để mở detail
  - [x] Detail panel: collapsible/accordion hoặc sheet khi click vào row — render `DailyReportView` component với report data
  - [x] XSS prevention: output links sanitize giống `DailyReportView` (http/https only) — `DailyReportView` đã handle, reuse component
  - [x] Empty state: khi filter không có kết quả → hiển thị message phù hợp

### Route Update

- [x] Task 5: Cập nhật `src/routes/_app/daily-report.tsx`
  - [x] Import `usePermissions` từ `@/hooks/use-permissions`
  - [x] Import `useTeamReports` + `useActiveMembers` (nếu export cả 2 từ hook file)
  - [x] Import `TeamReportList` component
  - [x] `const { canManageSchedule, activeRole } = usePermissions()` — hoặc dùng `activeRole` để check `manager` | `owner`
  - [x] Khi `activeRole === 'manager' || activeRole === 'owner'`: render thêm Team Reports section bên dưới (hoặc bên trên) form của manager
  - [x] Manager vẫn có form submit report của chính mình — KHÔNG remove
  - [x] Date navigation state: `useState` với ngày hiện tại theo timezone của user (dùng `reportDate` đã compute)

---

## Dev Notes

### Data Strategy — Merge Client-Side

**Tại sao merge client-side thay vì SQL JOIN phức tạp?**

Không có single SQL query nào cho phép lấy cả "submitted reports" lẫn "missing members" trong một Supabase PostgREST call (vì cần LEFT JOIN từ `tenant_members` → `daily_reports`). Approach đơn giản và đã hoạt động trong codebase:

```
1. getMembers(tenantId)           → danh sách active members (đã có trong tenant.service.ts)
2. getTeamReportsForDate(tenantId, date) → chỉ rows đã submit cho ngày đó
3. Merge trong component: tìm report cho mỗi member bằng user_id
```

**Caching strategy:**
- `getMembers` → dùng `QUERY_KEYS.tenantMembers` key (có thể đã cached từ team page)
- `getTeamReportsForDate` → dùng `[QUERY_KEYS.dailyReports, tenantId, { date }]`

### Service Function Mới — `getTeamReportsForDate`

```typescript
// Thêm vào DailyReportService (sau submitReport)
export type TeamReportRow = {
  id: string
  tenant_id: string
  user_id: string
  report_date: string
  tasks: unknown  // jsonb — cast sang TaskData[] khi dùng (giống DailyReportView pattern)
  hours_logged: number
  is_late: boolean
  submitted_at: string
  created_at: string
  users: {
    id: string
    full_name: string
    avatar_url: string | null
  }
}

getTeamReportsForDate: async (
  tenantId: string,
  reportDate: string,
): Promise<TeamReportRow[]> => {
  const { data, error } = await supabase
    .from('daily_reports')
    .select('id, tenant_id, user_id, report_date, tasks, hours_logged, is_late, submitted_at, created_at, users(id, full_name, avatar_url)')
    .eq('tenant_id', tenantId)
    .eq('report_date', reportDate)
    .order('submitted_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as TeamReportRow[]
}
```

**Rule từ architecture:** explicit fields bắt buộc khi có JOIN (dùng `select('id, ..., users(id, full_name, avatar_url)')` — không dùng `select('*')` với JOIN).

### Hook — `use-team-reports.ts`

```typescript
import { useQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/lib/query-keys'
import { getMembers } from '@/features/tenant/services/tenant.service'
import { DailyReportService } from '@/features/daily-report/services/daily-report.service'

export function useTeamReports(tenantId: string | null, date: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.dailyReports, tenantId, { date }],
    queryFn: () => DailyReportService.getTeamReportsForDate(tenantId!, date),
    enabled: !!tenantId && !!date,
    staleTime: 30_000,  // 30s — manager view không cần realtime
  })
}

export function useActiveMembers(tenantId: string | null) {
  return useQuery({
    queryKey: [QUERY_KEYS.tenantMembers, tenantId],
    queryFn: () => getMembers(tenantId!),
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,  // 5 phút — member list ít thay đổi
  })
}
```

**Query key phân biệt:**
- `useTodayReport`: `[QUERY_KEYS.dailyReports, tenantId, { userId, date }]` → member's own report
- `useTeamReports`: `[QUERY_KEYS.dailyReports, tenantId, { date }]` → team reports (không có userId)
→ Hai keys khác nhau, không conflict. `invalidateQueries({ queryKey: [QUERY_KEYS.dailyReports] })` sẽ invalidate cả hai (prefix match) — OK behavior.

### Merge Logic — TeamReportList

```typescript
// Type cho merged view
type MemberReportEntry = {
  member: TenantMemberWithUser
  report: TeamReportRow | null
  status: 'submitted' | 'late' | 'missing'
}

// Merge trong component
const reportsByUserId = new Map(reports.map(r => [r.user_id, r]))

const entries: MemberReportEntry[] = members.map(member => {
  const report = reportsByUserId.get(member.user_id) ?? null
  const status = !report ? 'missing' : report.is_late ? 'late' : 'submitted'
  return { member, report, status }
})

// Filter
const filtered = entries
  .filter(e => statusFilter === 'all' || e.status === statusFilter)
  .filter(e => nameFilter === '' || e.member.users.full_name.toLowerCase().includes(nameFilter.toLowerCase()))
```

### RLS — Manager Đã Có Quyền SELECT

Policy hiện tại trong `20260323000011_rls_policies.sql`:
```sql
CREATE POLICY daily_reports_select_policy ON public.daily_reports
  FOR SELECT USING (
    tenant_id = public.current_tenant_id()
    AND (user_id = auth.uid() OR public.is_tenant_manager())
  );
```

**Manager/Owner (`is_tenant_manager() = true`) đã có quyền SELECT tất cả reports trong tenant → KHÔNG cần migration mới.**

### DailyReportView — Reuse Cho Manager View

`DailyReportView` component hiện tại (`src/features/daily-report/components/DailyReportView.tsx`) nhận `{ report: DailyReport, timezone: string }`.

`DailyReport = Tables<'daily_reports'>` — cùng shape với `TeamReportRow` trừ embedded `users`.

Để reuse `DailyReportView` trong manager view, chỉ cần extract report fields:
```typescript
// Cast TeamReportRow → DailyReport (omit users field)
const { users, ...reportOnly } = teamReportRow
// Hoặc type TeamReportRow extends (Omit<DailyReport, never>) & { users: {...} }
```

**HOẶC** tạo một adapter nhỏ. Không nên duplicate rendering logic — reuse `DailyReportView`.

### Route — Conditional Rendering

```typescript
// Trong DailyReportPage:
const { activeRole } = usePermissions()
const isManager = activeRole === 'manager' || activeRole === 'owner'

// State cho date navigation trong manager view
const [viewDate, setViewDate] = useState(reportDate)  // mặc định = ngày hôm nay

// Queries cho manager view (chỉ fetch khi là manager)
const { data: teamReports = [], isLoading: isTeamLoading } = useTeamReports(
  isManager ? activeTenantId : null,  // enabled=false khi không phải manager
  viewDate,
)
const { data: activeMembers = [], isLoading: isMembersLoading } = useActiveMembers(
  isManager ? activeTenantId : null,
)
```

**Lưu ý:** Dùng `enabled: !!tenantId` trong hook → khi truyền `null` thì query không chạy. Pattern này nhất quán với codebase.

### Không Cần Route Mới

Architecture chỉ có một route file `daily-report.tsx` cho tất cả FR28-32, FR52. Manager view được render trên cùng page, dưới form của manager. **KHÔNG** tạo route `/reports` hay `/daily-report/team` — vi phạm architecture.

### Layout Manager View

Đề xuất layout (không cứng nhắc — dev có thể điều chỉnh):

```
/daily-report (Manager)
├── Header: "Daily Report — [ngày]"
├── Card: "Report hôm nay của tôi" (existing form/view — không thay đổi)
└── Card: "Team Reports — [ngày]"
    ├── Date navigation: < [date picker] >
    ├── Search + status filter
    └── MemberReportEntry list (collapsible rows)
```

Member view (không thay đổi):
```
/daily-report (Member)
└── Card: "Nộp report hôm nay" / "Report hôm nay" (hiện tại)
```

### UI Components — Shadcn Đã Có

Dùng components đã install — **KHÔNG** install thêm:
- `Badge` — cho `ReportStatusBadge`
- `Input` — cho search box
- `Select` / `Tabs` — cho status filter
- `Collapsible` hoặc `Accordion` — cho expandable report detail (nếu chưa có, check trước)
- `Avatar` — nếu cần hiển thị member avatar
- `Skeleton` — cho loading state

Check đã có trước khi dùng:
```bash
ls src/components/ui/
```

### XSS Prevention — Áp Dụng Pattern Đã Có

`DailyReportView.tsx` đã xử lý sanitize output_link:
```typescript
const parsed = new URL(task.output_link)
if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
  safeHref = task.output_link
}
```
**Reuse `DailyReportView` component** cho manager view — không duplicate sanitize logic.

### Naming Convention — Nhất Quán

```typescript
// ✅ Named exports — không default export
export function useTeamReports(...)
export function useActiveMembers(...)
export function TeamReportList(...)
export function ReportStatusBadge(...)

// ✅ Query keys dùng QUERY_KEYS constant
queryKey: [QUERY_KEYS.dailyReports, tenantId, { date }]
queryKey: [QUERY_KEYS.tenantMembers, tenantId]  // dùng cho getMembers

// ✅ Import supabase singleton
import { supabase } from '@/lib/supabase-browser'

// ✅ cn() cho conditional className
import { cn } from '@/lib/utils'

// ✅ lucide-react cho icons
import { ChevronLeft, ChevronRight, Search, Users } from 'lucide-react'

// ✅ date-fns cho date formatting (đã dùng trong codebase)
import { format, addDays, parseISO } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
```

### File Structure — Tạo Mới + Modify

```
TẠO MỚI:
  src/features/daily-report/hooks/use-team-reports.ts          ← useTeamReports + useActiveMembers
  src/features/daily-report/components/ReportStatusBadge.tsx   ← status badge component
  src/features/daily-report/components/TeamReportList.tsx      ← team report panel

MODIFY:
  src/features/daily-report/services/daily-report.service.ts  ← thêm getTeamReportsForDate + TeamReportRow type
  src/routes/_app/daily-report.tsx                            ← thêm manager view + date navigation

KHÔNG THAY ĐỔI:
  src/features/daily-report/components/DailyReportForm.tsx    ← không cần sửa
  src/features/daily-report/components/DailyReportView.tsx    ← reuse, không sửa
  src/features/daily-report/schemas/daily-report.schema.ts    ← không cần sửa
  src/features/daily-report/hooks/use-today-report.ts         ← giữ nguyên
  src/features/daily-report/hooks/use-submit-report.ts        ← giữ nguyên
  src/lib/routes.ts                                           ← không thêm route mới
  Tất cả migration files                                      ← RLS đã đủ
```

### Không Làm Trong Story 4.3

- ❌ Route mới `/reports` hay `/daily-report/team` — vi phạm architecture
- ❌ Cho phép Manager edit/delete report của member — append-only design
- ❌ Realtime subscription cho team reports — staleTime 30s là đủ
- ❌ Export report ra CSV — Epic 5 analytics
- ❌ Notification khi member nộp report — Epic 6

### Learnings Từ Story 4.2

- **Reuse components thay vì tạo mới** — `DailyReportView` đã làm tốt rendering + XSS, reuse cho manager view
- **`useWatch` pattern** — không áp dụng cho story này (read-only view)
- **Named exports** — nhất quán với codebase
- **`is_late` được compute bởi DB trigger** — không tính lại ở FE

### Learnings Từ Story 4.1 (qua 4.2)

- **`fieldset disabled={isPending}`** — pattern khi có pending state
- **Output type labels** — dùng `OUTPUT_TYPE_LABELS` đã export từ schema
- **`TaskData` type** — tasks trong DB là `jsonb`, phải cast bằng `Array.isArray` guard (giống `DailyReportView`)

---

## Checklist Trước Khi Done

- [ ] `npm run lint` — 0 errors
- [ ] `npm run test` — Vitest pass (tất cả tests hiện có không bị broken)
- [ ] `npx supabase test db` — pgTAP pass (không có migration mới, verify không regression)
- [ ] Manual test (Manager role):
  - [ ] Truy cập `/daily-report` → thấy Team Reports panel
  - [ ] Members đã submit → hiển thị "Đã nộp" badge + hours
  - [ ] Members chưa submit → hiển thị "Chưa nộp" badge, vẫn trong danh sách
  - [ ] Members nộp muộn → hiển thị "Nộp muộn" badge (destructive)
  - [ ] Click vào report đã submit → mở detail với tasks + hours + links
  - [ ] Click output link → mở tab mới với URL đúng
  - [ ] Filter theo status "missing" → chỉ hiện members chưa nộp
  - [ ] Search theo tên → filter đúng
  - [ ] Navigate sang ngày hôm qua → load reports của ngày đó
  - [ ] Manager vẫn thấy form submit của chính mình
- [ ] Manual test (Member role):
  - [ ] Truy cập `/daily-report` → KHÔNG thấy Team Reports panel
  - [ ] Form submit vẫn hoạt động bình thường (không regression)
- [ ] Manual test (Owner role):
  - [ ] Truy cập `/daily-report` → thấy Team Reports panel (giống Manager)

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5

### Debug Log References

- Duplicate imports trong `TeamReportList.tsx` (lucide-react, daily-report.service, ReportStatusBadge) — đã fix bằng cách merge các import cùng module vào một dòng: `import { ReportStatusBadge, type ReportStatus }`.
- Stale ESLint cache báo lỗi giả cho `navGroupsWithBadge` trong `app-sidebar.tsx` (pre-existing từ story 6-1, không liên quan story này) — đã xóa `.eslintcache` để reset. Lint pass sau khi clear cache.
- `submitReport` bị mất khi edit service file — phát hiện ngay khi verify, restore thành công.

### Completion Notes List

- Thêm `TeamReportRow` type + `getTeamReportsForDate` function vào `DailyReportService` — explicit fields với JOIN `users(id, full_name, avatar_url)` theo architecture rule.
- Tạo `use-team-reports.ts` với 2 hooks: `useTeamReports(tenantId, date)` và `useActiveMembers(tenantId)`. Cả hai dùng `enabled: !!tenantId` để disable khi không phải manager — truyền `null` không làm query chạy.
- Tạo `ReportStatusBadge.tsx`: 3 trạng thái (submitted/late/missing) dùng Badge variant khác nhau — đã export `ReportStatus` type.
- Tạo `TeamReportList.tsx`: merge members + reports client-side bằng Map (O(n+m)), filter theo tên + status, Collapsible row expand để xem detail — reuse `DailyReportView` (XSS protection đã có sẵn). Adapter function `reportAsDailyReport` strip `users` field trước khi pass vào `DailyReportView`.
- Cập nhật `daily-report.tsx`: `isManager` check từ `usePermissions().activeRole`, Team Reports card chỉ render khi manager/owner, date navigation (< / >) với "Hôm nay" button, queries disable bằng `null` khi không phải manager. `viewDate` sync với `reportDate` qua `useEffect`.
- Kết quả: 0 lint errors, 88/88 Vitest pass, 41/41 pgTAP pass.

### File List

**Tạo mới:**
- `src/features/daily-report/hooks/use-team-reports.ts`
- `src/features/daily-report/components/ReportStatusBadge.tsx`
- `src/features/daily-report/components/TeamReportList.tsx`

**Thay đổi:**
- `src/features/daily-report/services/daily-report.service.ts` — thêm `TeamReportRow` type + `getTeamReportsForDate`
- `src/routes/_app/daily-report.tsx` — thêm manager view (Team Reports panel, date navigation, role-based rendering)

---

## Change Log

- 2026-03-24: Story 4.3 created — Manager Report View. Context từ: epics.md (Epic 4, Story 4.3), story 4.2 patterns, DailyReportView.tsx, daily-report.service.ts, tenant.service.ts, RLS policies.
- 2026-03-24: Story 4.3 implemented — 3 files mới (use-team-reports.ts, ReportStatusBadge.tsx, TeamReportList.tsx) + 2 files modify (daily-report.service.ts, daily-report.tsx). 0 lint errors, 88/88 Vitest pass, 41/41 pgTAP pass.

---

## Completion Note

Story được tạo bởi create-story workflow — 2026-03-24.
Context đầy đủ từ: epics.md (Epic 4), story 4.1 + 4.2 patterns, DailyReportService, TenantService (getMembers), RLS policies (daily_reports_select_policy), architecture feature structure, permissions system.
