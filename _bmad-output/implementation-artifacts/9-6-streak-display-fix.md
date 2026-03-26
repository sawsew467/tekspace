# Story 9-6: Fix Streak Display — "Báo cáo liên tiếp"

**Story ID:** 9.6
**Story Key:** 9-6-streak-display-fix
**Epic:** 9 — Product Quality & Feature Completion
**Wave:** Wave 1 (bổ sung) — song song với 9-1/9-4/9-5 — **KHÔNG chạy song song với 9-2** (cùng touch `daily-report.schema.ts`)
**Status:** review
**Created:** 2026-03-26

---

## User Story

> Là một member của TekSpace, tôi muốn thấy số ngày nộp báo cáo liên tiếp chính xác trên My Dashboard, để tôi có thể theo dõi sự nhất quán trong việc báo cáo của mình.

---

## Acceptance Criteria

**AC1 — Báo cáo hôm nay:**
Khi member đã nộp báo cáo hôm nay
Thì stat card "Báo cáo liên tiếp" hiển thị số ngày liên tiếp đúng (≥ 1).

**AC2 — Hôm nay chưa nộp, nhưng streak vẫn còn:**
Khi member đã nộp báo cáo nhiều ngày liên tiếp nhưng hôm nay chưa nộp
Thì stat card hiển thị streak của ngày hôm qua (hoặc ngày làm việc gần nhất) — không reset về "—" chỉ vì chưa nộp hôm nay.

**AC3 — Không có streak:**
Khi member chưa nộp báo cáo ngày nào gần đây (ngày làm việc gần nhất cũng không nộp)
Thì stat card hiển thị "—" (đúng — zero streak).

**AC4 — Report có `hours_logged = null` vẫn tính:**
Khi member có báo cáo nhưng một số report có `hours_logged = null`
Thì những `report_date` đó vẫn được tính vào streak (không bị filter out).

---

## 🔍 Root Cause Analysis (BẮT BUỘC đọc trước khi code)

### Bug 1 — `isFinite` filter drops valid report dates (CONFIRMED)

**File:** `src/features/analytics/services/analytics.service.ts`, dòng 78-82

```ts
// HIỆN TẠI — BUG:
return (data ?? []).flatMap(r => {
  const h = Number(r.hours_logged)
  if (!isFinite(h)) return []  // ← DROP reports với hours_logged = null
  return [{ report_date: r.report_date, hours_logged: h }]
})
```

`useSelfStreak` gọi `getMemberReportsForPeriod` rồi chỉ lấy `r.report_date`:
```ts
const reports = await AnalyticsService.getMemberReportsForPeriod(...)
const reportDates = reports.map(r => r.report_date)
```

**Consequence:** Nếu report có `hours_logged = null` (ví dụ: reports submit trước khi Story 4.5 per-task hours được implement), `report_date` đó bị drop → streak bị thiếu ngày → hiển thị sai.

### Bug 2 — Streak reset về 0 khi hôm nay chưa nộp (UX Issue)

**File:** `src/features/daily-report/schemas/daily-report.schema.ts`, dòng 180

```ts
// HIỆN TẠI — UX BUG:
if (!dateSet.has(today)) return 0  // ← Hôm nay 9am chưa nộp → streak = 0 → hiển thị "—"
```

**Consequence:** Member có streak 10 ngày, sáng T3 mở dashboard trước khi nộp báo cáo → thấy "—" thay vì "🔥 10 ngày". Gây nhầm lẫn và mất động lực.

**Correct behavior:** Nếu hôm nay chưa nộp, tìm ngày gần nhất còn trong streak window (bỏ qua weekends liên tiếp không nộp) và hiển thị streak từ ngày đó.

---

## 🔧 Fix Approach

### Fix 1 — `use-self-streak.ts`: Tách query riêng, không dùng `getMemberReportsForPeriod`

**Lý do không sửa `getMemberReportsForPeriod`:** Method đó có consumers khác cần `hours_logged` (sparkline chart, analytics). Thay đổi behavior sẽ break những consumers đó.

**Cách fix:** Trong `useSelfStreak.queryFn`, dùng trực tiếp Supabase client chỉ select `report_date` — không cần `hours_logged`, không filter `isFinite`.

```ts
// THAY THẾ bằng:
import { supabase } from '@/lib/supabase-browser'  // thêm import này

// Trong queryFn:
const { data, error } = await supabase
  .from('daily_reports')
  .select('report_date')
  .eq('tenant_id', activeTenantId!)
  .eq('user_id', user!.id)
  .gte('report_date', startDate)
  .lte('report_date', today)
  .order('report_date', { ascending: true })
  .limit(1000)
if (error) throw error
const reportDates = (data ?? []).map(r => r.report_date)
```

### Fix 2 — `computeStreak`: Thêm "yesterday fallback" logic

**Quy tắc mới:** Nếu `today` chưa nộp, không return 0 ngay. Thay vào đó:
1. Bỏ qua weekends không nộp (T7/CN liên tiếp) ngược về trước
2. Nếu gặp ngày thường không nộp → return 0 (streak thực sự đứt)
3. Nếu gặp ngày đã nộp → dùng ngày đó làm `startDay` tính streak

**Edge case cần handle:**
- T2 sáng chưa nộp: skip CN (weekend không nộp) → skip T7 (weekend không nộp) → gặp T6 đã nộp → tính streak từ T6 ✅
- T3 sáng chưa nộp: T2 là ngày thường không nộp → return 0 ✅
- T3 sáng chưa nộp: T2 cũng có nộp → tính streak từ T2 ✅

**Signature thay đổi:** `computeStreak(reportDates, today)` — KHÔNG thay đổi signature. Chỉ thay đổi internal logic.

**⚠️ Existing tests sẽ fail** — xem phần Tests bên dưới.

```ts
export function computeStreak(reportDates: string[], today: string): number {
  const dateSet = new Set(reportDates)

  // Tìm startDay: nếu today chưa nộp, bỏ qua weekends không nộp để tìm ngày gần nhất
  let startDay = today
  if (!dateSet.has(today)) {
    let candidate: string | null = prevDateStr(today)
    let skipped = 0
    // Skip tối đa 3 ngày (T7 + CN + buffer) — đủ để xử lý weekend bridge
    while (candidate && isWeekend(candidate) && !dateSet.has(candidate) && skipped < 3) {
      candidate = prevDateStr(candidate)
      skipped++
    }
    // candidate bây giờ là ngày đầu tiên KHÔNG phải weekend-không-nộp:
    // - Nếu là ngày thường (T2-T6) không nộp → streak = 0
    // - Nếu là ngày đã nộp (bất kể T2-CN) → dùng làm startDay
    if (!candidate || !dateSet.has(candidate)) return 0
    startDay = candidate
  }

  // Tính streak từ startDay (logic giữ nguyên)
  let streak = 0
  let current: string | null = startDay
  const maxIterations = dateSet.size * 2 + 14

  for (let i = 0; i < maxIterations; i++) {
    if (!current) break
    if (dateSet.has(current)) {
      streak++
    } else if (isWeekend(current)) {
      // T7/CN không nộp → bỏ qua
    } else {
      break
    }
    current = prevDateStr(current)
  }

  return streak
}
```

---

## 📋 Tasks / Subtasks

### T1 — Fix `use-self-streak.ts`: Dùng direct Supabase query

- [x] T1.1 Mở `src/features/dashboard/hooks/use-self-streak.ts`
- [x] T1.2 Thêm import `supabase` từ `'@/lib/supabase-browser'`
- [x] T1.3 Xóa import `AnalyticsService` (không dùng nữa)
- [x] T1.4 Thay `AnalyticsService.getMemberReportsForPeriod(...)` bằng direct Supabase query select `report_date` only (không `hours_logged`)
- [x] T1.5 Xóa `.map(r => r.report_date)` (đã fetch trực tiếp `report_date`)
- [x] T1.6 Giữ nguyên: `computeStreak(reportDates, today)` — không đổi call

### T2 — Fix `daily-report.schema.ts`: Sửa `computeStreak` logic

- [x] T2.1 Mở `src/features/daily-report/schemas/daily-report.schema.ts`
- [x] T2.2 Sửa `computeStreak` theo logic "yesterday fallback + weekend skip" như mô tả ở Fix 2
- [x] T2.3 Giữ nguyên `prevDateStr` và `isWeekend` helper functions (chúng đúng rồi)
- [x] T2.4 Không thay đổi function signature — vẫn `computeStreak(reportDates: string[], today: string): number`

### T3 — Update tests trong `daily-report.test.ts`

- [x] T3.1 Mở `src/features/daily-report/__tests__/daily-report.test.ts`
- [x] T3.2 Update tests `computeStreak` bị broken bởi new behavior (xem chi tiết bên dưới)
- [x] T3.3 Thêm tests mới cho yesterday fallback và weekend-skip scenarios
- [x] T3.4 Chạy `npx vitest run src/features/daily-report/__tests__/daily-report.test.ts` — tất cả PASS

### T4 — TypeScript validation

- [x] T4.1 Chạy `npx tsc --noEmit` — không lỗi mới

---

## ⚡ Tests Update Guide (Chi tiết)

### Tests cần update (behavior đã thay đổi)

```ts
// CŨ — expect 0 khi hôm nay chưa nộp nhưng hôm qua (T2) đã nộp:
it('returns 0 khi hôm nay chưa nộp (chỉ có các ngày trước)', () => {
  const dates = ['2026-03-23', '2026-03-22', '2026-03-21']
  expect(computeStreak(dates, today)).toBe(0)  // today = T3 2026-03-24
})
// MỚI: T3 chưa nộp → check T2 (2026-03-23, ngày thường) → có nộp → streak = 3
// → UPDATE expect toBe(3)

it('boundary: today-1 nhưng không có today → streak = 0', () => {
  const dates = ['2026-03-23']
  expect(computeStreak(dates, today)).toBe(0)  // today = T3 2026-03-24
})
// MỚI: T3 chưa nộp → check T2 (2026-03-23) → có nộp → streak = 1
// → UPDATE expect toBe(1)

it('hôm nay chưa nộp dù T7/CN trước đó đã nộp → streak = 0', () => {
  const monday = '2026-03-23'
  const dates = ['2026-03-22', '2026-03-21']  // CN + T7 nộp, T2 chưa nộp
  expect(computeStreak(dates, monday)).toBe(0)
})
// MỚI: T2 chưa nộp → check CN (2026-03-22, weekend) → đã nộp → startDay = CN
// → tính streak: CN(nộp) + T7(nộp) = 2
// → UPDATE expect toBe(2)
```

### Tests mới cần thêm

```ts
// Scenario: T2 chưa nộp, T7+CN không nộp, T6 đã nộp → streak hiện T6's streak
it('T2 chưa nộp, weekend không nộp, tính streak từ T6', () => {
  // today = '2026-03-23' (T2), chưa nộp
  // CN (22) không nộp, T7 (21) không nộp, T6 (20) đã nộp
  const monday = '2026-03-23'
  const dates = ['2026-03-20', '2026-03-19', '2026-03-18'] // T6, T5, T4
  expect(computeStreak(dates, monday)).toBe(3)
})

// Scenario: T3 chưa nộp, T2 là ngày thường không nộp → thực sự streak = 0
it('T3 chưa nộp, T2 ngày thường không nộp → streak = 0', () => {
  // today = '2026-03-24' (T3), T2 (23) không nộp → gap → return 0
  const dates = ['2026-03-22', '2026-03-21'] // CN, T7 có nộp nhưng không liên tiếp qua T2
  expect(computeStreak(dates, '2026-03-24')).toBe(0)
})

// Scenario: hôm nay chưa nộp, không có report nào trong 90 ngày → streak = 0
it('không có report nào gần đây → streak = 0', () => {
  expect(computeStreak([], '2026-03-24')).toBe(0)
})

// Scenario: Bug fix verification — report với null hours vẫn tính
// (Test này ở level hook, không phải schema — không cần viết unit test cho schema)
```

> **⚠️ Lưu ý về test update:** Khi update tests "cũ", đổi `expect(...).toBe(0)` thành `expect(...).toBe(X)` theo new behavior. **KHÔNG xóa test** — chỉ update giá trị expected và update description nếu cần.

---

## 🚫 Phạm vi rõ ràng — KHÔNG làm ngoài đây

- ✅ Fix `use-self-streak.ts` — direct Supabase query thay vì `getMemberReportsForPeriod`
- ✅ Fix `computeStreak` trong `daily-report.schema.ts` — yesterday fallback logic
- ✅ Update tests trong `daily-report.test.ts` — reflect new behavior
- ❌ **KHÔNG** sửa `getMemberReportsForPeriod` trong `analytics.service.ts` (method đó đúng cho use case hours aggregation)
- ❌ **KHÔNG** đổi signature `computeStreak(reportDates, today)` — giữ nguyên
- ❌ **KHÔNG** thêm migration DB — pure frontend fix
- ❌ **KHÔNG** sửa `SelfDashboard.tsx` — logic `streakLabel = streak > 0 ? '🔥 ${streak} ngày' : '—'` đúng rồi
- ❌ **KHÔNG** sửa các file Wave 2 (9-2, 9-3)
- ❌ **KHÔNG** refactor `AnalyticsService` hay thêm new methods

---

## 📝 Dev Notes

### Pattern: Direct Supabase query trong hooks

TekSpace cho phép query trực tiếp trong hooks khi cần flexibility không có trong service layer. Pattern đã có trong codebase (xem `SelfDashboard.tsx:226-234` — direct query `getUserProfile`). Import từ `'@/lib/supabase-browser'`.

### Tại sao `getMemberReportsForPeriod` không phù hợp cho streak

Method này được design để aggregate hours theo tuần (sparkline chart, analytics). Filter `isFinite(h)` là đúng cho use case đó (không muốn tính null hours vào sum). Nhưng `useSelfStreak` chỉ cần **sự tồn tại** của report date — không cần hours. Đây là design mismatch, không phải bug trong `getMemberReportsForPeriod`.

### Backward compatibility: `computeStreak` với existing tests

New behavior: nếu today chưa nộp, **không return 0 ngay** — tìm ngày gần nhất còn valid. Điều này thay đổi behavior cho trường hợp `today` chưa nộp nhưng `yesterday` (sau khi skip weekends) đã nộp. Tests cũ viết theo old behavior phải update.

### File conflict với 9-2

Story 9-2 (`daily-report-four-sections`) cũng sẽ touch `daily-report.schema.ts` và `daily-report.test.ts`:
- 9-2 sẽ ADD new schema (`taskItemInProgressSchema`, mở rộng `dailyReportFormSchema`)
- 9-6 sẽ MODIFY `computeStreak` function

Hai thay đổi này về nature là non-overlapping, nhưng **không được chạy agent song song**. 9-6 phải complete trước khi 9-2 bắt đầu (Wave 1 trước Wave 2).

### QUERY_KEYS.selfStreak

Key `'self-streak'` đã tồn tại trong `src/lib/query-keys.ts:17`. Giữ nguyên — không thêm key mới.

### Vitest test runner

```bash
# Chạy test cho file cụ thể
npx vitest run src/features/daily-report/__tests__/daily-report.test.ts

# Watch mode khi dev
npx vitest watch src/features/daily-report/__tests__/daily-report.test.ts
```

---

## 📊 Estimated Effort

**Thấp** — ~3 files, không migration, logic thay đổi nhỏ. Quan trọng nhất là test update cẩn thận.

---

## 📁 File List (dự kiến)

- `src/features/dashboard/hooks/use-self-streak.ts` — modified (direct Supabase query thay vì AnalyticsService)
- `src/features/daily-report/schemas/daily-report.schema.ts` — modified (computeStreak: yesterday fallback logic)
- `src/features/daily-report/__tests__/daily-report.test.ts` — modified (update affected tests + thêm new tests)

---

## Dev Agent Record

### Implementation Notes

**Bug 1 (AC4) — `use-self-streak.ts`:**
- Thay `AnalyticsService.getMemberReportsForPeriod` bằng direct Supabase query `.select('report_date')` không có `hours_logged`
- Root cause: `getMemberReportsForPeriod` filter `isFinite(hours_logged)` → drop reports có `hours_logged = null` → streak bị thiếu ngày
- Fix: chỉ cần `report_date` để tính streak, không cần `hours_logged`

**Bug 2 (AC2/AC3) — `computeStreak` in `daily-report.schema.ts`:**
- Thêm "yesterday fallback + weekend skip" logic: nếu hôm nay chưa nộp, tìm ngày gần nhất đã nộp (bỏ qua tối đa 3 ngày weekends không nộp)
- Edge case T2 sáng: skip CN + T7 (không nộp) → tìm T6 (đã nộp) → tính streak từ T6 ✅
- Edge case T3 sáng, T2 không nộp: T2 là ngày thường không nộp → streak = 0 ✅

**Tests — `daily-report.test.ts`:**
- Update 3 tests cũ reflect new behavior (không xóa, chỉ đổi expected + description)
- Thêm 3 tests mới: T2-skip-weekend, T3-weekday-gap, empty-array-fallback

**Kết quả:** 86 tests PASS (daily-report.test.ts), 313/313 tests PASS (full suite), TypeScript clean

---

## Change Log

| Date | Change |
|------|--------|
| 2026-03-26 | Story created — ready-for-dev |
| 2026-03-26 | Implementation complete — status: review |
