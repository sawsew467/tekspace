# Story 9-5: Fix Page Title "Team Schedule"

**Story ID:** 9.5
**Story Key:** 9-5-page-title-team-schedule
**Epic:** 9 — Product Quality & Feature Completion
**Wave:** Wave 1 (song song với 9-1 và 9-4 — không conflict file)
**Status:** done
**Created:** 2026-03-26

---

## User Story

> Là một người dùng TekSpace, tôi muốn tiêu đề trang khớp với nhãn sidebar, để browser tab và navigation nhất quán với nhau.

---

## Acceptance Criteria

**AC1 — Heading trong trang không còn "Team Dashboard":**
Khi user đang ở trang `/team-schedule`
Thì h1 hiển thị **"Team Schedule"** — không còn text "Team Dashboard" ở bất kỳ đâu trên trang này.

**AC2 — Browser tab title đúng:**
Khi user navigate đến `/team-schedule`
Thì browser tab hiển thị **"Team Schedule — TekSpace"** (dùng `—`, format chuẩn toàn codebase).

> **⚠️ Lưu ý format:** Epics spec ghi `"Team Schedule | TekSpace"` (dùng `|`) nhưng đây là lỗi nhỏ trong spec. Toàn bộ codebase dùng `—` (em dash), ví dụ: `'Dashboard — TekSpace'`, `'Daily Report — TekSpace'`. Route file đã đúng format này rồi — **không sửa route file**.

**AC3 — Không regression:**
Sidebar vẫn hiển thị "Team Schedule" (đã đúng).
Week navigation, timezone selector, schedule grid, online members list — tất cả hoạt động bình thường.
TypeScript và ESLint không có lỗi mới.

---

## 🔍 Phân tích thực tế codebase (BẮT BUỘC đọc trước khi làm)

### Trạng thái hiện tại — Đã đúng

| File | Trạng thái | Ghi chú |
|------|-----------|---------|
| `src/routes/_app/team-schedule.tsx` | ✅ Đã đúng | `title: 'Team Schedule — TekSpace'` — **KHÔNG SỬA** |
| `src/components/layout/data/sidebar-data.ts:41` | ✅ Đã đúng | `title: 'Team Schedule'` |
| `src/routes/__root.tsx` | ✅ Đã đúng | `<HeadContent />` mount, fallback `'TekSpace'` |

### Cần sửa — CHỈ 1 dòng

| File | Dòng | Hiện tại | Cần sửa thành |
|------|------|----------|---------------|
| `src/features/dashboard/components/TeamDashboard.tsx` | 76 | `<h1 ...>Team Dashboard</h1>` | `<h1 ...>Team Schedule</h1>` |

### Cần cập nhật (comment code — không ảnh hưởng runtime)

| File | Dòng | Hiện tại | Cần sửa |
|------|------|----------|---------|
| `src/lib/routes.ts` | 8 | `// Team Dashboard (overview of all members)` | `// Team Schedule (overview of all members)` |

---

## Tasks / Subtasks

- [x] **T1 — Sửa h1 heading trong TeamDashboard component**
  - [x] T1.1 Mở `src/features/dashboard/components/TeamDashboard.tsx`
  - [x] T1.2 Tìm dòng 76: `<h1 className="text-xl font-semibold shrink-0">Team Dashboard</h1>`
  - [x] T1.3 Đổi text thành `Team Schedule`

- [x] **T2 — Cập nhật comment trong routes.ts**
  - [x] T2.1 Mở `src/lib/routes.ts`
  - [x] T2.2 Tìm dòng có comment `// Team Dashboard (overview of all members)`
  - [x] T2.3 Đổi thành `// Team Schedule (overview of all members)`

- [x] **T3 — Xác nhận browser tab (kiểm tra, không sửa)**
  - [x] T3.1 Verify `src/routes/_app/team-schedule.tsx` đã có `'Team Schedule — TekSpace'` — không sửa gì thêm

- [x] **T4 — TypeScript validation**
  - [x] T4.1 Chạy `npx tsc --noEmit` — không lỗi mới

---

## Phạm vi rõ ràng — KHÔNG làm ngoài đây

- ✅ Chỉ đổi text "Team Dashboard" → "Team Schedule" trong `h1` của component
- ✅ Cập nhật comment code trong `routes.ts`
- ❌ **KHÔNG** sửa browser tab title (đã đúng rồi)
- ❌ **KHÔNG** đổi separator `—` thành `|` trong route head
- ❌ **KHÔNG** rename component class `TeamDashboard` hay file `TeamDashboard.tsx` (refactoring ngoài scope)
- ❌ **KHÔNG** sửa các file khác (sidebar, query-keys, routeTree.gen.ts)
- ❌ **KHÔNG** thêm i18n hay translation
- ❌ **KHÔNG** sửa gì liên quan đến Wave 2 (9-2, 9-3)

---

## Dev Notes

### Pattern browser tab title trong dự án
TanStack Router dùng `head()` trong route definition + `<HeadContent />` trong `__root.tsx`:

```tsx
// Pattern chuẩn (đã áp dụng từ story 8-2)
export const Route = createFileRoute('/_app/team-schedule')({
  head: () => ({
    meta: [{ title: 'Team Schedule — TekSpace' }],  // ← đã đúng
  }),
  component: TeamDashboard,
})
```

`<HeadContent />` đã được mount trong `__root.tsx` từ story 8-2 — không cần làm gì thêm.

### Tại sao component vẫn có "Team Dashboard"
Route `/team-schedule` (URL sau story 8-6 url-restructure) mount component `TeamDashboard`. Tên component không đổi (tránh refactoring lớn) nhưng **text hiển thị trong h1** vẫn là "Team Dashboard" chưa được cập nhật. Story 8-6 chỉ đổi URL path và sidebar label, không sửa heading text trong component.

### Story 8-15 compatibility
Story 8-15 (browser-notification-badge — done) thêm `(N)` prefix vào tab title dựa trên `document.title`. Với fix này, tab title sẽ là `(N) Team Schedule — TekSpace` khi có unread notifications — đúng như mong đợi.

---

## Estimated Effort

**Cực thấp** — 1 dòng code thực sự thay đổi. Phù hợp chạy song song Wave 1 với 9-1 và 9-4.

---

## Change Log

| Date | Change |
|------|--------|
| 2026-03-26 | Story created — ready-for-dev |
| 2026-03-26 | Implemented — đổi h1 "Team Dashboard" → "Team Schedule" trong TeamDashboard.tsx; cập nhật comment routes.ts |

---

## Dev Agent Record

### Implementation Plan
- T1: Đổi text h1 từ "Team Dashboard" → "Team Schedule" tại `TeamDashboard.tsx:76`
- T2: Cập nhật comment `// Team Dashboard` → `// Team Schedule` tại `routes.ts:8`
- T3: Verify route file đã đúng (không sửa)
- T4: Chạy `npx tsc --noEmit` — pass, không có lỗi

### Completion Notes
- ✅ h1 heading tại `/team-schedule` đã hiển thị "Team Schedule" (không còn "Team Dashboard")
- ✅ Browser tab title `'Team Schedule — TekSpace'` đã đúng từ trước — không cần sửa route file
- ✅ Comment trong `routes.ts` đã được cập nhật cho nhất quán
- ✅ TypeScript pass — không có lỗi mới
- ✅ Chỉ đổi 1 text string runtime + 1 comment — zero risk regression

---

## File List

- `src/features/dashboard/components/TeamDashboard.tsx` — modified (h1 text: "Team Dashboard" → "Team Schedule")
- `src/lib/routes.ts` — modified (comment only: "Team Dashboard" → "Team Schedule")
