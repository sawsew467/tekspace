# Story 8.8: Sidebar Collapse Fix

Status: review
Epic: 8 — UX Polish & Feature Completeness
Story ID: 8.8
Story Key: 8-8-sidebar-collapse-fix
Created: 2026-03-25

---

## Story

Là một user,
tôi muốn sidebar thu gọn mượt mà và notification badge vẫn hiển thị khi sidebar đang ở chế độ icon,
để tôi biết có thông báo chưa đọc ngay cả khi sidebar đang được thu gọn.

---

## Acceptance Criteria

**Given** sidebar đang ở chế độ expanded (mở rộng)
**When** có unread notifications
**Then** badge số hiện bên cạnh text "Notifications" như hiện tại

**Given** sidebar đang ở chế độ collapsed (icon mode)
**When** có unread notifications
**Then** hiển thị dot indicator nhỏ màu destructive (đỏ) tại góc trên-phải của icon Bell
**And** tooltip khi hover icon Bell hiển thị `"Notifications (N)"` thay vì chỉ `"Notifications"`

**Given** sidebar đang ở chế độ collapsed
**When** không có unread notifications
**Then** KHÔNG hiển thị dot indicator
**And** tooltip hiển thị `"Notifications"` bình thường

**Given** sidebar collapse/expand
**When** animation transition
**Then** layout không bị vỡ, content area resize mượt mà

---

## Tasks / Subtasks

- [x] Fix `SidebarMenuLink` trong `nav-group.tsx` — thêm dot badge khi collapsed (AC: #2, #3)
  - [x] Trong `SidebarMenuItem`, thêm span dot indicator sau `SidebarMenuButton`
  - [x] Dot chỉ hiển thị khi: `item.badge` tồn tại VÀ sidebar collapsed (dùng Tailwind `group-data-[collapsible=icon]:`)
  - [x] Dot: `absolute top-1.5 end-1 z-10 size-2 rounded-full bg-destructive`
  - [x] Default: `hidden`, collapsed: `group-data-[collapsible=icon]:flex`

- [x] Update tooltip khi collapsed để include badge count (AC: #2, #4)
  - [x] Trong `SidebarMenuLink`, tính `tooltipLabel`: nếu `item.badge` → `"${item.title} (${item.badge})"`, không thì `item.title`
  - [x] Truyền `tooltipLabel` vào prop `tooltip` của `SidebarMenuButton`

- [x] Verify `NavBadge` không gây layout issue khi collapsed (AC: #4)
  - [x] `NavBadge` đã bị clip bởi `overflow-hidden` + `size-8` của button → không cần xử lý thêm
  - [x] Kiểm tra bằng mắt: sidebar toggle vài lần, confirm không có layout jump

---

## Dev Notes

### Trạng thái hiện tại

**`src/components/layout/nav-group.tsx` — `SidebarMenuLink`:**
```tsx
function SidebarMenuLink({ item, href }: { item: NavLink; href: string }) {
  const { setOpenMobile } = useSidebar()
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={checkIsActive(href, item)}
        tooltip={item.title}     // ← tooltip chỉ có title, không có badge
      >
        <Link to={item.url} onClick={() => setOpenMobile(false)}>
          {item.icon && <item.icon />}
          <span>{item.title}</span>
          {item.badge && <NavBadge>{item.badge}</NavBadge>}   // ← bị clip khi collapsed
        </Link>
      </SidebarMenuButton>
      {/* ← THIẾU dot indicator cho collapsed state */}
    </SidebarMenuItem>
  )
}
```

**Vấn đề:**
1. Khi sidebar collapsed → `SidebarMenuButton` có class `group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! overflow-hidden` → badge text bị clip hoàn toàn
2. Tooltip chỉ hiển thị title, không có badge count
3. User không biết có notification chưa đọc khi sidebar thu gọn

### Implementation — `src/components/layout/nav-group.tsx`

**Thay `SidebarMenuLink`:**

```tsx
function SidebarMenuLink({ item, href }: { item: NavLink; href: string }) {
  const { setOpenMobile } = useSidebar()
  const tooltipLabel = item.badge ? `${item.title} (${item.badge})` : item.title
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={checkIsActive(href, item)}
        tooltip={tooltipLabel}
      >
        <Link to={item.url} onClick={() => setOpenMobile(false)}>
          {item.icon && <item.icon />}
          <span>{item.title}</span>
          {item.badge && <NavBadge>{item.badge}</NavBadge>}
        </Link>
      </SidebarMenuButton>
      {/* Dot badge — chỉ visible khi sidebar collapsed VÀ có badge */}
      {item.badge && (
        <span className='pointer-events-none absolute top-1.5 end-1 z-10 hidden size-2 rounded-full bg-destructive group-data-[collapsible=icon]:flex' />
      )}
    </SidebarMenuItem>
  )
}
```

### Cơ chế CSS hoạt động

**Selector `group-data-[collapsible=icon]:`:**
- `group` class nằm trên div wrapper của `Sidebar` component (`src/components/ui/sidebar.tsx` line ~207): `className='group peer hidden text-sidebar-foreground md:block'`
- Khi `state === 'collapsed'` và `collapsible === 'icon'` → div đó có `data-collapsible="icon"`
- → tất cả descendants có `group-data-[collapsible=icon]:...` đều được apply

**Dot position:** `SidebarMenuItem` có class `relative` → dot `absolute top-1.5 end-1` sẽ position tại góc top-right của menu item (không phải button, nhưng đủ gần icon để nhận ra)

**Default collapsible = 'icon':** Từ `src/context/layout-provider.tsx`:
```ts
const DEFAULT_COLLAPSIBLE = 'icon'
```
→ app luôn dùng icon collapse mode, không phải offcanvas.

### Files cần sửa

| File | Thay đổi |
|------|----------|
| `src/components/layout/nav-group.tsx` | Sửa `SidebarMenuLink`: thêm dot badge + update tooltip |

**KHÔNG cần sửa:**
- `src/components/ui/sidebar.tsx` — component library, đừng touch
- `src/components/layout/app-sidebar.tsx` — badge injection logic đúng rồi
- `src/context/layout-provider.tsx` — không liên quan
- `src/components/layout/authenticated-layout.tsx` — không liên quan

### Kiểm tra layout không vỡ

Khi sidebar toggle collapse/expand:
- `SidebarInset` tự resize via CSS variable `--sidebar-width` / `--sidebar-width-icon`
- `SidebarProvider` wrapper có `group/sidebar-wrapper flex min-h-svh w-full has-data-[variant=inset]:bg-sidebar`
- Transition được handle bởi `transition-[width] duration-200 ease-linear` trên sidebar gap div

Nếu layout vỡ → kiểm tra `authenticated-layout.tsx` xem có thêm class width nào không cần thiết.

### NavBadge component (đã có, KHÔNG tạo mới)

```tsx
function NavBadge({ children }: { children: ReactNode }) {
  return <Badge className='rounded-full px-1 py-0 text-xs'>{children}</Badge>
}
```
→ Dùng `Badge` từ `@/components/ui/badge`. Không cần thêm gì.

### Badge injection (đã có trong app-sidebar.tsx)

```tsx
const navGroupsWithBadge = sidebarData.navGroups.map((group) => ({
  ...group,
  items: group.items.map((item) =>
    item.url === ROUTES.app.notifications
      ? { ...item, badge: unreadCount > 0 ? String(unreadCount > 99 ? '99+' : unreadCount) : undefined }
      : item
  ),
}))
```
→ Badge được inject vào Notifications nav item tại `app-sidebar.tsx`. Story này chỉ cần hiển thị đúng khi collapsed.

---

## Wave Context

Story này thuộc **Wave 2** — chạy sau Wave 1 đã done.

**Wave 2 stories (3 stories, không conflict nhau):**
- `8-6-url-restructure-and-nav-roles`: sửa routes + sidebar-data.ts (KHÔNG sửa nav-group.tsx)
- `8-7-layout-page-container`: tạo PageContainer + apply vào pages (KHÔNG sửa nav-group.tsx)
- `8-8-sidebar-collapse-fix` (story này): chỉ sửa nav-group.tsx

→ **Zero file conflict** với 8-6 và 8-7.

**Lưu ý quan trọng sau khi 8-6 xong:**
- `sidebar-data.ts` sẽ có URL mới: `/my-schedule`, `/team-schedule`, `/dashboard` (thay `/schedule`, `/dashboard`, `/my-dashboard`)
- `ROUTES.app.notifications` vẫn giữ nguyên là `/notifications` → badge injection trong app-sidebar.tsx không đổi
- Story này KHÔNG sửa sidebar-data.ts hay routes → không bị ảnh hưởng bởi 8-6

---

## Definition of Done

- [x] Sidebar ở expanded: badge text hiển thị bên cạnh "Notifications" (giữ nguyên behavior cũ)
- [x] Sidebar ở collapsed: dot đỏ nhỏ xuất hiện tại góc top-right của icon Bell khi có unread
- [x] Sidebar ở collapsed: tooltip hover Bell hiện `"Notifications (3)"` thay vì chỉ `"Notifications"`
- [x] Sidebar ở collapsed: khi unreadCount = 0, KHÔNG có dot
- [x] Toggle sidebar vài lần: layout không jump, animation mượt
- [x] Chỉ 1 file thay đổi: `src/components/layout/nav-group.tsx`

---

## Dev Agent Record

### File List

- `src/components/layout/nav-group.tsx` — modified

### Change Log

- 2026-03-25: Story 8-8 implemented — thêm dot badge và tooltip với badge count cho SidebarMenuLink khi sidebar collapsed

### Completion Notes

Thay đổi minimal, chỉ 1 file:
- `SidebarMenuLink`: thêm `tooltipLabel` tính từ `item.title` + `item.badge` (nếu có)
- `SidebarMenuButton`: dùng `tooltip={tooltipLabel}` thay vì `tooltip={item.title}`
- Thêm `<span>` dot badge `absolute` bên ngoài `SidebarMenuButton` nhưng bên trong `SidebarMenuItem` (`relative`): mặc định `hidden`, chỉ `flex` khi `group-data-[collapsible=icon]:` active
- TypeScript pass ✅, ESLint pass ✅, không có regression
