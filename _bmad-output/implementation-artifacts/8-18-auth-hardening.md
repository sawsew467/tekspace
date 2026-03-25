# Story 8.18: Auth Hardening — getUser() + Redirect-back sau Login

Status: review
Epic: 8 — UX Polish & Feature Completeness
Story ID: 8.18
Story Key: 8-18-auth-hardening
Created: 2026-03-25

---

## Story

Là một user,
tôi muốn bị redirect về đúng trang tôi đang xem khi session expire và đăng nhập lại,
và tôi muốn auth check được verify với server để tránh bypass bằng token giả/cũ.

---

## Acceptance Criteria

**Given** user đang ở `/daily-report` và session expire (hoặc token bị revoke)
**When** `_app/route.tsx` beforeLoad chạy với `getUser()` → server trả về lỗi
**Then** user bị redirect về `/sign-in?redirect=%2Fdaily-report`

**Given** user ở `/sign-in?redirect=%2Fdaily-report` và đăng nhập thành công
**When** sign-in hoàn thành
**Then** navigate về `/daily-report` (URL cũ), không phải `/dashboard`

**Given** redirect param là URL external (vd: `https://evil.com` hoặc `//evil.com`)
**When** user đăng nhập thành công
**Then** redirect param bị bỏ qua → navigate về `/dashboard` (chống open redirect)

**Given** user vào `/sign-in` trực tiếp (không có redirect param)
**When** đăng nhập thành công
**Then** navigate về `/dashboard` như hiện tại

**Given** token bị admin revoke server-side (`admin.signOut(userId)`)
**When** user navigate sang trang _app bất kỳ (beforeLoad trigger)
**Then** `getUser()` call lên server → detect revocation → redirect sign-in ngay
*(trường hợp này đã có toast "phiên bị thu hồi" từ onAuthStateChange — giữ nguyên)*

---

## Tasks / Subtasks

- [x] Fix `_app/route.tsx` — thêm `getUser()` + redirect search param (AC: #1, #5)
  - [x] Thêm call `context.supabase.auth.getUser()` TRƯỚC `getSession()`
  - [x] Nếu `userError || !user` → throw redirect với `search: { redirect: location.pathname }`
  - [x] Giữ nguyên `getSession()` bên dưới để lấy `session.access_token` cho `initFromSession`
  - [x] Kết hợp cả hai check: nếu `getUser()` OK nhưng `getSession()` null → cũng redirect

- [x] Thêm `validateSearch` vào `/sign-in` route (AC: #1, #2, #3, #4)
  - [x] Import `z` từ `zod` (đã có trong project)
  - [x] `validateSearch: z.object({ redirect: z.string().optional() })`

- [x] Update `SignInForm` — đọc redirect param và navigate đúng chỗ (AC: #2, #3, #4)
  - [x] Đọc `redirect` param qua `Route.useSearch()` (hoặc `useSearch({ from: '/sign-in' })`)
  - [x] Sau `initTenantAndGetRoute(session)` thành công: validate redirect param
  - [x] Thêm helper `isInternalUrl()` để validate internal-only redirect
  - [x] Navigate về redirect URL nếu valid, về `defaultRoute` nếu không

---

## Dev Notes

### Root Cause — Tại sao `getSession()` không đủ

Hiện tại `_app/route.tsx`:
```typescript
const { data: { session }, error } = await context.supabase.auth.getSession()
```

**`getSession()` chỉ đọc từ local storage** — không gọi Supabase server. Nếu:
- Admin revoke token qua dashboard
- Token bị tamper
- JWT claim cũ (race condition sau role change)

→ `getSession()` vẫn trả về session hợp lệ → user bypass auth check!

**`getUser()`** gọi `GET /auth/v1/user` trực tiếp lên Supabase API → server verify token → detect revocation ngay lập tức.

**Trade-off:** `getUser()` là network call → latency cao hơn. Acceptable vì chỉ chạy khi route transition (không phải mỗi render).

### Implementation — `src/routes/_app/route.tsx`

```typescript
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context, location }) => {
    // FIX 8-18: getUser() verify với server thay vì chỉ đọc cache
    const { data: { user }, error: userError } = await context.supabase.auth.getUser()

    if (userError || !user) {
      throw redirect({
        to: ROUTES.signIn,
        search: { redirect: location.pathname },  // FIX 8-18: lưu URL hiện tại
      })
    }

    // Vẫn cần getSession() để lấy access_token cho JWT claims
    // (getUser() không trả về session/access_token)
    const { data: { session } } = await context.supabase.auth.getSession()
    if (!session) {
      throw redirect({ to: ROUTES.signIn, search: { redirect: location.pathname } })
    }

    // Giữ nguyên các dòng bên dưới — không thay đổi
    useAuthStore.getState().setSession(session)
    useTenantStore.getState().initFromSession(session.access_token)

    const { activeTenantId } = useTenantStore.getState()
    const p = location.pathname
    const isOnCreateTenant = p === ROUTES.app.createTenant || p === ROUTES.app.createTenant + '/'
    if (!activeTenantId && !isOnCreateTenant) {
      throw redirect({ to: ROUTES.app.createTenant })
    }
  },
  component: AppLayout,
})
```

**Lưu ý quan trọng:**
- Không bỏ `getSession()` — cần `access_token` để decode JWT claims trong `initFromSession`
- Khi `_app/route.tsx` redirect, `location.pathname` là trang user đang cố vào (vd: `/daily-report`)
- `search: { redirect: location.pathname }` → URL encode tự động thành `?redirect=%2Fdaily-report`

### Implementation — `src/routes/sign-in.tsx`

Thêm `validateSearch` để TypeScript biết kiểu của search params:

```typescript
import { z } from 'zod'

export const Route = createFileRoute('/sign-in')({
  validateSearch: z.object({
    redirect: z.string().optional(),
  }),
  head: () => ({
    meta: [{ title: 'Đăng nhập — TekSpace' }],
  }),
  beforeLoad: async ({ context }) => {
    // Giữ nguyên hoàn toàn
    const { data: { session } } = await context.supabase.auth.getSession()
    if (session) {
      useTenantStore.getState().initFromSession(session.access_token)
      const { tenants } = useTenantStore.getState()
      throw redirect({
        to: tenants.length > 0 ? ROUTES.app.dashboard : ROUTES.app.createTenant,
      })
    }
  },
  component: SignInPage,
})
```

### Implementation — `src/features/auth/components/SignInForm.tsx`

```typescript
import { useNavigate } from '@tanstack/react-router'
import { Route } from '@/routes/sign-in'  // import Route từ file route để useSearch typed

export function SignInForm() {
  const [isPending, setIsPending] = useState(false)
  const navigate = useNavigate()
  const { redirect: redirectParam } = Route.useSearch()  // typed từ validateSearch

  const onSubmit = async (data: SignInInput) => {
    setIsPending(true)
    try {
      const { session } = await signIn(data.email, data.password)
      if (!session) throw new Error('Không thể tạo session')

      const defaultRoute = initTenantAndGetRoute(session)

      // FIX 8-18: navigate về URL cũ nếu có redirect param hợp lệ
      const destination = isInternalUrl(redirectParam) ? redirectParam : defaultRoute
      await navigate({ to: destination })
    } catch (err: unknown) {
      // ... giữ nguyên error handling
    } finally {
      setIsPending(false)
    }
  }
  // ... giữ nguyên JSX
}
```

### Helper `isInternalUrl()`

Thêm vào `src/lib/utils.ts` (file đã tồn tại, export thêm function):

```typescript
/**
 * Validate URL chỉ chấp nhận internal relative paths.
 * Chống open redirect attack: từ chối external URL, double-slash, protocol-relative.
 */
export function isInternalUrl(url: string | undefined): url is string {
  if (!url || typeof url !== 'string') return false
  // Chỉ chấp nhận paths bắt đầu bằng /
  // Từ chối: //evil.com, http://evil.com, https://...
  return url.startsWith('/') && !url.startsWith('//')
}
```

### Edge Cases cần lưu ý

1. **`/create-tenant` không nên bị redirect-back**: Nếu user chưa có tenant, `_app/route.tsx` redirect về `/create-tenant`. Sau onboarding xong navigate về `/dashboard` là đúng. Không cần handle.

2. **`redirect` param khi đã login**: Nếu user đã login vào `/sign-in?redirect=...`, `beforeLoad` của sign-in sẽ redirect về dashboard (logic hiện tại). Redirect param trong trường hợp này bị ignore — acceptable behavior.

3. **URL encoding**: TanStack Router tự encode/decode search params — không cần `encodeURIComponent` thủ công.

4. **Trùng với `onAuthStateChange` toast**: Story 1.7 đã có toast "phiên bị thu hồi" khi `SIGNED_OUT` event. Story này không thay đổi logic đó — 2 cơ chế tồn tại song song (toast + redirect là bổ sung nhau).

### Không làm

- ❌ KHÔNG bỏ `getSession()` sau `getUser()` — vẫn cần để lấy `access_token`
- ❌ KHÔNG cache kết quả `getUser()` — phải gọi mới mỗi route transition để detect revocation
- ❌ KHÔNG thêm redirect-back cho `/forgot-password`, `/reset-password` (flows không cần)
- ❌ KHÔNG thêm `validateSearch` cho `_app/route.tsx` — redirect đi sign-in chứ không nhận param

### Test thủ công

```
1. Session expire → redirect-back:
   - Đang ở /daily-report
   - Xóa localStorage `sb-*` (simulate expire)
   - Navigate sang /incidents → URL thành /sign-in?redirect=%2Fincidents
   - Đăng nhập → navigate về /incidents ✓

2. Đăng nhập bình thường (không có redirect):
   - Vào /sign-in trực tiếp → đăng nhập → về /dashboard ✓

3. Open redirect attack:
   - Vào /sign-in?redirect=https://evil.com → đăng nhập → về /dashboard ✓
   - Vào /sign-in?redirect=//evil.com → đăng nhập → về /dashboard ✓

4. Server-side revocation:
   - Revoke user session qua Supabase Dashboard
   - Navigate sang bất kỳ _app route → redirect sign-in ✓
```

### Project Structure Notes

Files thay đổi:
- `src/routes/_app/route.tsx` — thêm `getUser()` call + `search: { redirect }` param
- `src/routes/sign-in.tsx` — thêm `validateSearch: z.object({ redirect: z.string().optional() })`
- `src/features/auth/components/SignInForm.tsx` — đọc redirect param, navigate đúng chỗ
- `src/lib/utils.ts` — thêm `isInternalUrl()` helper

Không thay đổi DB, migration, store, hay permissions.

### References

- [Source: src/routes/_app/route.tsx#L18] — `getSession()` hiện tại cần thay bằng `getUser()`
- [Source: src/routes/sign-in.tsx] — cần thêm `validateSearch`
- [Source: src/features/auth/components/SignInForm.tsx#L37-L39] — navigate logic cần update
- [Source: src/lib/utils.ts] — thêm `isInternalUrl()`
- [Source: src/features/auth/services/auth.service.ts#L47] — `initTenantAndGetRoute()` giữ nguyên
- [Source: sprint-change-proposal-2026-03-25.md#8-18] — Yêu cầu gốc

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-5 (2026-03-25)

### Debug Log References

_Không có blocking issue — implementation straightforward theo Dev Notes._

### Completion Notes List

- ✅ Task 1: `_app/route.tsx` — Thay `getSession()` check bằng `getUser()` để server-verify token. Giữ `getSession()` sau để lấy `access_token` cho `initFromSession`. Cả hai redirect đều pass `search: { redirect: location.pathname }`.
- ✅ Task 2: `sign-in.tsx` — Thêm `validateSearch: z.object({ redirect: z.string().optional() })` + import `z` từ zod. `beforeLoad` giữ nguyên không thay đổi.
- ✅ Task 3+4: `SignInForm.tsx` + `utils.ts` — Thêm `isInternalUrl()` helper (chống open redirect: accept `/path`, reject `//evil.com` và `https://...`). `SignInForm` đọc `redirectParam` qua `Route.useSearch()`, navigate về redirect URL nếu valid, defaultRoute nếu không. TypeScript và ESLint pass clean.

### File List

- `src/routes/_app/route.tsx` — thêm `getUser()` call + `search: { redirect }` param khi redirect
- `src/routes/sign-in.tsx` — import `z`, thêm `validateSearch`
- `src/features/auth/components/SignInForm.tsx` — đọc redirect param, import `isInternalUrl`, navigate đúng chỗ
- `src/lib/utils.ts` — thêm `isInternalUrl()` helper

### Change Log

- 2026-03-25: Implement Story 8-18 — Auth Hardening: `getUser()` server-verify + redirect-back sau login + chống open redirect
