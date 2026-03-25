# Sprint Change Proposal — TekSpace
**Ngày:** 2026-03-25
**Người raise:** Thắng
**Scope:** Post-Epic 7 — Missing features & UI/UX improvements
**Change scope classification:** Moderate (cần tạo epic mới + backlog reorganization)

---

## Section 1: Issue Summary

Sau khi các epics 1–7 gần hoàn thành, một review thực tế của sản phẩm đã phát hiện:

1. **1 bug nghiêm trọng** ảnh hưởng core admin workflow (remove member / đổi role không hoạt động)
2. **Nhiều UX inconsistency** cross-cutting (layout, sidebar, page title, permission visibility)
3. **Một số tính năng còn thiếu** để app dùng được trong thực tế (user avatar, copy invite link, schedule UX, notification enhancements)
4. **1 vấn đề data integrity** ảnh hưởng tính chính xác khi review lương/performance (committed hours history)
5. **1 scope lớn** được đề xuất nhưng defer (i18n)

Tất cả issues được ghi nhận từ file `basic-review.md` (19 items).

---

## Section 2: Impact Analysis

### Epic Impact

| Epic | Ảnh hưởng |
|------|-----------|
| Epic 1 (Foundation) | Bug fix story cần thêm (1.6-BUG). Route `/account/security` đã có change password |
| Epic 2 (Schedule) | UX overhaul lớn: week picker + drag-to-create + URL rename |
| Epic 3 (Team Visibility) | URL rename + highlight current time slot |
| Epic 4 (Daily Report) | Không ảnh hưởng |
| Epic 5 (Analytics) | Committed hours history query update |
| Epic 6 (Notifications) | Browser notification + tab badge + in-app message review |
| Epic 7 (Incidents) | Không ảnh hưởng (đang in-progress) |
| **Epic Mới** | UX Polish Epic + cần tạo mới |

### Story Impact

**Stories cần tạo mới:**
- 1.6-BUG: Fix remove member & role change
- UX-1: Sidebar role-based visibility + remove "no permission" text
- UX-2: Layout đồng bộ với PageContainer (2 variants)
- UX-3: Page title browser tab fix
- UX-4: Sidebar collapse fix + notification badge
- UX-5: URL restructure (my-schedule, team-schedule, dashboard)
- UX-6: Copy invite link
- UX-7: Highlight current time slot ở team schedule
- UX-8: In-app notification message review
- UX-9: User avatar upload
- UX-10: Tenant avatar/logo
- UX-11: My Dashboard UI enhancement
- UX-12: My Analytics UI enhancement
- UX-13: Browser notification sound + tab badge
- UX-14: Infinite scroll / pagination cho data lists
- UX-15: Schedule week picker + drag-to-create slot
- DB-1: Committed hours history migration + analytics update

### Artifact Conflicts

| Artifact | Conflict | Cần update |
|----------|----------|------------|
| `epics.md` | URL cũ (`/schedule`, `/dashboard`, `/my-dashboard`) | Cập nhật URL mới |
| `prd.md` | committed_hours mô tả là 1 giá trị | Bổ sung history requirement |
| `architecture.md` | Schema `tenant_members` không có history | Thêm `committed_hours_history` table |
| `sprint-status.yaml` | Cần thêm Epic 8 (UX Polish) | Cập nhật sau khi approve |

### Technical Impact

- **Migration DB mới:** `committed_hours_history` table với RLS
- **Route restructure:** 3 routes đổi URL — cần update `ROUTES` constant, `sidebar-data.ts`, tất cả internal links
- **New component:** `PageContainer` wrapper (2 variants)
- **Drag-to-create:** Build time-grid từ đầu — effort cao nhất trong list

---

## Section 3: Recommended Approach

**Lựa chọn: Direct Adjustment (Option 1) — Tạo Epic 8: UX Polish & Feature Completeness**

**Lý do:**
- Không cần rollback bất kỳ epic nào đã done
- Không thay đổi MVP scope — tất cả đây là refinement và completeness
- Epic 7 đang chạy → không bị chặn
- Bug fix (1.6-BUG) cần handle ngay, độc lập với epic structure

**Sequencing đề xuất:**

```
[Ngay] Bug fix 1.6-BUG — independent, không cần đợi
[Sau Epic 7 done] Epic 8: UX Polish & Feature Completeness
  Phase 1 (Quick wins): UX-1, UX-2, UX-3, UX-4, UX-5, UX-6, UX-8
  Phase 2 (Medium): UX-7, UX-9, UX-10, UX-11, UX-12, UX-13, UX-14, DB-1
  Phase 3 (High effort): UX-15 (Schedule drag-to-create)
[Post-MVP] i18n
```

**Effort estimate:**
- Bug fix: thấp (1–2h investigate + fix)
- Phase 1: thấp-trung bình (1–2 ngày tổng)
- Phase 2: trung bình (3–4 ngày tổng)
- Phase 3: cao (1–2 ngày riêng cho drag-to-create)

**Risk:** Thấp — không có breaking changes với business logic. URL restructure (UX-5) cần cẩn thận về redirect.

---

## Section 4: Detailed Change Proposals

### 🔴 BUG — Phải fix ngay

#### [1.6-BUG] Fix: Remove member & nâng hạ quyền không hoạt động
- **Epic:** 1 (reopen để fix)
- **Vấn đề:** Edge Function `remove-member` lỗi; promote/demote role không apply
- **Điều tra:** Edge Function logs, RLS policy `tenant_members` (UPDATE), JWT refresh sau role change
- **AC:** Remove member thành công + member nhận toast; Promote/Demote apply ngay; Transfer ownership hoạt động; tất cả log actor + timestamp

---

### 🟡 UX POLISH

#### [UX-1] Role-based nav visibility + ẩn "no permission" UI
- **Files:** `sidebar-data.ts`, `nav-main.tsx`, `team/settings.tsx`
- **Thay đổi:**
  - Thêm `roles?: ('owner'|'manager'|'member')[]` vào `NavItem` type
  - `Lời mời` → roles: `['owner', 'manager']`
  - `Cài đặt nhóm` → roles: `['owner']`
  - Filter items trong NavMain theo `activeRole`
  - `team/settings.tsx`: redirect về `/dashboard` nếu `!canManageTenant` thay vì hiện text
- **Visibility matrix:**
  - Team Schedule, My Schedule, Analytics, Daily Report, Notifications, Incidents, Thành viên → tất cả roles
  - Lời mời → owner, manager
  - Cài đặt nhóm → owner only

#### [UX-2] Layout đồng bộ với PageContainer (2 variants)
- **File mới:** `src/components/layout/page-container.tsx`
- **Variants:**
  - `<PageContainer>` → `p-4 md:p-6 max-w-3xl mx-auto` (list/form pages)
  - `<PageContainer wide>` → `p-4 md:p-6 full-width` (grid/table/chart pages)
- **Apply:**
  - Default: notifications, incidents, team/invites, team/settings, account/*, my-dashboard
  - Wide: team-schedule, my-schedule, analytics, daily-report, team/members
- **Chuẩn hóa:** h1 `text-2xl font-semibold`, subtitle `text-sm text-muted-foreground mt-1`, padding `p-4/p-6` nhất quán

#### [UX-3] Fix page title không cập nhật trên browser tab
- **File:** `src/routes/__root.tsx`
- **Fix:** Thêm `<Meta />` component từ TanStack Router + default title `'TekSpace'` trong root `head()`
- **Cập nhật titles theo URL mới:** team-schedule → "Team Schedule — TekSpace"

#### [UX-4] Sidebar collapse: fix layout + notification badge
- **Files:** `app-sidebar.tsx`, sidebar collapse components
- **Fix:** Notification badge visible khi sidebar collapsed; layout không vỡ khi thu gọn

#### [UX-5] URL restructure
- **Đổi tên routes:**
  - `/schedule` → `/my-schedule`
  - `/dashboard` → `/team-schedule`
  - `/my-dashboard` → `/dashboard`
- **Update:** `ROUTES` constant, `sidebar-data.ts`, tất cả `<Link>` và `navigate()`, sidebar titles
- **Redirect:** Add redirects từ URL cũ → URL mới để tránh broken links

#### [UX-6] Copy invite link (bên cạnh nút Resend)
- **File:** `src/features/tenant/components/InviteListSection.tsx`
- **Thêm:** Nút copy icon cạnh "Gửi lại" → copy invite URL vào clipboard → toast "Đã copy link"
- **Chỉ cho:** pending invites (expired invite không có link hợp lệ để copy)

#### [UX-7] Highlight khung giờ hiện tại trong Team Schedule
- **File:** `src/features/dashboard/components/TeamScheduleHeatmap.tsx` hoặc schedule grid
- **Thêm:** Highlight column/row tương ứng với giờ hiện tại (theo team timezone) bằng border hoặc background nhẹ

#### [UX-8] Review ngữ nghĩa in-app notifications
- **File:** `src/features/notifications/components/NotificationItem.tsx` + Edge Function templates
- **Tiêu chí:** User đọc notification hiểu ngay không cần click vào; message tự đủ ngữ cảnh (ai, làm gì, khi nào)
- **Review tất cả 7 notification types:** schedule reminder, deadline missed, daily report reminder, schedule changed, member removed, invite sent, incident logged

---

### 🟠 NEW FEATURES

#### [UX-9] User avatar upload
- **Bảng DB:** `users` — thêm cột `avatar_url text`
- **Storage:** Supabase Storage bucket `avatars` (public)
- **UI:** Trang `/account/profile` — click avatar → upload file → crop → save → update `users.avatar_url`
- **Display:** Avatar hiện trong sidebar (nav-user), profile page, member list

#### [UX-10] Tenant avatar/logo
- **Bảng DB:** `tenants` — thêm cột `logo_url text`
- **Storage:** Supabase Storage bucket `tenant-logos` (public)
- **UI:** Trang `/team/settings` (Owner only) — upload logo → hiện trong sidebar team switcher thay cho icon mặc định

#### [UX-11] My Dashboard UI enhancement
- **File:** `src/features/dashboard/components/SelfDashboard.tsx`
- **Hiện tại:** 3 stat cards đơn giản (giờ báo cáo, giờ cam kết, tỷ lệ)
- **Thêm:** Sparkline chart 4 tuần gần nhất; streak counter (ngày báo cáo liên tiếp); quick action "Báo cáo hôm nay"

#### [UX-12] My Analytics UI enhancement
- **File:** `src/features/analytics/components/SelfAnalyticsHistory.tsx`
- **Hiện tại:** Bar chart hours/tuần
- **Thêm:** Toggle view tuần/tháng; summary card (tháng này: X giờ, commitment Y%); top weeks highlight

#### [UX-13] Browser notification + tab badge
- **Tính năng:**
  - Web Push Notification (Notification API) khi có in-app notification mới + user đang ở tab khác
  - Tab favicon badge (document.title prefix: "(3) TekSpace") khi có unread notifications
  - Yêu cầu permission từ user (opt-in)
- **Trigger:** Supabase Realtime notification insert → check `document.hidden` → push browser notification

#### [UX-14] Infinite scroll / pagination cho data lists
- **Scope:** Notifications list, Incidents list, Report history list
- **Approach:** TanStack Query `useInfiniteQuery` + IntersectionObserver trigger
- **Threshold:** Load thêm khi scroll đến 80% cuối list

#### [UX-15] Schedule: week picker + drag-to-create slot
**Phần 1 — Week Picker (effort thấp):**
- Wrap week range text trong `<Popover>` + `<Calendar>` (shadcn)
- Click ngày bất kỳ → snap về thứ Hai của tuần đó
- Highlight 7 ngày đang xem trong calendar

**Phần 2 — Drag-to-create (effort cao):**
- Thay `ScheduleGrid` card-list → time-grid visual (giờ × ngày)
- Drag trên grid → tạo slot với start/end từ vị trí kéo
- Real-time preview khi drag; overlap prevention; locked week → disabled
- Nút "+ Thêm ca làm việc" giữ nguyên làm fallback (mobile/accessibility)

---

### 🔵 DATA INTEGRITY

#### [DB-1] Committed hours history — migration + analytics update
**Migration mới:**
```sql
CREATE TABLE public.committed_hours_history (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  user_id          uuid NOT NULL REFERENCES auth.users(id),
  committed_hours  smallint NOT NULL,
  effective_from   date NOT NULL,
  effective_to     date,  -- NULL = đang áp dụng
  set_by           uuid REFERENCES auth.users(id),
  created_at       timestamptz DEFAULT now()
);
ALTER TABLE committed_hours_history ENABLE ROW LEVEL SECURITY;
-- Seed: chuyển committed_hours hiện tại → record đầu tiên với effective_from = tenant_members.created_at
```

**Logic thay đổi:**
- `SetCommittedHoursDialog`: thay vì chỉ UPDATE `tenant_members`, thêm: close record cũ (`effective_to = today`) + INSERT record mới
- `tenant_members.committed_hours` vẫn giữ (dùng cho current week lookup)

**Analytics queries:**
- Trend chart (multi-week): JOIN với `committed_hours_history` theo `effective_from ≤ week_start ≤ effective_to`
- Current week (My Dashboard, Team Overview): vẫn đọc `tenant_members.committed_hours`

---

### 🔐 SECURITY & RELIABILITY

#### [8-17] Route Protection — Role-based beforeLoad guards
- **Vấn đề:** Role check chỉ ở component-level → user có thể navigate trực tiếp bằng URL, thấy "no permission" text
- **Fix:**
  - `/team/settings`: thêm `beforeLoad` check `hasPermission(activeRole, 'manageTenant')` → redirect `/dashboard` nếu fail
  - `/team/invites`: thêm `beforeLoad` check `hasPermission(activeRole, 'manageMembers')` → redirect `/dashboard` nếu fail
  - Dùng `useTenantStore.getState()` (Zustand global, không phải hook) + `hasPermission()` (pure function)
  - Parent `/_app beforeLoad` đã init `tenantStore` trước → safe to read

#### [8-18] Auth Hardening
- **Fix 1: `getUser()` thay `getSession()` trong beforeLoad**
  - `getSession()` chỉ đọc cache local — không verify với Supabase server
  - `getUser()` gọi thẳng lên server → detect revoked tokens ngay
  - Apply: `_app/route.tsx` + `sign-in.tsx`
- **Fix 2: Redirect-back sau login**
  - Khi session expire → lưu `location.pathname` vào search param: `redirect({ to: ROUTES.signIn, search: { redirect: location.pathname } })`
  - Sau sign-in thành công → navigate về URL cũ thay vì `/dashboard`
  - Guard: chỉ accept redirect nội bộ (tránh open redirect attack)

#### [8-19] Error Pages — 404 + ErrorBoundary + URL Redirects
- **Vấn đề:** URL không tồn tại → màn hình trắng; component crash → app chết hoàn toàn
- **404 — `defaultNotFoundComponent` trong `createRouter`:**
  - "Trang không tồn tại" + nút "Về Dashboard"
- **ErrorBoundary — `defaultErrorComponent` trong `createRouter`:**
  - "Có lỗi xảy ra, vui lòng thử lại" + nút "Tải lại trang" (`window.location.reload()`)
  - Log error ra console (dev); Sentry post-MVP
- **URL redirects cũ (phối hợp 8-6):**
  - `/schedule` → `/my-schedule`
  - `/dashboard` (cũ) → `/team-schedule`
  - `/my-dashboard` → `/dashboard`

---

### 🚫 DEFERRED

#### i18n — Post-MVP
- Lý do: 100+ files hardcode tiếng Việt, không có library, effort 3–5 ngày zero business value ngay
- Điều kiện trigger: có khách hàng nước ngoài cụ thể hoặc quyết định expand thị trường

---

## Section 5: Implementation Handoff

### Change Scope: **Moderate**
Cần tạo epic mới + backlog reorganization. Dev team có thể implement sau khi Epic 7 done.

### Handoff Plan

| Người/Role | Việc cần làm |
|------------|-------------|
| **Dev Agent (ngay)** | Fix bug 1.6-BUG — không cần đợi gì |
| **SM / PO** | Tạo `Epic 8: UX Polish & Feature Completeness` trong `epics.md` và `sprint-status.yaml` |
| **SM** | Tạo story files cho Phase 1 trước (UX-1 → UX-8), sau đó Phase 2, rồi Phase 3 |
| **Architect** | Review migration `committed_hours_history` trước khi Dev implement DB-1 |
| **PO** | Update `prd.md` — bổ sung committed hours history requirement |

### Story Priority Order

```
[Wave 1 — 8 agents song song]
  1.  8-1   Bug fix remove member & role change       ← ready-for-dev
  2.  8-2   Page title fix
  3.  8-3   Copy invite link
  4.  8-4   Notification message review
  5.  8-5   Committed hours history migration         ← ready-for-dev
  6.  8-17  Route protection (role-based beforeLoad)
  7.  8-18  Auth hardening (getUser + redirect-back)
  8.  8-19  Error pages (404 + ErrorBoundary)

[Phase 2: Medium]
  9. DB-1  Committed hours history migration
  10. UX-7  Highlight current time slot
  11. UX-9  User avatar upload
  12. UX-14 Infinite scroll
  13. UX-11 My Dashboard UI
  14. UX-12 My Analytics UI
  15. UX-10 Tenant avatar/logo
  16. UX-13 Browser notification + tab badge

[Phase 3: High effort]
  17. UX-15 Schedule week picker + drag-to-create
```

### Success Criteria
- [ ] Bug 1.6-BUG: Remove member và role changes hoạt động ổn định
- [ ] Member login không thấy nav items không có quyền
- [ ] Tất cả trang có layout nhất quán (padding, heading, width)
- [ ] Browser tab hiển thị đúng tên trang
- [ ] URL mới hoạt động, redirect từ URL cũ
- [ ] Committed hours history được lưu chính xác
- [ ] Trend analytics dùng đúng giá trị lịch sử
- [ ] `npx supabase test db` PASS sau migration DB-1

---

*Sprint Change Proposal — Generated 2026-03-25*
*Workflow: Correct Course | Mode: Incremental*
