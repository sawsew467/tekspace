# Story 8.17: Route Protection — Role-based beforeLoad Guards

Status: review
Epic: 8 — UX Polish & Feature Completeness
Story ID: 8.17
Story Key: 8-17-route-protection
Created: 2026-03-25

---

## Story

Là một `member` (vai trò không có quyền quản trị),
tôi muốn bị redirect về Dashboard ngay khi cố navigate trực tiếp vào URL không có quyền,
để không bao giờ thấy màn hình "no permission" awkward.

---

## Acceptance Criteria

**Given** user có vai trò `member` (không có `manageTenant`)
**When** navigate trực tiếp vào `/team/settings`
**Then** bị redirect ngay về `/dashboard` — không render component, không thấy text "Chỉ Owner mới có thể..."

**Given** user có vai trò `member` (không có `manageMembers`)
**When** navigate trực tiếp vào `/team/invites`
**Then** bị redirect về `/dashboard`

**Given** user có vai trò `manager` (có `manageMembers`, không có `manageTenant`)
**When** navigate vào `/team/invites`
**Then** truy cập bình thường

**Given** user có vai trò `manager`
**When** navigate vào `/team/settings`
**Then** bị redirect về `/dashboard` (chỉ `owner` có quyền `manageTenant`)

**Given** user có vai trò `owner`
**When** navigate vào `/team/settings` và `/team/invites`
**Then** cả hai đều truy cập bình thường

---

## Tasks / Subtasks

- [x] Thêm `beforeLoad` vào `/_app/team/settings` (AC: #1, #4, #5)
  - [x] Import `redirect` từ `@tanstack/react-router`
  - [x] Import `useTenantStore` từ `@/stores/tenant-store`
  - [x] Import `hasPermission` từ `@/lib/permissions`
  - [x] Import `ROUTES` từ `@/lib/routes`
  - [x] Thêm `beforeLoad: () => { ... }` vào `createFileRoute()`
  - [x] Dùng `useTenantStore.getState().activeRole` — KHÔNG phải hook
  - [x] `if (!activeRole || !hasPermission(activeRole, 'manageTenant')) throw redirect({ to: ROUTES.app.dashboard })`
  - [x] Xóa block `if (!canManageTenant) return <div>Chỉ Owner...</div>` trong component body
  - [x] Xóa `usePermissions` import nếu không còn dùng

- [x] Thêm `beforeLoad` vào `/_app/team/invites` (AC: #2, #3)
  - [x] Import `redirect`, `useTenantStore`, `hasPermission`, `ROUTES`
  - [x] `if (!activeRole || !hasPermission(activeRole, 'manageMembers')) throw redirect({ to: ROUTES.app.dashboard })`

---

## Dev Notes

### Root Cause — Tại sao cần beforeLoad thay vì component-level check

**Trạng thái hiện tại:**

`team/settings.tsx` — kiểm tra trong component body:
```typescript
if (!canManageTenant) {
  return (
    <div className='text-muted-foreground py-8 text-center text-sm'>
      Chỉ Owner mới có thể thay đổi cài đặt nhóm.
    </div>
  )
}
```
→ Component vẫn render (query `getTenantSettings` vẫn gọi), user thấy "no permission" text.

`team/invites.tsx` — không có route guard, chỉ truyền prop:
```typescript
<InviteListSection canManage={canManageMembers} />
```
→ `member` vào `/team/invites` thấy toàn bộ invite list (chỉ ẩn nút quản lý).

**Sau fix:** `beforeLoad` chạy TRƯỚC khi render component → redirect ngay, không fetch data, không thấy content.

### Pattern bắt buộc dùng

**`_app/route.tsx` là precedent** — parent beforeLoad đã init `tenantStore`. TanStack Router đảm bảo parent beforeLoad chạy trước child → khi `team/settings` beforeLoad chạy, `activeRole` đã có giá trị.

```typescript
// src/routes/_app/team/settings.tsx
export const Route = createFileRoute('/_app/team/settings')({
  beforeLoad: () => {
    const { activeRole } = useTenantStore.getState()  // Zustand static — OK trong beforeLoad
    if (!activeRole || !hasPermission(activeRole, 'manageTenant')) {
      throw redirect({ to: ROUTES.app.dashboard })   // throw, không phải return
    }
  },
  head: () => ({
    meta: [{ title: 'Cài đặt nhóm — TekSpace' }],
  }),
  component: TeamSettingsPage,
})
```

```typescript
// src/routes/_app/team/invites.tsx
export const Route = createFileRoute('/_app/team/invites')({
  beforeLoad: () => {
    const { activeRole } = useTenantStore.getState()
    if (!activeRole || !hasPermission(activeRole, 'manageMembers')) {
      throw redirect({ to: ROUTES.app.dashboard })
    }
  },
  head: () => ({
    meta: [{ title: 'Lời mời — TekSpace' }],
  }),
  component: TeamInvitesPage,
})
```

**3 quy tắc không thể sai:**
1. `useTenantStore.getState()` — không phải `useTenantStore()` (hook không dùng được ngoài React component)
2. `throw redirect(...)` — không phải `return redirect(...)` (TanStack Router yêu cầu throw)
3. Không cần `async` — đọc Zustand state là synchronous

### Permission Matrix (đã có trong `src/lib/permissions.ts`)

| Quyền | owner | manager | member |
|-------|-------|---------|--------|
| `manageTenant` | ✅ | ❌ | ❌ |
| `manageMembers` | ✅ | ✅ | ❌ |

→ `/team/settings`: guard `manageTenant` → chỉ owner vào được
→ `/team/invites`: guard `manageMembers` → owner + manager vào được

### Cleanup trong `TeamSettingsPage`

Sau khi thêm beforeLoad, xóa đoạn guard trong component body:

```typescript
// XÓA (không còn cần):
const { canManageTenant } = usePermissions()
// ...
if (!canManageTenant) {
  return (
    <div className='text-muted-foreground py-8 text-center text-sm'>
      Chỉ Owner mới có thể thay đổi cài đặt nhóm.
    </div>
  )
}
```

Xóa luôn import `usePermissions` nếu không còn dùng ở chỗ khác trong file.

### Không làm

- ❌ KHÔNG thêm guard cho `/team/members` — tất cả roles đều thấy danh sách thành viên
- ❌ KHÔNG thêm guard cho `/account/*` — tất cả users truy cập account của mình
- ❌ KHÔNG sửa `hasPermission()` hay `ROLE_PERMISSIONS`
- ❌ KHÔNG viết migration hay thay đổi DB
- ❌ KHÔNG thêm guard vào parent `/_app/team/route.tsx` (nếu có) — chỉ guard tại route cụ thể

### Test thủ công

```
1. Login bằng member:
   - Vào /team/settings → redirect về /dashboard
   - Vào /team/invites → redirect về /dashboard
   - Vào /team/members → truy cập bình thường (không có guard)

2. Login bằng manager:
   - Vào /team/invites → truy cập bình thường
   - Vào /team/settings → redirect về /dashboard

3. Login bằng owner:
   - Vào /team/settings → form hiển thị đầy đủ (không còn "Chỉ Owner" text)
   - Vào /team/invites → truy cập bình thường
```

### Project Structure Notes

Files thay đổi (chỉ 2 files):
- `src/routes/_app/team/settings.tsx` — thêm `beforeLoad`, xóa component-level permission block
- `src/routes/_app/team/invites.tsx` — thêm `beforeLoad`

Không tạo file mới, không sửa DB, không sửa store.

### References

- [Source: src/routes/_app/route.tsx] — Pattern `beforeLoad` dùng `useTenantStore.getState()` + `throw redirect`
- [Source: src/lib/permissions.ts] — `hasPermission()`, `Permission` type, `ROLE_PERMISSIONS`
- [Source: src/lib/routes.ts] — `ROUTES.app.dashboard`
- [Source: src/routes/_app/team/settings.tsx#L74, #L140-L146] — Component-level check cần xóa
- [Source: sprint-change-proposal-2026-03-25.md#8-17] — Yêu cầu gốc

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5

### Debug Log References

_Không có lỗi nào trong quá trình implement._

### Completion Notes List

- ✅ Thêm `beforeLoad` vào `settings.tsx`: dùng `useTenantStore.getState().activeRole` + `hasPermission(activeRole, 'manageTenant')` → `throw redirect({ to: ROUTES.app.dashboard })` — owner có thể vào, manager và member bị redirect về dashboard
- ✅ Xóa hoàn toàn component-level guard (`if (!canManageTenant) return <div>Chỉ Owner...</div>`) và `usePermissions` import khỏi `settings.tsx`
- ✅ Thêm `beforeLoad` vào `invites.tsx`: guard `manageMembers` — owner + manager vào được, member bị redirect
- ✅ `invites.tsx` đã xóa `usePermissions` hook, `canManage` prop hardcode `true` vì route đã được guard
- ✅ TypeScript compile: 0 lỗi — `npx tsc --noEmit` sạch
- ✅ ESLint: 0 warning/error trên cả 2 files

### File List

- `src/routes/_app/team/settings.tsx` — thêm `beforeLoad` guard `manageTenant`, xóa component-level permission block và `usePermissions` import
- `src/routes/_app/team/invites.tsx` — thêm `beforeLoad` guard `manageMembers`, xóa `usePermissions` hook, hardcode `canManage={true}`

### Change Log

- 2026-03-25: Implement Story 8-17 — Route protection với `beforeLoad` guards cho `/team/settings` (manageTenant) và `/team/invites` (manageMembers). Xóa component-level permission blocks.
