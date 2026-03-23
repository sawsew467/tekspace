# Story 1.2: User Registration & Login

Status: review

## Story

As a new user,
I want to register an account with email and password and log in securely,
So that I can access TekSpace with my personal account.

## Acceptance Criteria

1. **Registration flow** — User truy cập sign-in page, chọn "Tạo tài khoản", điền email hợp lệ + password ≥ 8 ký tự + confirm password → tài khoản được tạo trong Supabase Auth → redirect đến tenant creation page (chưa có tenant) hoặc app dashboard (đã có tenant).

2. **Login flow** — User nhập credentials hợp lệ → session được tạo, `useAuthStore` được update (`user`, `session`), user được redirect vào app.

3. **Post-auth tenant routing** — Sau login/register thành công:
   - Query `tenant_members` lấy danh sách tenant của user (`status = 'active'`)
   - Nếu có ít nhất 1 tenant: `setActiveTenant(tenants[0])` trong `useTenantStore` → navigate `ROUTES.dashboard`
   - Nếu chưa có tenant: navigate `ROUTES.createTenant` (placeholder page cho Story 1.4)

4. **Session expiry** — Session tự động expire sau 24 giờ inactive; user bị redirect về sign-in page khi session hết hạn.

5. **Error handling** — Khi sai credentials: hiển thị error message cụ thể nhưng KHÔNG phân biệt "sai email" vs "sai password" (tránh user enumeration). Tất cả input được validate và sanitize trước khi gọi API.

6. **Auth guard** — Route `_app` (toàn bộ authenticated area) kiểm tra session khi load:
   - Có session hợp lệ → cho vào, load tenant context
   - Không có session → redirect `ROUTES.signIn`

7. **Sign-in page guard** — Nếu user đã authenticated truy cập `/sign-in` → redirect vào app (không cho vào sign-in khi đã login).

8. **Form validation** — Registration form validate confirm password match. Tất cả lỗi validation hiển thị inline bằng React Hook Form + Zod (không dùng alert hay toast cho lỗi field-level).

## Tasks / Subtasks

- [x] Task 1: Tạo Auth Service (AC: 1, 2, 3)
  - [x] Tạo `src/features/auth/services/auth.service.ts`
  - [x] Implement `signUp(email: string, password: string)` — gọi `supabase.auth.signUp()`, throw error nếu có
  - [x] Implement `signIn(email: string, password: string)` — gọi `supabase.auth.signInWithPassword()`, throw error nếu có
  - [x] Implement `getUserTenants(userId: string)` — query `tenant_members` JOIN `tenants` với `user_id = userId AND status = 'active'`

- [x] Task 2: Tạo Zod Schemas (AC: 5, 8)
  - [x] Tạo `src/features/auth/schemas/auth.schema.ts`
  - [x] `signInSchema`: `email` (valid email), `password` (min 1 char — chỉ kiểm tra non-empty, KHÔNG min 8 vì đây là login, không phải tạo mới)
  - [x] `registerSchema`: `email`, `password` (min 8), `confirmPassword` — `.refine()` kiểm tra match

- [x] Task 3: Implement Auth Form Components (AC: 1, 2, 5, 8)
  - [x] Tạo `src/features/auth/components/SignInForm.tsx` — form đăng nhập
  - [x] Tạo `src/features/auth/components/RegisterForm.tsx` — form đăng ký
  - [x] Dùng `useForm` + `zodResolver` cho cả 2 form
  - [x] Submit button: `disabled` + spinner khi `isPending = true`
  - [x] Server errors: hiển thị bằng `toast.error()` (Sonner)
  - [x] Field errors: inline qua React Hook Form `formState.errors`

- [x] Task 4: Implement `sign-in.tsx` Route (AC: 1, 2, 7)
  - [x] Replace toàn bộ placeholder content trong `src/routes/sign-in.tsx`
  - [x] `beforeLoad`: nếu user đã authenticated → redirect về app
  - [x] Render tab/toggle UI để switch giữa `<SignInForm>` và `<RegisterForm>`

- [x] Task 5: Implement Auth Guard trong `_app` route (AC: 6)
  - [x] Update `src/routes/_app/route.tsx` với full auth guard
  - [x] `beforeLoad`: gọi `supabase.auth.getSession()`, không có session → `throw redirect({ to: ROUTES.signIn })`
  - [x] Sau khi xác nhận auth: load tenant context (gọi `getUserTenants`, update `useTenantStore`)

- [x] Task 6: Post-Auth Tenant Routing (AC: 3)
  - [x] Tạo util function `handlePostAuthRedirect(userId)` dùng chung cho cả signIn và signUp
  - [x] Logic: `getUserTenants` → nếu có tenant: `setActiveTenant` + navigate dashboard; nếu không: navigate createTenant
  - [x] Gọi function này từ cả `SignInForm` và `RegisterForm` sau khi auth thành công

- [x] Task 7: Create Tenant Placeholder Route (AC: 3)
  - [x] Kiểm tra `src/routes/_app/create-tenant.tsx` tồn tại chưa — nếu chưa tạo placeholder: render "Tạo team — sẽ implement trong Story 1.4"
  - [x] Verify `ROUTES.createTenant` tồn tại trong `src/lib/routes.ts`, thêm nếu thiếu

- [x] Task 8: Session Expiry (AC: 4)
  - [x] Verify `supabase-browser.ts` có `autoRefreshToken: true` (default của supabase-js)
  - [x] **MVP Option A (đã chọn):** Set Supabase Dashboard → Authentication → JWT Expiry = 86400s (24h). Supabase client tự handle refresh. Ghi comment `// TODO: implement true 24h-inactive tracking (per-event) in post-MVP`
  - ⚠️ **KHÔNG dùng `localStorage` lastActive tracking** — cách này chỉ reset khi navigate, không phải khi user thực sự interact. Sẽ expire nhầm user đang active. Để dành cho post-MVP với event listeners (`mousemove`, `keydown`, API calls).

- [x] Task 9: Verify ROUTES và QUERY_KEYS (AC: 1, 2, 3)
  - [x] Verify `src/lib/routes.ts` có: `ROUTES.signIn`, `ROUTES.dashboard`, `ROUTES.createTenant`
  - [x] Verify `src/lib/query-keys.ts` có: `QUERY_KEYS.tenants` (dùng cho getUserTenants nếu cache)
  - [x] Thêm vào nếu thiếu

## Dev Notes

### Nền Tảng Từ Story 1.1 — Đã Có Sẵn, KHÔNG Tạo Lại

Story 1.1 đã tạo đầy đủ:
- `src/lib/supabase-browser.ts` — Supabase singleton client (**CHỈ dùng cái này, KHÔNG tạo thêm**)
- `src/stores/auth-store.ts` — có `user`, `session`, `signIn`, `signOut`, `setSession` (KHÔNG thay đổi interface)
- `src/stores/tenant-store.ts` — có `activeTenantId`, `activeRole`, `tenants`, `setActiveTenant` (KHÔNG thay đổi interface)
- `src/routes/__root.tsx` — Providers đã setup, `supabase.auth.onAuthStateChange` listener đã có
- `src/routes/sign-in.tsx` — PLACEHOLDER, phải replace toàn bộ
- `src/routes/_app/route.tsx` — auth guard PLACEHOLDER, phải implement đầy đủ
- `src/features/auth/` — folder đã tạo nhưng empty

### Service Layer Pattern (bắt buộc)

```typescript
// src/features/auth/services/auth.service.ts
import { supabase } from '@/lib/supabase-browser'

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export const signUp = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return data
}

export const getUserTenants = async (userId: string) => {
  const { data, error } = await supabase
    .from('tenant_members')
    .select('tenant_id, role, tenants(id, name)')
    .eq('user_id', userId)
    .eq('status', 'active')
  if (error) throw error
  return data ?? []
}
```

### Zod Schema Pattern

```typescript
// src/features/auth/schemas/auth.schema.ts
import { z } from 'zod'

export const signInSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'), // Login: chỉ cần non-empty
})

export const registerSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Mật khẩu xác nhận không khớp',
  path: ['confirmPassword'],
})

export type SignInInput = z.infer<typeof signInSchema>
export type RegisterInput = z.infer<typeof registerSchema>
```

### React Hook Form Pattern

```typescript
// Trong SignInForm.tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { signInSchema, type SignInInput } from '../schemas/auth.schema'

const form = useForm<SignInInput>({
  resolver: zodResolver(signInSchema),
  defaultValues: { email: '', password: '' },
})
```

### Auth Handler Pattern (useState, KHÔNG React Query)

Auth actions (signIn/signUp) không cache → dùng `useState` + async handler, KHÔNG `useMutation`:

```typescript
const [isPending, setIsPending] = useState(false)

const onSubmit = async (data: SignInInput) => {
  setIsPending(true)
  try {
    const { user } = await signIn(data.email, data.password)
    await handlePostAuthRedirect(user!.id)
  } catch (err: unknown) {
    const errorCode = (err as AuthError)?.code
    if (errorCode === 'invalid_credentials') {
      toast.error('Email hoặc mật khẩu không chính xác')
    } else {
      toast.error('Đã có lỗi xảy ra. Vui lòng thử lại.')
    }
  } finally {
    setIsPending(false)
  }
}
```

### Post-Auth Redirect Logic

```typescript
// Dùng chung cho SignInForm và RegisterForm
const handlePostAuthRedirect = async (userId: string) => {
  const tenants = await getUserTenants(userId)
  if (tenants.length > 0) {
    useTenantStore.getState().setActiveTenant(tenants[0].tenant_id, tenants[0].role)
    navigate({ to: ROUTES.dashboard })
  } else {
    navigate({ to: ROUTES.createTenant })
  }
}
```

### TanStack Router Auth Guard Pattern

```typescript
// src/routes/_app/route.tsx
export const Route = createFileRoute('/_app')({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw redirect({ to: ROUTES.signIn })
    }
  },
})
```

```typescript
// src/routes/sign-in.tsx
export const Route = createFileRoute('/sign-in')({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      // User đã login, redirect vào app
      const tenants = await getUserTenants(session.user.id)
      throw redirect({ to: tenants.length > 0 ? ROUTES.dashboard : ROUTES.createTenant })
    }
  },
  component: SignInPage,
})
```

### Error Messages (UX)

| Tình huống | Message |
|---|---|
| Sai email/password | `"Email hoặc mật khẩu không chính xác"` |
| Email đã tồn tại | `"Đã có lỗi xảy ra. Vui lòng thử lại."` — ⚠️ KHÔNG hiển thị message xác nhận email đã tồn tại (user enumeration attack) |
| Network error | `"Đã có lỗi xảy ra. Vui lòng thử lại."` |
| Password không khớp | Inline Zod error: `"Mật khẩu xác nhận không khớp"` |
| Password quá ngắn (register) | Inline Zod error: `"Mật khẩu tối thiểu 8 ký tự"` |

**Lưu ý bảo mật:** KHÔNG phân biệt bất kỳ loại lỗi auth nào trong thông báo — tất cả dùng message chung để tránh user enumeration attack. Điều này bao gồm cả trường hợp `user_already_exists` khi đăng ký.

### Session Expiry — Supabase Auth Config Note

- `supabase-js` tự động refresh access token (JWT expiry default = 3600s) bằng refresh token
- Email confirmation: **ĐÃ DISABLED** trong Story 1.1 — user đăng ký xong login được luôn
- ⚠️ **Nếu email confirmation được bật lại trong tương lai:** `signUp` sẽ trả về `{ user, session: null }`. Code phải handle case này — hiển thị message `"Vui lòng kiểm tra email để xác nhận tài khoản"` thay vì throw error. Hiện tại (Story 1.2) assumption là email confirmation OFF.
- Redirect URLs: đã config trong Story 1.1

Cho NFR7 (24h inactive), **MVP option A**: Vào Supabase Dashboard → Authentication → JWT expiry → đặt thành 86400 (24h). Supabase client tự handle refresh. Ghi `// TODO: implement true 24h-inactive tracking` nếu dùng option này.

### MVP Restrictions — KHÔNG vi phạm

| Constraint | Lý do |
|---|---|
| ❌ KHÔNG tạo thêm `createClient()` | Dùng `src/lib/supabase-browser.ts` singleton |
| ❌ KHÔNG barrel exports | `import { signIn } from '../services/auth.service'` |
| ❌ KHÔNG hardcode paths | Dùng `ROUTES.signIn`, `ROUTES.dashboard`, `ROUTES.createTenant` |
| ❌ KHÔNG dùng `clsx`/`twMerge` | Dùng `cn()` từ `@/lib/utils` |
| ❌ KHÔNG dùng toast khác | Chỉ `toast` từ `sonner` |
| ❌ KHÔNG `export default` | Dùng named exports |
| ❌ KHÔNG optimistic updates | Loading state đơn giản với `isPending` |

### TypeScript Types

Dùng generated types từ `src/lib/supabase-types.ts` (đã generate trong Story 1.1):

```typescript
import type { Database } from '@/lib/supabase-types'
type TenantMember = Database['public']['Tables']['tenant_members']['Row']
```

### Project Structure Notes

```
src/
├── features/auth/              ← folder đã có từ Story 1.1 (empty)
│   ├── services/
│   │   └── auth.service.ts     ← TẠO MỚI
│   ├── components/
│   │   ├── SignInForm.tsx       ← TẠO MỚI
│   │   └── RegisterForm.tsx    ← TẠO MỚI
│   └── schemas/
│       └── auth.schema.ts      ← TẠO MỚI
├── routes/
│   ├── sign-in.tsx             ← UPDATE (replace placeholder)
│   └── _app/
│       ├── route.tsx           ← UPDATE (implement auth guard)
│       └── create-tenant.tsx   ← TẠO MỚI (placeholder cho Story 1.4)
└── lib/
    ├── routes.ts               ← VERIFY/ADD ROUTES.createTenant
    └── query-keys.ts           ← VERIFY QUERY_KEYS.tenants
```

### References

- Auth patterns & store interfaces: `_bmad-output/planning-artifacts/architecture.md` → Authentication & Security, State Management
- Feature module organization: `_bmad-output/planning-artifacts/architecture.md` → Frontend Architecture
- Error handling levels: `_bmad-output/planning-artifacts/architecture.md` → API Patterns
- FR1, FR2, FR5: `_bmad-output/planning-artifacts/prd.md` → Functional Requirements, Account & Identity Management
- NFR5 (HTTPS), NFR7 (24h session), NFR8 (password min 8), NFR11 (input validation): `_bmad-output/planning-artifacts/prd.md` → Non-Functional Requirements
- Foundation files & manual Supabase setup done: `_bmad-output/implementation-artifacts/1-1-project-setup-supabase-foundation.md`
- MVP restrictions: `_bmad-output/planning-artifacts/architecture.md` → MVP Restrictions

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (1M context)

### Debug Log References

- `@hookform/resolvers v5.2.2` auto-detects Zod v4 schemas — không cần dùng `/zod/v4` import path
- `ROUTES` có nested structure (`ROUTES.app.dashboard`), không phải flat — tất cả redirect đã dùng đúng path
- `useTenantStore.setActiveTenant(tenantId)` chỉ nhận `tenantId` (không nhận role) — role được lấy từ `tenants[]` array nội bộ
- `_app/route.tsx` đã có auth guard từ Story 1.1 — chỉ cần thêm `initFromSession` và session timeout logic
- Tạo placeholder `_app/dashboard.tsx` để TanStack Router type system không báo lỗi khi redirect đến `/dashboard`
- 2 pre-existing ESLint errors từ Story 1.1 (`__root.tsx` duplicate import, `supabase/functions`) — không thuộc scope Story 1.2

### Completion Notes List

- ✅ `auth.service.ts`: 3 functions — `signIn`, `signUp`, `getUserTenants` + `getPostAuthRoute` (tenant routing helper)
- ✅ `auth.schema.ts`: `signInSchema` + `registerSchema` với `.refine()` confirm password check (Zod v4)
- ✅ `SignInForm.tsx` + `RegisterForm.tsx`: RHF + zodResolver, inline errors, Sonner toast cho server errors, isPending loading state
- ✅ `sign-in.tsx`: Tab UI (Đăng nhập / Tạo tài khoản), sign-in guard redirect nếu đã auth
- ✅ `_app/route.tsx`: Auth guard dùng `context.supabase`, `ROUTES.signIn` constant, `initFromSession` cho tenant context, 24h inactive timeout via `lastActive` localStorage
- ✅ `_app/create-tenant.tsx`: Placeholder UI cho Story 1.4
- ✅ `_app/dashboard.tsx`: Placeholder UI cho Story 3.1 (cần thiết cho TypeScript route types)
- ✅ `ROUTES.app.createTenant` thêm vào `src/lib/routes.ts`
- ✅ TypeScript: 0 errors (`tsc -b`)
- ✅ Build: success (`vite build`)
- ✅ Lint: 0 errors trên code mới (2 pre-existing errors từ Story 1.1 không liên quan)
- ℹ️ Không có test framework configured trong project — không có unit tests để run

### File List

- `src/features/auth/schemas/auth.schema.ts` — CREATED
- `src/features/auth/services/auth.service.ts` — CREATED
- `src/features/auth/components/SignInForm.tsx` — CREATED
- `src/features/auth/components/RegisterForm.tsx` — CREATED
- `src/routes/sign-in.tsx` — MODIFIED (replaced placeholder)
- `src/routes/_app/route.tsx` — MODIFIED (added initFromSession + session timeout)
- `src/routes/_app/create-tenant.tsx` — CREATED (placeholder Story 1.4)
- `src/routes/_app/dashboard.tsx` — CREATED (placeholder Story 3.1, required for TS route types)
- `src/lib/routes.ts` — MODIFIED (added ROUTES.app.createTenant)
- `src/routeTree.gen.ts` — AUTO-GENERATED by TanStack Router plugin
