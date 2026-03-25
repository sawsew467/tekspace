# Story 8.7: Layout Page Container

Status: review

## Story

As a developer,
I want a unified `PageContainer` component applied consistently across all pages,
so that padding, max-width, and vertical spacing are consistent throughout the app.

## Acceptance Criteria

1. **AC1 — Component tồn tại:** `src/components/layout/page-container.tsx` được tạo với 2 variants: `default` và `wide`.
2. **AC2 — Variant default:** `container max-w-2xl py-6` — áp dụng cho narrow pages (notifications, daily-report, incidents).
3. **AC3 — Variant wide:** `px-4 py-6 md:px-6` — áp dụng cho wide pages (schedule, analytics, dashboard).
4. **AC4 — Apply toàn bộ pages:** Tất cả các trang được liệt kê trong Tasks đều dùng `<PageContainer>` thay cho container div thủ công.
5. **AC5 — Không có regression:** App build thành công (`tsc -b` + `vite build` không có lỗi), tất cả trang render đúng.
6. **AC6 — Named export:** Component xuất dưới dạng named export (`export function PageContainer`), không dùng default export.

## Tasks / Subtasks

- [ ] Task 1: Tạo component PageContainer (AC1, AC2, AC3, AC6)
  - [ ] Tạo file `src/components/layout/page-container.tsx`
  - [ ] Implement với `variant?: 'default' | 'wide'` và `className?: string`
  - [ ] Named export `export function PageContainer`

- [ ] Task 2: Apply vào route layout wrappers (AC4)
  - [ ] `src/routes/_app/account/route.tsx` — thay `<div className='container mx-auto max-w-2xl py-8'>` bằng `<PageContainer>`
  - [ ] `src/routes/_app/team/route.tsx` — thay `<div className='container mx-auto max-w-4xl py-8'>` bằng `<PageContainer variant="wide">`

- [ ] Task 3: Apply vào route pages (narrow — default variant) (AC4)
  - [ ] `src/routes/_app/notifications.tsx` — thay `<div className="container max-w-2xl py-6 space-y-4">` bằng `<PageContainer className="space-y-4">`
  - [ ] `src/routes/_app/daily-report.tsx` — thay `<div className='container max-w-2xl py-6 space-y-4'>` bằng `<PageContainer className="space-y-4">`
  - [ ] `src/routes/_app/incidents/index.tsx` — thay `<div className='container max-w-3xl py-6 space-y-4'>` bằng `<PageContainer className="space-y-4">`
  - [ ] `src/routes/_app/incidents/$incidentId.tsx` — thay mọi `<div className='container max-w-2xl py-6 ...'>` bằng `<PageContainer className="...">` (xử lý cả loading + not-found + main return)

- [ ] Task 4: Apply vào route pages (wide variant) (AC4)
  - [ ] `src/routes/_app/analytics.tsx` — thay `<div className="p-4 space-y-6">` bằng `<PageContainer variant="wide" className="space-y-6">` (cả loading state `<div className="p-4 space-y-4">` → `<PageContainer variant="wide" className="space-y-4">`)
  - [ ] `src/routes/_app/my-schedule.tsx` — thay `<div className="flex flex-col gap-4 p-4 md:p-6">` bằng `<PageContainer variant="wide" className="flex flex-col gap-4">` — **Note:** Story 8-6 đã move SchedulePage từ `schedule.tsx` → `my-schedule.tsx`; `schedule.tsx` hiện là redirect stub đến `/my-schedule`

- [ ] Task 5: Apply vào feature components (wide variant) (AC4)
  - [ ] `src/features/dashboard/components/TeamDashboard.tsx` — thay `<div className="flex flex-col gap-4 p-4 md:p-6">` bằng `<PageContainer variant="wide" className="flex flex-col gap-4">`
  - [ ] `src/features/dashboard/components/SelfDashboard.tsx` — thay cả loading state `<div className="space-y-4 p-4">` và main `<div className="space-y-4 p-4">` bằng `<PageContainer variant="wide" className="space-y-4">`

- [ ] Task 6: Verify (AC5)
  - [ ] `tsc -b` — 0 errors
  - [ ] `vite build` — success

## Dev Notes

### PageContainer Component Spec

```tsx
// src/components/layout/page-container.tsx
import { cn } from '@/lib/utils'

type PageContainerProps = {
  variant?: 'default' | 'wide'
  className?: string
  children: React.ReactNode
}

export function PageContainer({ variant = 'default', className, children }: PageContainerProps) {
  return (
    <div
      className={cn(
        // Base: vertical padding
        'py-6',
        // Variant-specific horizontal sizing
        variant === 'default' && 'container max-w-2xl',
        variant === 'wide'    && 'px-4 md:px-6',
        className
      )}
    >
      {children}
    </div>
  )
}
```

**Quan trọng:**
- Không import từ `@/components/layout/main` — `Main` component dùng container query `@7xl/content` cho codebase cũ, PageContainer là replacement đơn giản hơn
- `container` class của Tailwind tự xử lý `max-w-screen-*` breakpoints, cần thêm `max-w-2xl` override cho variant default
- Không cần `mx-auto` riêng vì `container` đã bao gồm `mx-auto`

### Inventory đầy đủ — 10 files cần thay đổi

| File | Container hiện tại | Variant mới |
|------|-------------------|-------------|
| `src/routes/_app/account/route.tsx` | `container mx-auto max-w-2xl py-8` | `default` |
| `src/routes/_app/team/route.tsx` | `container mx-auto max-w-4xl py-8` | `wide` |
| `src/routes/_app/notifications.tsx` | `container max-w-2xl py-6 space-y-4` | `default` + `className="space-y-4"` |
| `src/routes/_app/daily-report.tsx` | `container max-w-2xl py-6 space-y-4` | `default` + `className="space-y-4"` |
| `src/routes/_app/incidents/index.tsx` | `container max-w-3xl py-6 space-y-4` | `default` + `className="space-y-4"` |
| `src/routes/_app/incidents/$incidentId.tsx` | `container max-w-2xl py-6 space-y-*` (3 chỗ) | `default` + className tương ứng |
| `src/routes/_app/analytics.tsx` | `p-4 space-y-6` (2 chỗ) | `wide` + className tương ứng |
| `src/routes/_app/my-schedule.tsx` | `flex flex-col gap-4 p-4 md:p-6` (moved từ `schedule.tsx` bởi story 8-6) | `wide` + `className="flex flex-col gap-4"` |
| `src/features/dashboard/components/TeamDashboard.tsx` | `flex flex-col gap-4 p-4 md:p-6` | `wide` + `className="flex flex-col gap-4"` |
| `src/features/dashboard/components/SelfDashboard.tsx` | `space-y-4 p-4` (2 chỗ) | `wide` + `className="space-y-4"` |

### Lưu ý quan trọng — incidents/$incidentId.tsx có 3 return statements

File này có container ở 3 nơi:
1. Loading state (dòng ~139): `<div className='container max-w-2xl py-6 space-y-4'>`
2. Not-found state (dòng ~150): `<div className='container max-w-2xl py-6 space-y-3'>`
3. Main render (dòng ~171): `<div className='container max-w-2xl py-6 space-y-5'>`

Cả 3 đều cần thay thế.

### Lưu ý — account/route.tsx và team/route.tsx

Account layout thêm `py-8` (không phải `py-6`). Khi convert sang PageContainer, `py-6` là chuẩn mới. **Chấp nhận thay đổi nhỏ này** — consistency quan trọng hơn việc giữ `py-8` riêng cho account.

Team route hiện dùng `max-w-4xl` nhưng chuyển sang `wide` (no max-width). Team members table sẽ dùng full available width từ `SidebarInset` — điều này là mong muốn.

### Codebase Conventions

- Named exports (`export function`) — không dùng `export default`
- `cn()` from `@/lib/utils` cho class merging
- Props với `className?: string` luôn đặt cuối prop list
- File path mới: `src/components/layout/page-container.tsx` (cùng folder với `main.tsx`, `authenticated-layout.tsx`)

### Pages KHÔNG cần thay đổi

- `src/routes/_app/route.tsx` — là root layout, không phải page
- `src/routes/_app/dashboard.tsx` — chỉ là thin wrapper delegate sang `TeamDashboard` component (PageContainer đã apply trong component)
- `src/routes/_app/my-dashboard.tsx` — tương tự, delegate sang `SelfDashboard`
- `src/routes/_app/account/profile.tsx` — dùng `<div className='space-y-6'>` bên trong `AccountLayout` wrapper, không cần container riêng
- `src/routes/_app/account/security.tsx` — tương tự
- `src/routes/_app/team/members.tsx` — dùng `<div className='space-y-6'>` bên trong `TeamLayout`
- `src/routes/_app/team/invites.tsx` — bên trong `TeamLayout`
- `src/routes/_app/team/settings.tsx` — bên trong `TeamLayout`

### Project Structure Notes

- `src/components/layout/` — folder cho layout components (`main.tsx`, `authenticated-layout.tsx`, `page-header.tsx`, `app-sidebar.tsx`, ...)
- `PageContainer` fit tự nhiên vào đây

### References

- Layout patterns quan sát từ codebase: [Source: src/routes/_app/notifications.tsx, src/routes/_app/daily-report.tsx, ...]
- `main.tsx` component (existing): [Source: src/components/layout/main.tsx] — KHÔNG dùng, tạo PageContainer mới
- Tailwind `container` behavior: responsive `max-w` + `mx-auto`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-5

### Debug Log References

### Completion Notes List

### File List
