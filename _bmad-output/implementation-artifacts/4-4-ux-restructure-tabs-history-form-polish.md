# Story 4.4: UX Restructure — Tabs, History & Form Polish

**Status:** review
**Epic:** 4 — Daily Report
**Story ID:** 4.4
**Story Key:** 4-4-ux-restructure-tabs-history-form-polish
**Created:** 2026-03-24

---

## Story

As a user (member, manager, or owner),
I want the Daily Report page to be organized with tabs and show my report history,
So that I can quickly navigate between my personal report, history, and team overview without scrolling through a long page.

---

## Acceptance Criteria

1. **Tabs layout — tất cả roles** — Trang `/daily-report` dùng `Tabs` component (shadcn/ui). Member thấy 2 tabs: **"Hôm nay"** và **"Lịch sử"**. Manager/Owner thấy 3 tabs: **"Hôm nay"**, **"Lịch sử"**, **"Team"**. Tab "Hôm nay" là active mặc định.

2. **Badge streak trên tab "Lịch sử"** — Tab "Lịch sử" hiển thị streak badge: `🔥 N` (N = số ngày nộp liên tiếp tính từ hôm nay trở về). Nếu streak = 0 → không hiện badge (hoặc hiển thị `0`).

3. **Badge số chưa nộp trên tab "Team"** — Tab "Team" hiển thị số member chưa nộp report hôm nay: `● N chưa nộp`. Nếu tất cả đã nộp → không hiện badge.

4. **Tab "Hôm nay"** — Giữ nguyên behavior hiện tại: form nếu chưa submit, read-only view nếu đã submit.

5. **Tab "Lịch sử"** — Hiển thị toàn bộ past reports của user (không giới hạn ngày). Mỗi row: ngày + status badge + hours + số tasks. Click expand → show `DailyReportView` đầy đủ (tasks, links, hours). "Không nộp" ngày vẫn không xuất hiện (chỉ show ngày có report).

6. **Tab "Team"** — Di chuyển toàn bộ nội dung Team Reports panel hiện tại (date navigation, search, filter, member list) vào tab này. Behavior không thay đổi.

7. **Form compact — output type + link cùng hàng** — Trong `TaskRow`, field "Loại output" và "Output link" được render trên cùng 1 hàng (`flex gap-2`): `[Select loại ▾][Input output link]`. Label "Mô tả task" vẫn ở hàng riêng phía trên.

8. **Dynamic label cho output field** — Khi `output_type === 'other'`, label field output đổi thành **"Output / Ghi chú"**. Với các type khác: **"Output link"**. Label vẫn có suffix `(optional)`.

9. **Compact hours display trong read-only** — Trong `DailyReportView`, section "Số giờ làm việc" với `text-2xl font-bold` đổi thành inline compact: `<span class="font-semibold">Xh</span>` tích hợp vào header area, không chiếm nguyên 1 section riêng.

10. **Không thay đổi DB** — Story này là pure FE. Không có migration mới.

---

## Tasks / Subtasks

### Service & Hook (History)

- [x] Task 1: Thêm `getAllReports` vào `daily-report.service.ts`
  - [x] Query `daily_reports` WHERE `tenant_id + user_id`, ORDER BY `report_date DESC`
  - [x] Không giới hạn date range — lấy toàn bộ history
  - [x] Đặt sau `getTeamReportsForDate` — không xóa/sửa gì đã có

- [x] Task 2: Tạo `src/features/daily-report/hooks/use-all-reports.ts`
  - [x] `useAllReports(tenantId, userId)` — `useQuery` gọi `getAllReports`
  - [x] `queryKey: [QUERY_KEYS.dailyReports, tenantId, { userId, type: 'history' }]`
  - [x] `enabled: !!tenantId && !!userId`
  - [x] `staleTime: 60_000` — history ít thay đổi

### Streak Logic (pure function)

- [x] Task 3: Thêm `computeStreak` vào `daily-report.schema.ts`
  - [x] `computeStreak(reportDates: string[], today: string): number`
  - [x] Input: mảng `report_date` strings (ISO `yyyy-MM-dd`), `today` string
  - [x] Logic: đếm ngày liên tiếp từ today trở về (today → today-1 → today-2 ...) có trong reportDates
  - [x] Return 0 nếu hôm nay chưa có report
  - [x] Unit tests bắt buộc (xem phần Tests)

### New Components

- [x] Task 4: Tạo `src/features/daily-report/components/ReportHistoryList.tsx`
  - [x] Props: `{ reports: DailyReport[], timezone: string }`
  - [x] Render mỗi report là 1 `Collapsible` row (dùng Radix Collapsible đã install)
  - [x] Row collapsed: ngày (`dd/MM/yyyy`) + `ReportStatusBadge` + `Xh` + `N tasks`
  - [x] Row expanded: render `DailyReportView` với report data
  - [x] Empty state: "Chưa có report nào. Hãy nộp report đầu tiên của bạn!"
  - [x] Loading skeleton: 3 rows Skeleton khi đang fetch

### Route Restructure

- [x] Task 5: Cập nhật `src/routes/_app/daily-report.tsx`
  - [x] Import `Tabs, TabsContent, TabsList, TabsTrigger` từ `@/components/ui/tabs`
  - [x] Import `useAllReports` từ `@/features/daily-report/hooks/use-all-reports`
  - [x] Import `ReportHistoryList` từ `@/features/daily-report/components/ReportHistoryList`
  - [x] Wrap toàn bộ content (sau header) trong `<Tabs defaultValue="today">`
  - [x] `TabsList`: "Hôm nay" + "Lịch sử" (+ "Team" nếu `isManager`)
  - [x] `TabsContent value="today"`: My report card (giữ nguyên)
  - [x] `TabsContent value="history"`: `ReportHistoryList`
  - [x] `TabsContent value="team"` (isManager only): Team Reports card (giữ nguyên)
  - [x] Streak badge: compute từ `useAllReports` data, hiện trên tab trigger "Lịch sử"
  - [x] Team badge: compute missing count từ `activeMembers.length - teamReports.length`, hiện trên tab trigger "Team"
  - [x] Query `useAllReports` chỉ fetch khi tab "Lịch sử" được trigger (dùng `enabled` flag + useState `historyTabActivated`)

### Form Polish (TaskRow)

- [x] Task 6: Cập nhật `TaskRow` trong `DailyReportForm.tsx`
  - [x] Output type + output link: đưa vào `<div className='flex gap-2'>` cùng hàng
  - [x] Output type Select: `<div className='w-[160px] shrink-0'>` (fixed width)
  - [x] Output link Input: `<div className='flex-1'>` (fill remaining space)
  - [x] Labels: xóa FormLabel của từng field khi trong flex row — dùng 1 label chung hoặc placeholder làm guide
  - [x] Dynamic label: khi `outputType === 'other'` → "Output / Ghi chú (optional)", otherwise "Output link (optional)"
  - [x] Giữ nguyên `FormMessage` cho validation errors

### DailyReportView Polish

- [x] Task 7: Cập nhật `DailyReportView.tsx`
  - [x] Compact hours: xóa section riêng (`<div>` với `text-xs text-muted-foreground uppercase` + `text-2xl font-bold`)
  - [x] Tích hợp hours vào header row: cạnh submitted_at timestamp → `· Xh`
  - [x] Format: `"Đã nộp · Xh"` (trong p) + submitted_at ở dòng riêng bên dưới
  - [x] Xóa 1 `<Separator />` (hiện có 2 — chỉ giữ 1 trước tasks list)

### Tests

- [x] Task 8: Tests cho `computeStreak`
  - [x] Streak = 0 khi array rỗng
  - [x] Streak = 1 khi chỉ có hôm nay
  - [x] Streak = 3 khi có 3 ngày liên tiếp (today, today-1, today-2)
  - [x] Streak = 1 khi có hôm nay nhưng hôm qua không có (bị đứt)
  - [x] Streak = 0 khi hôm nay chưa nộp (chỉ có các ngày trước)
  - [x] Boundary: today-1 nhưng không có today → streak = 0

---

## Dev Notes

### Tổng Quan

Story 4.4 là **pure FE restructure** — không có DB migration. Tất cả logic mới là:
1. Layout: wrap content trong Tabs component
2. History: query thêm `getAllReports`, compute streak, render list
3. Form polish: CSS flex trong TaskRow, dynamic label
4. View polish: compact hours display

### Tabs Component — Đã Có Sẵn

`src/components/ui/tabs.tsx` đã install. Dùng trực tiếp:

```typescript
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

<Tabs defaultValue="today">
  <TabsList>
    <TabsTrigger value="today">Hôm nay</TabsTrigger>
    <TabsTrigger value="history">
      Lịch sử {streak > 0 && <span className="ml-1 text-orange-500">🔥{streak}</span>}
    </TabsTrigger>
    {isManager && (
      <TabsTrigger value="team">
        Team {missingCount > 0 && (
          <span className="ml-1 rounded-full bg-destructive text-destructive-foreground text-xs px-1.5">
            {missingCount}
          </span>
        )}
      </TabsTrigger>
    )}
  </TabsList>

  <TabsContent value="today">
    {/* My report card — giữ nguyên */}
  </TabsContent>

  <TabsContent value="history">
    <ReportHistoryList reports={allReports} timezone={timezone} />
  </TabsContent>

  {isManager && (
    <TabsContent value="team">
      {/* Team Reports card — giữ nguyên */}
    </TabsContent>
  )}
</Tabs>
```

### Lazy Load History Tab

History query không cần chạy ngay khi load page. Chỉ fetch khi user click tab "Lịch sử":

```typescript
const [historyEnabled, setHistoryEnabled] = useState(false)

const { data: allReports = [], isLoading: isHistoryLoading } = useAllReports(
  historyEnabled ? activeTenantId : null,
  historyEnabled ? user?.id ?? null : null,
)

// Trong TabsTrigger onValueChange:
<Tabs onValueChange={(val) => { if (val === 'history') setHistoryEnabled(true) }}>
```

Pattern này tránh fetch không cần thiết — user có thể chỉ dùng tab "Hôm nay" mỗi ngày.

### getAllReports — Service Function

```typescript
// Thêm vào DailyReportService (sau getTeamReportsForDate)
getAllReports: async (tenantId: string, userId: string): Promise<DailyReport[]> => {
  const { data, error } = await supabase
    .from('daily_reports')
    .select('id, tenant_id, user_id, report_date, tasks, hours_logged, is_late, submitted_at, created_at')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .order('report_date', { ascending: false })
  if (error) throw error
  return (data ?? []) as DailyReport[]
}
```

RLS đã có: member chỉ thấy `user_id = auth.uid()` → tự nhiên chỉ thấy report của mình.

### computeStreak — Pure Function

```typescript
// Thêm vào daily-report.schema.ts (sau hasDiscrepancy)
export function computeStreak(reportDates: string[], today: string): number {
  const dateSet = new Set(reportDates)
  if (!dateSet.has(today)) return 0

  let streak = 0
  let current = today
  while (dateSet.has(current)) {
    streak++
    // Lùi về ngày hôm trước
    const d = new Date(current)
    d.setDate(d.getDate() - 1)
    current = d.toISOString().slice(0, 10)
  }
  return streak
}
```

Lưu ý: `today` phải là `reportDate` (đã tính theo timezone của user), KHÔNG phải `new Date().toISOString()`.

### ReportHistoryList — Collapsible Pattern

Dùng `Collapsible` từ Radix UI (đã install tại `src/components/ui/collapsible.tsx`):

```typescript
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown } from 'lucide-react'

// Mỗi report row:
<Collapsible>
  <CollapsibleTrigger asChild>
    <div className="flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer rounded-lg">
      <span className="text-sm font-medium">{format(parseISO(report.report_date), 'EEE, dd/MM/yyyy')}</span>
      <div className="flex items-center gap-2">
        <ReportStatusBadge status={report.is_late ? 'late' : 'submitted'} />
        <span className="text-sm text-muted-foreground">{report.hours_logged}h</span>
        <span className="text-xs text-muted-foreground">
          {Array.isArray(report.tasks) ? report.tasks.length : 0} tasks
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [data-state=open]:rotate-180" />
      </div>
    </div>
  </CollapsibleTrigger>
  <CollapsibleContent className="px-3 pb-3">
    <DailyReportView report={report} timezone={timezone} />
  </CollapsibleContent>
</Collapsible>
```

`ReportStatusBadge` đã có từ Story 4.3 — reuse trực tiếp.

### TaskRow Compact Layout

```tsx
// TRƯỚC:
<FormItem><FormLabel>Loại output</FormLabel>...<Select .../></FormItem>
<FormItem><FormLabel>Output link (optional)</FormLabel>...<Input .../></FormItem>

// SAU:
<div className="space-y-1.5">
  <FormLabel>
    {outputType === 'other' ? 'Output / Ghi chú' : 'Output link'}
    {' '}<span className="text-muted-foreground font-normal">(optional)</span>
  </FormLabel>
  <div className="flex gap-2">
    <FormField name={`tasks.${index}.output_type`} render={...}>
      <div className="w-[150px] shrink-0">
        <Select .../>
      </div>
    </FormField>
    <FormField name={`tasks.${index}.output_link`} render={...}>
      <div className="flex-1">
        <Input placeholder={OUTPUT_TYPE_PLACEHOLDERS[outputType]} .../>
      </div>
    </FormField>
  </div>
  {/* FormMessage cho cả 2 fields */}
</div>
```

**Note:** Khi dùng `flex` layout, `FormField` wrapping vẫn cần giữ nhưng `FormItem`/`FormLabel` riêng có thể bỏ. Validation errors (`FormMessage`) vẫn phải hiển thị — test kỹ.

### DailyReportView Compact Hours

```tsx
// TRƯỚC: section riêng
<div>
  <p className='text-xs text-muted-foreground uppercase tracking-wider mb-1'>Số giờ làm việc</p>
  <p className='text-2xl font-bold'>{report.hours_logged}h</p>
</div>
<Separator />

// SAU: tích hợp vào header (cạnh submitted_at)
<div className='flex items-center gap-3'>
  <CheckCircle2 className='h-5 w-5 text-green-500 shrink-0' />
  <div className='flex-1'>
    <p className='text-sm font-medium'>
      Đã nộp · <span className="font-bold">{report.hours_logged}h</span>
    </p>
    <p className='text-xs text-muted-foreground flex items-center gap-1 mt-0.5'>
      <Clock className='h-3 w-3' />
      {submittedAtLocal}
    </p>
  </div>
  {report.is_late && <Badge variant='destructive'>Nộp muộn</Badge>}
</div>
```

Giữ lại 1 `<Separator />` (trước tasks list). Xóa Separator trước hours section.

### Missing Count Cho Team Badge

```typescript
// Trong DailyReportPage — computed từ data đã có:
const missingCount = useMemo(() => {
  if (!isManager) return 0
  const submittedUserIds = new Set(teamReports.map(r => r.user_id))
  return activeMembers.filter(m => !submittedUserIds.has(m.user_id)).length
}, [isManager, teamReports, activeMembers])
```

Dùng data từ `useTeamReports` và `useActiveMembers` — không query thêm.

### File Structure

```
TẠO MỚI:
  src/features/daily-report/hooks/use-all-reports.ts
  src/features/daily-report/components/ReportHistoryList.tsx

MODIFY:
  src/routes/_app/daily-report.tsx         ← Tabs restructure
  src/features/daily-report/services/daily-report.service.ts  ← getAllReports
  src/features/daily-report/schemas/daily-report.schema.ts    ← computeStreak
  src/features/daily-report/components/DailyReportForm.tsx    ← TaskRow compact
  src/features/daily-report/components/DailyReportView.tsx    ← compact hours

KHÔNG THAY ĐỔI:
  Tất cả migration files
  src/features/daily-report/components/TeamReportList.tsx   (giữ nguyên logic)
  src/features/daily-report/components/ReportStatusBadge.tsx (reuse)
```

### Không Làm Trong Story 4.4

- ❌ Per-task hours field → Story 4.5
- ❌ Edit report → Story 4.6
- ❌ Infinite scroll / pagination cho history → không cần (list compact)
- ❌ Filter/search trong history → không cần (chỉ member xem report của mình)
- ❌ Export history → Epic 5

---

## Checklist Trước Khi Done

- [ ] `npm run lint` — 0 errors
- [ ] `npm run test` — Vitest pass (bao gồm tests mới cho `computeStreak`)
- [ ] `npx supabase test db` — pgTAP pass (verify không regression, không migration mới)
- [ ] Manual test (Member role):
  - [ ] Tab "Hôm nay": form hiện nếu chưa submit, view nếu đã submit
  - [ ] Tab "Lịch sử": load khi click (lazy), hiển thị danh sách reports, collapse/expand
  - [ ] Streak badge đúng (so sánh với ngày thực tế)
  - [ ] Tab "Team" KHÔNG hiện với member role
- [ ] Manual test (Manager/Owner role):
  - [ ] 3 tabs hiện
  - [ ] Tab "Team": đầy đủ date navigation, search, filter (behavior không đổi)
  - [ ] Badge số chưa nộp đúng
- [ ] Manual test form:
  - [ ] Output type + link cùng 1 hàng, responsive
  - [ ] Label đổi thành "Output / Ghi chú" khi chọn "Other"
  - [ ] Validation error vẫn hiện đúng vị trí
- [ ] Manual test DailyReportView:
  - [ ] Hours tích hợp vào header, không có section riêng
  - [ ] Output links vẫn clickable (không regression)

---

## Dev Agent Record

### Implementation Notes

**Approach:**
- Pure FE refactor — không có migration, không thay đổi DB schema.
- `computeStreak` dùng local date arithmetic (parse year/month/day từ string, dùng `new Date(y, m, d)` constructor thay vì ISO string + `toISOString()`) để tránh UTC timezone offset bug.
- History tab dùng lazy load pattern: `historyEnabled` state chỉ set true khi user click tab "Lịch sử" lần đầu, tránh fetch thừa.
- `missingCount` computed từ data đã có (`teamReports` + `activeMembers`), không query thêm.

**Debug log:**
- `computeStreak` lần đầu dùng `new Date(dateStr + 'T00:00:00').toISOString().slice(0, 10)` → UTC offset bug (UTC+7 sẽ shift -1 ngày). Fix: parse date components manually, dùng `new Date(year, month-1, day)` constructor.

### Completion Notes

- ✅ Task 1: `getAllReports` service function — query history không giới hạn date range
- ✅ Task 2: `useAllReports` hook với lazy enable, staleTime 60s
- ✅ Task 3: `computeStreak` pure function — timezone-safe date arithmetic
- ✅ Task 4: `ReportHistoryList` component — Collapsible rows, loading skeleton, empty state
- ✅ Task 5: Route restructure — 2 tabs (member) / 3 tabs (manager), lazy history, streak badge, missing badge
- ✅ Task 6: `TaskRow` compact — output type + link cùng hàng, dynamic label, validation errors giữ nguyên
- ✅ Task 7: `DailyReportView` compact hours — tích hợp vào header, xóa section riêng + 1 Separator
- ✅ Task 8: 8 unit tests cho `computeStreak` — tất cả pass (96 total tests pass)
- ✅ `npm run lint` — 0 errors
- ✅ `npm run test` — 96/96 pass
- ✅ `npx supabase test db` — 56 pgTAP tests pass

## File List

**Tạo mới:**
- `src/features/daily-report/hooks/use-all-reports.ts`
- `src/features/daily-report/components/ReportHistoryList.tsx`

**Sửa đổi:**
- `src/features/daily-report/services/daily-report.service.ts` — thêm `getAllReports`
- `src/features/daily-report/schemas/daily-report.schema.ts` — thêm `computeStreak`
- `src/features/daily-report/components/DailyReportForm.tsx` — TaskRow compact layout
- `src/features/daily-report/components/DailyReportView.tsx` — compact hours display
- `src/routes/_app/daily-report.tsx` — Tabs restructure
- `src/features/daily-report/__tests__/daily-report.test.ts` — thêm computeStreak tests

## Change Log

- 2026-03-24: Story 4.4 created — UX Restructure (Tabs + History + Form Polish). Context từ Epic 4 retro decisions, source code review daily-report.tsx, DailyReportForm.tsx, DailyReportView.tsx.
- 2026-03-24: Story 4.4 implemented — All 8 tasks complete. Pure FE refactor: Tabs layout, lazy history tab with streak badge, form compact (output type+link same row, dynamic label), DailyReportView compact hours. 96 tests pass, 0 lint errors, pgTAP pass.
