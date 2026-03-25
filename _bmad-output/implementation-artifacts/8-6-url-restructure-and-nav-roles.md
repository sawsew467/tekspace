# Story 8.6: URL Restructure và Nav Role Filtering

Status: done
Epic: 8 — UX Polish & Feature Completeness
Story ID: 8.6
Story Key: 8-6-url-restructure-and-nav-roles
Created: 2026-03-25

---

## Story

Là một user TekSpace (bất kỳ role),
tôi muốn các URL phản ánh đúng semantic của trang và sidebar chỉ hiển thị items phù hợp với role của tôi,
để navigation trực quan hơn và không thấy những mục không có quyền truy cập.

---

## Acceptance Criteria

**Given** user navigate vào `/team-schedule`
**When** trang load
**Then** hiển thị Team Dashboard (`TeamDashboard` component) — giống `/dashboard` trước đây

**Given** user navigate vào `/dashboard`
**When** trang load
**Then** hiển thị Self Dashboard (`SelfDashboard` component) — giống `/my-dashboard` trước đây

**Given** user navigate vào `/my-schedule`
**When** trang load
**Then** hiển thị Schedule page (`SchedulePage`) — giống `/schedule` trước đây

**Given** user navigate vào URL cũ `/my-dashboard`
**When** route load
**Then** bị redirect ngay về `/dashboard` (không render component)

**Given** user navigate vào URL cũ `/schedule`
**When** route load
**Then** bị redirect ngay về `/my-schedule` (không render component)

**Given** user có role `member`
**When** sidebar render
**Then** các mục "Thành viên", "Lời mời", "Cài đặt nhóm" trong Team section **KHÔNG** hiển thị
**And** tất cả mục Work và Overview vẫn hiển thị bình thường

**Given** user có role `manager`
**When** sidebar render
**Then** "Thành viên" và "Lời mời" hiển thị (manager có `manageMembers`)
**And** "Cài đặt nhóm" **KHÔNG** hiển thị (chỉ owner có `manageTenant`)

**Given** user có role `owner`
**When** sidebar render
**Then** tất cả items trong Team section đều hiển thị

**Given** URL cũ `/my-dashboard` được bookmark hoặc share
**When** user truy cập
**Then** redirect về `/dashboard` — không thấy 404

---

## Tasks / Subtasks

- [x] **Task 1: Cập nhật ROUTES constant** (AC: #1, #2, #3)
  - [x] 1.1 Mở `src/lib/routes.ts`
  - [x] 1.2 Đổi `dashboard: '/dashboard'` → `teamSchedule: '/team-schedule'`
  - [x] 1.3 Đổi `myDashboard: '/my-dashboard'` → `dashboard: '/dashboard'`
  - [x] 1.4 Đổi `schedule: '/schedule'` → `schedule: '/my-schedule'`
  - [x] 1.5 Đổi `scheduleManage: '/schedule/manage'` → `scheduleManage: '/my-schedule/manage'`
  - [x] 1.6 **Bỏ key `myDashboard`** (không còn cần, `/my-dashboard` → sẽ có redirect file)

- [x] **Task 2: Tạo route file mới `/team-schedule`** (AC: #1)
  - [x] 2.1 Tạo file `src/routes/_app/team-schedule.tsx`
  - [x] 2.2 `createFileRoute('/_app/team-schedule')` với `component: TeamDashboard`
  - [x] 2.3 Thêm `head()` với meta title `'Team Schedule — TekSpace'`
  - [x] 2.4 Import `TeamDashboard` từ `@/features/dashboard/components/TeamDashboard`

- [x] **Task 3: Sửa route file `/dashboard` để render SelfDashboard** (AC: #2)
  - [x] 3.1 Mở `src/routes/_app/dashboard.tsx`
  - [x] 3.2 Đổi import: xóa `TeamDashboard`, thêm `SelfDashboard` từ `@/features/dashboard/components/SelfDashboard`
  - [x] 3.3 Đổi `component: TeamDashboard` → `component: SelfDashboard`
  - [x] 3.4 Đổi meta title thành `'Dashboard — TekSpace'`

- [x] **Task 4: Tạo route file mới `/my-schedule`** (AC: #3)
  - [x] 4.1 Tạo file `src/routes/_app/my-schedule.tsx`
  - [x] 4.2 Copy toàn bộ nội dung từ `src/routes/_app/schedule.tsx`
  - [x] 4.3 Đổi `createFileRoute('/_app/schedule')` → `createFileRoute('/_app/my-schedule')`
  - [x] 4.4 Giữ nguyên meta title `'Lịch làm việc — TekSpace'`

- [x] **Task 5: Biến `/my-dashboard` thành redirect** (AC: #4, #8)
  - [x] 5.1 Mở `src/routes/_app/my-dashboard.tsx`
  - [x] 5.2 Xóa toàn bộ nội dung, thay bằng redirect trong `beforeLoad`
  - [x] 5.3 Code:
    ```tsx
    import { createFileRoute, redirect } from '@tanstack/react-router'
    import { ROUTES } from '@/lib/routes'

    export const Route = createFileRoute('/_app/my-dashboard')({
      beforeLoad: () => {
        throw redirect({ to: ROUTES.app.dashboard, replace: true })
      },
      component: () => null,
    })
    ```

- [x] **Task 6: Biến `/schedule` thành redirect** (AC: #5)
  - [x] 6.1 Mở `src/routes/_app/schedule.tsx`
  - [x] 6.2 Xóa toàn bộ nội dung, thay bằng redirect trong `beforeLoad`
  - [x] 6.3 Code:
    ```tsx
    import { createFileRoute, redirect } from '@tanstack/react-router'
    import { ROUTES } from '@/lib/routes'

    export const Route = createFileRoute('/_app/schedule')({
      beforeLoad: () => {
        throw redirect({ to: ROUTES.app.schedule, replace: true })
      },
      component: () => null,
    })
    ```
    > `ROUTES.app.schedule` lúc này = `'/my-schedule'`

- [x] **Task 7: Thêm `roles` field vào NavItem type** (AC: #6, #7, #8)
  - [x] 7.1 Mở `src/components/layout/types.ts`
  - [x] 7.2 Thêm import: `import type { MemberRole } from '@/lib/permissions'`
  - [x] 7.3 Thêm vào `BaseNavItem`:
    ```typescript
    roles?: MemberRole[]   // nếu không set → visible cho mọi role
    ```

- [x] **Task 8: Cập nhật sidebar-data.ts với URLs mới + roles** (AC: #6, #7, #8)
  - [x] 8.1 Mở `src/components/layout/data/sidebar-data.ts`
  - [x] 8.2 Cập nhật URL items trong group "Overview":
    - "Dashboard": đổi `url` thành `ROUTES.app.dashboard` (= `/dashboard`)
    - Đổi title "Dashboard" → `'Dashboard'` (giữ nguyên hoặc đổi thành "My Dashboard" để rõ hơn — xem Dev Notes)
    - "My Dashboard" item: **XÓA** (route này đã merge vào `/dashboard`)
    - Thêm item mới "Team Schedule": `url: ROUTES.app.teamSchedule` (= `/team-schedule`), `icon: LayoutDashboard`
  - [x] 8.3 Cập nhật URL item "Lịch làm việc": đổi `url` thành `ROUTES.app.schedule` (= `/my-schedule`)
  - [x] 8.4 **Thêm `roles` vào Team group items**:
    ```typescript
    { title: 'Thành viên',   url: ROUTES.app.team.members,  icon: Users,     roles: ['owner', 'manager'] },
    { title: 'Lời mời',      url: ROUTES.app.team.invites,  icon: Mail,      roles: ['owner', 'manager'] },
    { title: 'Cài đặt nhóm', url: ROUTES.app.team.settings, icon: Settings,  roles: ['owner'] },
    ```
  - [x] 8.5 Đảm bảo `sidebar-data.ts` import `ROUTES` từ `@/lib/routes` và `MemberRole` nếu cần type
  - [x] 8.6 Chú ý: sidebar-data là static constant — nên **KHÔNG** dùng ROUTES runtime ở đây, mà dùng string literal nếu cần. Thực ra, ROUTES là `as const` nên có thể dùng trực tiếp.
    > Xem Dev Notes để biết cách import ROUTES trong sidebar-data.ts hiện tại

- [x] **Task 9: Filter sidebar theo role trong AppSidebar** (AC: #6, #7, #8)
  - [x] 9.1 Mở `src/components/layout/app-sidebar.tsx`
  - [x] 9.2 Lấy `activeRole` từ tenant store (đã có `useTenantStore`)
  - [x] 9.3 Sau dòng `const { tenants, activeTenantId, initFromSession, setActiveTenant } = useTenantStore()`, thêm:
    ```typescript
    const { activeRole } = useTenantStore()
    ```
    > `activeRole: MemberRole | null` — đã có trong store
  - [x] 9.4 Thêm filter logic trong `navGroupsWithBadge` pipeline:
    ```typescript
    const navGroupsWithBadge = sidebarData.navGroups.map((group) => ({
      ...group,
      items: group.items
        .filter((item) => !item.roles || (activeRole && item.roles.includes(activeRole)))
        .map((item) =>
          item.url === ROUTES.app.notifications
            ? { ...item, badge: unreadCount > 0 ? String(unreadCount > 99 ? '99+' : unreadCount) : undefined }
            : item
        ),
    }))
    ```
    > Filter: nếu `item.roles` không set → hiển thị cho tất cả. Nếu `roles` có set → chỉ hiển thị khi `activeRole` có trong mảng.

- [x] **Task 10: Cập nhật hardcoded dashboard references** (AC: #2)
  - [x] 10.1 Mở `src/components/layout/app-title.tsx`
  - [x] 10.2 Đổi `window.location.href = '/dashboard'` → import và dùng router navigate:
    ```tsx
    import { ROUTES } from '@/lib/routes'
    // Thêm import useNavigate
    import { useNavigate } from '@tanstack/react-router'
    // Trong component:
    const navigate = useNavigate()
    // onClick:
    onClick={() => { setOpenMobile(false); void navigate({ to: ROUTES.app.dashboard }) }}
    ```
    > Lý do: dùng `window.location.href` bypass router → mất query cache, hardcoded string dễ stale
  - [x] 10.3 Mở `src/components/layout/app-sidebar.tsx`, dòng handleSwitch:
    - Dòng `await navigate({ to: ROUTES.app.dashboard })` — sau khi đổi ROUTES.app.dashboard = '/dashboard' (SelfDashboard), đây là behavior chính xác cho sau tenant switch → navigate về personal dashboard

- [x] **Task 11: Update e2e test** (AC: #2)
  - [x] 11.1 Mở `e2e/story-1-4-tenant-creation-team-settings.spec.ts`
  - [x] 11.2 Tìm các dòng `await page.goto('/dashboard')` → đổi thành:
    - Nếu test cần Team Schedule: đổi thành `await page.goto('/team-schedule')`
    - Nếu test cần Personal Dashboard: giữ `/dashboard` (vì route content đã đổi)
    - Xem context của từng test để quyết định

- [x] **Task 12: Verify routeTree gen và build** (tất cả AC)
  - [x] 12.1 Chạy `npx tsc -b` → không có lỗi mới từ story 8-6 (8 pre-existing errors từ stories 8-5/8-7 không liên quan)
  - [x] 12.2 Route tree được TanStack Router auto-gen khi dev server chạy hoặc khi build — kiểm tra `src/routeTree.gen.ts` có đủ routes mới
  - [x] 12.3 Verify không còn orphan references đến `ROUTES.app.myDashboard` bằng cách search toàn bộ codebase

---

## Dev Notes

### ⚠️ Thứ tự thực hiện quan trọng

Làm theo thứ tự sau để tránh TypeScript error và broken imports:

1. **Task 1 trước** (ROUTES constant) — các tasks sau depend vào đây
2. **Task 7 trước Task 8** (type trước data)
3. **Task 2, 3, 4** (route files mới) — có thể làm song song sau Task 1
4. **Task 5, 6** (redirect files) — sau Task 1
5. **Task 8, 9** (sidebar) — sau Task 7
6. **Task 10, 11** — độc lập, làm cuối
7. **Task 12** (verify) — luôn làm cuối cùng

### URL Rename Mapping (toàn bộ)

| URL cũ | URL mới | Component | ROUTES key cũ | ROUTES key mới |
|--------|---------|-----------|----------------|----------------|
| `/dashboard` | `/team-schedule` | `TeamDashboard` | `ROUTES.app.dashboard` | `ROUTES.app.teamSchedule` |
| `/my-dashboard` | `/dashboard` | `SelfDashboard` | `ROUTES.app.myDashboard` | `ROUTES.app.dashboard` |
| `/schedule` | `/my-schedule` | `SchedulePage` | `ROUTES.app.schedule` | `ROUTES.app.schedule` (value thay đổi) |
| `/schedule/manage` | `/my-schedule/manage` | — | `ROUTES.app.scheduleManage` | `ROUTES.app.scheduleManage` (value thay đổi) |

> **Lưu ý quan trọng:** Sau story này, `ROUTES.app.dashboard` = `/dashboard` (SelfDashboard). Tất cả code đang dùng `ROUTES.app.dashboard` để navigate sau login/auth sẽ land vào SelfDashboard — đây là behavior **đúng** theo spec.

### ROUTES constant sau khi update

```typescript
export const ROUTES = {
  signIn: '/sign-in',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  acceptInvite: '/accept-invite',
  app: {
    createTenant: '/create-tenant',
    teamSchedule: '/team-schedule',  // ← RENAMED từ dashboard
    dashboard: '/dashboard',          // ← NEW VALUE (was /my-dashboard)
    // myDashboard: đã xóa
    schedule: '/my-schedule',         // ← CHANGED VALUE
    scheduleManage: '/my-schedule/manage', // ← CHANGED VALUE
    dailyReport: '/daily-report',
    analytics: '/analytics',
    notifications: '/notifications',
    incidents: '/incidents',
    account: {
      profile: '/account/profile',
      security: '/account/security',
    },
    team: {
      members: '/team/members',
      invites: '/team/invites',
      settings: '/team/settings',
    },
  },
} as const
```

### Sidebar Nav Roles

Nguyên tắc: `roles?: MemberRole[]` trong `BaseNavItem` — nếu không set, hiển thị cho tất cả.

| Nav Item | URL | Roles được phép |
|----------|-----|-----------------|
| Team Schedule | `/team-schedule` | Tất cả (không set `roles`) |
| Dashboard (Self) | `/dashboard` | Tất cả |
| Analytics | `/analytics` | Tất cả |
| Lịch làm việc | `/my-schedule` | Tất cả |
| Báo cáo ngày | `/daily-report` | Tất cả |
| Notifications | `/notifications` | Tất cả |
| Incidents | `/incidents` | Tất cả |
| **Thành viên** | `/team/members` | `['owner', 'manager']` |
| **Lời mời** | `/team/invites` | `['owner', 'manager']` |
| **Cài đặt nhóm** | `/team/settings` | `['owner']` |

> Route guards trong `/team/settings` và `/team/invites` vẫn giữ nguyên (từ Story 8-17). Sidebar filter là UI enhancement, không thay thế security guard.

### Sidebar Title Đề xuất

Overview group sau khi đổi:
- "Team Schedule" (icon: `LayoutDashboard`) → `/team-schedule` — team weekly view
- "Dashboard" (icon: `User` hoặc đổi thành `Home`) → `/dashboard` — personal summary
- "Analytics" (icon: `BarChart3`) → không đổi

Hoặc nếu muốn rõ hơn:
- "My Dashboard" cho `/dashboard` (SelfDashboard)

**Quyết định:** Dùng "Dashboard" cho `/dashboard` (personal) và "Team Schedule" cho `/team-schedule` để ngắn gọn. Đây là quyết định thiết kế — dev agent có thể điều chỉnh nếu thấy khác.

### Import ROUTES trong sidebar-data.ts

File `sidebar-data.ts` hiện tại **không** import ROUTES. Để thêm URLs từ ROUTES (an toàn, không circular):

```typescript
import { ROUTES } from '@/lib/routes'  // thêm dòng này

// Dùng trong items:
{ title: 'Team Schedule', url: ROUTES.app.teamSchedule, icon: LayoutDashboard }
```

Vì `ROUTES` là `as const` (pure constant, không có side effects), import này hoàn toàn an toàn.

### Tại sao dùng `replace: true` trong redirect

```typescript
// Trong route file /my-dashboard:
throw redirect({ to: ROUTES.app.dashboard, replace: true })
```

`replace: true` → không tạo entry trong browser history. User nhấn Back sẽ không bị loop lại `/my-dashboard`.

### app-sidebar.tsx — Filter pipeline

Hiện tại `navGroupsWithBadge` chỉ inject badge. Sau story này, cần thêm filter trước khi inject badge:

```typescript
const { tenants, activeTenantId, initFromSession, setActiveTenant, activeRole } = useTenantStore()

const navGroupsWithBadge = sidebarData.navGroups.map((group) => ({
  ...group,
  items: group.items
    .filter((item) => !item.roles || (activeRole && item.roles.includes(activeRole)))
    .map((item) =>
      item.url === ROUTES.app.notifications
        ? { ...item, badge: unreadCount > 0 ? String(unreadCount > 99 ? '99+' : unreadCount) : undefined }
        : item
    ),
}))
```

> `activeRole` từ `useTenantStore` — đã là `MemberRole | null`, được init từ JWT trong `beforeLoad`.

### Một số files KHÔNG cần thay đổi

Các files này dùng `ROUTES.app.dashboard` và sau story này, `ROUTES.app.dashboard = '/dashboard'` (SelfDashboard) — behavior vẫn đúng:
- `src/features/auth/services/auth.service.ts` — trả về `ROUTES.app.dashboard` sau logout redirect
- `src/components/not-found.tsx` — "Về Dashboard" button → `/dashboard`
- `src/routes/_app/team/settings.tsx` — redirect to `ROUTES.app.dashboard` khi thiếu quyền
- `src/routes/_app/team/invites.tsx` — tương tự
- `src/routes/sign-in.tsx` — redirect after login
- `src/routes/accept-invite.tsx` — redirect after accepting invite

### Team Switch trong AppSidebar

Sau tenant switch, navigate đến `ROUTES.app.dashboard` (= `/dashboard` sau story này) → user thấy SelfDashboard của tenant mới. Behavior hợp lý.

### scheduleManage route

Hiện tại không có file `src/routes/_app/schedule/manage.tsx` — route `/schedule/manage` chưa được implement dưới dạng file riêng. ROUTES constant update vẫn cần thiết để đảm bảo consistency, nhưng không cần tạo file route mới cho `manage`.

### TanStack Router routeTree auto-generation

Khi thêm file route mới (`team-schedule.tsx`, `my-schedule.tsx`) và dev server chạy, TanStack Router Vite plugin tự động update `src/routeTree.gen.ts`. KHÔNG edit file này thủ công.

### E2E Tests

`e2e/story-1-4-tenant-creation-team-settings.spec.ts` có 2 dòng `await page.goto('/dashboard')` — cần review:
- Nếu test đang verify Team Dashboard content → đổi thành `/team-schedule`
- Nếu test chỉ cần navigate vào app → có thể giữ `/dashboard` (giờ là SelfDashboard, vẫn là route hợp lệ trong app)

Xem nội dung của từng test để quyết định đúng.

### Previous Story Context

Story 8-17 (done) đã implement `beforeLoad` guards cho `/team/settings` (Owner only) và `/team/invites` (Owner + Manager). Story 8-6 **không đụng** đến 2 files này vì route guards vẫn giữ nguyên.

Story 8-19 (done) đã note rõ: "URL redirects từ old routes sẽ được implement trong Story 8-6" — confirm redirect `/my-dashboard` và `/schedule` là trong scope của story này.

### Project Structure Notes

- Route files: `src/routes/_app/*.tsx` — file-based routing theo TanStack Router convention
- ROUTES constant: `src/lib/routes.ts` — **single source of truth** cho tất cả path strings
- Sidebar data: `src/components/layout/data/sidebar-data.ts` — static config
- Sidebar component: `src/components/layout/app-sidebar.tsx` — runtime filter theo role
- Types: `src/components/layout/types.ts` — NavItem types

### References

- [Source: epics.md — Epic 8, Wave 2, Story 8-6]
- [Source: ux-polish-epic1-spec.md — FIX 3, FIX 3J, Implementation Order]
- [Source: sprint-status.yaml — 8-6 backlog]
- [Source: src/lib/routes.ts — current ROUTES structure]
- [Source: src/components/layout/data/sidebar-data.ts — current sidebar items]
- [Source: src/components/layout/types.ts — NavItem type]
- [Source: src/stores/tenant-store.ts — activeRole MemberRole | null]
- [Source: src/lib/permissions.ts — MemberRole, hasPermission]
- [Source: 8-17-route-protection.md — beforeLoad pattern, useTenantStore.getState().activeRole]
- [Source: 8-19-error-pages.md — "URL redirects từ old routes sẽ được implement trong Story 8-6"]

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-5 (story creation)

### Debug Log References

_Không có debug issues._

### Completion Notes List

- **Task 1:** ROUTES constant cập nhật đúng — `teamSchedule: '/team-schedule'`, `dashboard: '/dashboard'` (SelfDashboard), `schedule: '/my-schedule'`, `scheduleManage: '/my-schedule/manage'`; bỏ key `myDashboard`.
- **Task 2:** `team-schedule.tsx` mới render `TeamDashboard` tại `/team-schedule` với meta title "Team Schedule — TekSpace".
- **Task 3:** `dashboard.tsx` đổi sang `SelfDashboard` với title "Dashboard — TekSpace".
- **Task 4:** `my-schedule.tsx` copied từ `schedule.tsx` với route path `/_app/my-schedule`.
- **Task 5:** `/my-dashboard` redirect về `/dashboard` (SelfDashboard) với `replace: true`.
- **Task 6:** `/schedule` redirect về `/my-schedule` via `ROUTES.app.schedule` với `replace: true`.
- **Task 7:** `types.ts` thêm `roles?: MemberRole[]` vào `BaseNavItem` + import `MemberRole`.
- **Task 8:** `sidebar-data.ts` dùng ROUTES constant; Overview group: Dashboard→`/dashboard`, Team Schedule→`/team-schedule` (icon Home cho Dashboard, LayoutDashboard cho Team Schedule); Work group: Lịch làm việc→`/my-schedule`; Team group: roles filter đúng spec.
- **Task 9:** `app-sidebar.tsx` lấy `activeRole` từ `useTenantStore()`, filter `.filter((item) => !item.roles || (activeRole && item.roles.includes(activeRole)))` trước map badge.
- **Task 10:** `app-title.tsx` dùng `useNavigate()` thay `window.location.href` — loại bỏ hard-coded URL, dùng ROUTES type-safe.
- **Task 11:** E2e tests giữ `/dashboard` — tests chỉ trigger auth guard, không check nội dung page (vẫn valid).
- **Task 12:** `tsc -b` — 8 pre-existing errors từ stories 8-5/8-7 (committed_hours_history, zod v4 api, daily-report); KHÔNG có errors mới từ story 8-6. Unit tests: 277/277 PASS.
- **Bug fix ngoài scope:** Fixed JSX mismatch trong `TeamDashboard.tsx` do story 8-7 (swap `</div>` ↔ `</PageContainer>` closing tags).

### File List

- `src/lib/routes.ts` — MODIFIED (key renames + value changes)
- `src/routes/_app/team-schedule.tsx` — NEW (TeamDashboard tại `/team-schedule`)
- `src/routes/_app/dashboard.tsx` — MODIFIED (đổi sang SelfDashboard)
- `src/routes/_app/my-schedule.tsx` — NEW (SchedulePage tại `/my-schedule`)
- `src/routes/_app/my-dashboard.tsx` — MODIFIED (trở thành redirect → `/dashboard`)
- `src/routes/_app/schedule.tsx` — MODIFIED (trở thành redirect → `/my-schedule`)
- `src/components/layout/types.ts` — MODIFIED (thêm `roles?` vào BaseNavItem)
- `src/components/layout/data/sidebar-data.ts` — MODIFIED (URLs mới + roles filter)
- `src/components/layout/app-sidebar.tsx` — MODIFIED (lấy `activeRole`, filter items by role)
- `src/components/layout/app-title.tsx` — MODIFIED (useNavigate thay window.location.href)
- `src/features/dashboard/components/TeamDashboard.tsx` — MODIFIED (bug fix JSX mismatch từ 8-7)

---

## Change Log

- **2026-03-25:** Story 8-6 implementation hoàn thành — URL restructure (`/dashboard`→`/team-schedule`, `/my-dashboard`→`/dashboard`, `/schedule`→`/my-schedule`), role-based sidebar filtering, redirect compatibility routes. 277 unit tests pass.
