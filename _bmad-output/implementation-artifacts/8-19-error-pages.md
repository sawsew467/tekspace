# Story 8.19: Error Pages — 404 + ErrorBoundary

Status: done
Epic: 8 — UX Polish & Feature Completeness
Story ID: 8.19
Story Key: 8-19-error-pages
Created: 2026-03-25

---

## Story

Là một user,
tôi muốn thấy trang lỗi thân thiện khi truy cập URL không tồn tại hoặc app gặp crash,
để biết chuyện gì đang xảy ra và có cách quay về trạng thái bình thường.

---

## Acceptance Criteria

**Given** user truy cập URL không tồn tại (vd: `/abc/xyz`, `/team/unknown`)
**When** TanStack Router không match route nào
**Then** hiển thị trang 404: "Trang không tồn tại" + nút "Về Dashboard"

**Given** một React component crash (throw error chưa được catch)
**When** error bubble lên đến router error boundary
**Then** hiển thị ErrorBoundary: "Có lỗi xảy ra, vui lòng thử lại" + nút "Tải lại trang"
**And** error được `console.error()` ra dev tools

**Given** user click "Về Dashboard" trên trang 404
**Then** navigate về `/dashboard`

**Given** user click "Tải lại trang" trên ErrorBoundary
**Then** `window.location.reload()` được gọi

*(URL redirects từ old routes sẽ được implement trong Story 8-6 cùng với URL restructure — xem ghi chú bên dưới)*

---

## Tasks / Subtasks

- [x] Tạo `src/components/not-found.tsx` (AC: #1, #3)
  - [x] Hiển thị "Trang không tồn tại"
  - [x] Sub-text ngắn gọn: "URL này không tồn tại hoặc đã bị xóa"
  - [x] Nút "Về Dashboard" → `navigate({ to: ROUTES.app.dashboard })`
  - [x] Style nhất quán: `flex min-h-svh flex-col items-center justify-center gap-4`

- [x] Tạo `src/components/error-page.tsx` (AC: #2, #4)
  - [x] Nhận prop `error` từ TanStack Router (`ErrorComponentProps`)
  - [x] `console.error('[ErrorBoundary]', error)` khi render
  - [x] Hiển thị "Có lỗi xảy ra" + nút "Tải lại trang"
  - [x] Nút → `window.location.reload()`

- [x] Update `src/main.tsx` — thêm vào `createRouter()` (AC: #1, #2)
  - [x] Import `NotFoundPage` từ `@/components/not-found`
  - [x] Import `ErrorPage` từ `@/components/error-page`
  - [x] Thêm `defaultNotFoundComponent: NotFoundPage`
  - [x] Thêm `defaultErrorComponent: ErrorPage`

---

## Dev Notes

### Trạng thái hiện tại

`src/main.tsx` — `createRouter()` không có error/notfound config:
```typescript
const router = createRouter({
  routeTree,
  context: { queryClient, supabase },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  // ← thiếu defaultNotFoundComponent và defaultErrorComponent
})
```
→ URL lạ = màn hình trắng hoàn toàn; component crash = app chết.

### Implementation — `src/main.tsx`

```typescript
import { NotFoundPage } from '@/components/not-found'
import { ErrorPage } from '@/components/error-page'

const router = createRouter({
  routeTree,
  context: { queryClient, supabase },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  defaultNotFoundComponent: NotFoundPage,   // THÊM
  defaultErrorComponent: ErrorPage,          // THÊM
})
```

### Implementation — `src/components/not-found.tsx`

```typescript
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/lib/routes'

export function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className='flex min-h-svh flex-col items-center justify-center gap-4 p-4 text-center'>
      <h1 className='text-2xl font-semibold'>Trang không tồn tại</h1>
      <p className='text-muted-foreground text-sm'>URL này không tồn tại hoặc đã bị xóa</p>
      <Button onClick={() => void navigate({ to: ROUTES.app.dashboard })}>
        Về Dashboard
      </Button>
    </div>
  )
}
```

### Implementation — `src/components/error-page.tsx`

TanStack Router truyền `{ error, info?, reset }` vào `defaultErrorComponent`. Dùng type `ErrorComponentProps`:

```typescript
import type { ErrorComponentProps } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

export function ErrorPage({ error }: ErrorComponentProps) {
  console.error('[ErrorBoundary]', error)

  return (
    <div className='flex min-h-svh flex-col items-center justify-center gap-4 p-4 text-center'>
      <h1 className='text-2xl font-semibold'>Có lỗi xảy ra</h1>
      <p className='text-muted-foreground text-sm'>
        Vui lòng tải lại trang hoặc quay lại sau
      </p>
      <Button onClick={() => window.location.reload()}>
        Tải lại trang
      </Button>
    </div>
  )
}
```

**Lưu ý `ErrorComponentProps`**: import từ `@tanstack/react-router`, không tự định nghĩa type.

### Về URL Redirects — Tách sang Story 8-6

Redirect `/schedule` → `/my-schedule`, `/dashboard` cũ → `/team-schedule`, `/my-dashboard` → `/dashboard` **phải thực hiện trong Story 8-6** (Wave 2), không phải story này.

**Lý do:** Các redirect targets (`/my-schedule`, `/team-schedule`) chưa tồn tại cho đến khi 8-6 đổi tên routes. Nếu thêm redirect trong Wave 1:
- `/schedule` → `/my-schedule` (chưa có) = 404 loop
- `/dashboard` → `/team-schedule` (chưa có) = 404

**Pattern cho dev agent 8-6** (không implement ở đây, chỉ để reference):
```typescript
// Thêm vào 8-6 khi rename routes — tạo redirect route files cũ
// src/routes/_app/schedule.tsx (old) → redirect về /my-schedule (new)
export const Route = createFileRoute('/_app/schedule')({
  beforeLoad: () => { throw redirect({ to: '/my-schedule', replace: true }) }
})
```

### Không làm

- ❌ KHÔNG sửa `src/routes/__root.tsx` — tránh conflict với 8-2-page-title-fix (cùng Wave 1)
- ❌ KHÔNG implement URL redirect routes trong story này — defer sang 8-6
- ❌ KHÔNG thêm Sentry hay error reporting service (post-MVP)
- ❌ KHÔNG import nặng vào error-page.tsx — component phải render được trong mọi tình huống
- ❌ KHÔNG dùng `useNavigate` trong ErrorPage — khi app crash, router state có thể không ổn định; `window.location.reload()` an toàn hơn

### Test thủ công

```
1. URL không tồn tại:
   - Navigate đến /abc/xyz → thấy "Trang không tồn tại" + nút "Về Dashboard"
   - Navigate đến /team/something-random → cùng kết quả
   - Click "Về Dashboard" → về /dashboard

2. Component crash (tạm test):
   - Thêm `throw new Error('test')` vào bất kỳ component page
   - Navigate đến page đó → thấy "Có lỗi xảy ra" + nút "Tải lại trang"
   - Console có "[ErrorBoundary] Error: test"
   - Click "Tải lại trang" → page reload
   - Xóa throw sau khi test xong
```

### Project Structure Notes

Files tạo mới (2 files):
- `src/components/not-found.tsx` — NEW
- `src/components/error-page.tsx` — NEW

File thay đổi (1 file):
- `src/main.tsx` — thêm 2 options vào `createRouter()`

File KHÔNG thay đổi (tránh conflict với 8-2-page-title-fix):
- `src/routes/__root.tsx`

### References

- [Source: src/main.tsx#L12-L17] — `createRouter()` config hiện tại cần update
- [Source: src/routes/__root.tsx] — KHÔNG sửa file này (Wave 1 conflict avoidance)
- [Source: src/lib/routes.ts] — `ROUTES.app.dashboard` cho NotFoundPage
- [Source: sprint-change-proposal-2026-03-25.md#8-19] — Yêu cầu gốc
- TanStack Router docs: `defaultNotFoundComponent`, `defaultErrorComponent`, `ErrorComponentProps`

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-5 (2026-03-25)

### Debug Log References

_Không có lỗi trong quá trình implement._

### Completion Notes List

- Tạo `src/components/not-found.tsx`: component NotFoundPage với layout `flex min-h-svh`, nút navigate đến ROUTES.app.dashboard via useNavigate.
- Tạo `src/components/error-page.tsx`: component ErrorPage nhận `ErrorComponentProps` từ @tanstack/react-router, console.error '[ErrorBoundary]', nút reload qua `window.location.reload()`.
- Update `src/main.tsx`: thêm 2 imports và 2 options (`defaultNotFoundComponent`, `defaultErrorComponent`) vào createRouter().
- TypeScript check (`tsc --noEmit`) PASS không có lỗi.
- Không sửa `src/routes/__root.tsx` theo đúng yêu cầu story (tránh conflict với 8-2).

### File List

- `src/components/not-found.tsx` — NEW
- `src/components/error-page.tsx` — NEW
- `src/main.tsx` — MODIFIED (thêm imports + 2 createRouter options)
---

## Change Log

| Date | Change |
|------|--------|
| 2026-03-25 | Story implemented: tạo NotFoundPage, ErrorPage, update createRouter() trong main.tsx |
