# Story 1.3: Password Management

Status: review

## Story

As a user,
I want to reset my forgotten password via email and change my password while logged in,
So that I can always regain and maintain secure access to my account.

## Acceptance Criteria

1. **Forgot password flow** — User ở sign-in page click "Quên mật khẩu?" → redirect `/forgot-password` → nhập email → submit → Supabase gửi recovery email (qua Resend SMTP đã configure) với link có thời hạn 1 giờ → hiển thị success message (KHÔNG tiết lộ email có tồn tại hay không — tránh user enumeration).

2. **Reset password với link hợp lệ** — User click recovery link còn hiệu lực → redirect `{VITE_APP_URL}/reset-password#access_token=xxx&type=recovery` → Supabase client tự parse hash → nhập password mới (≥ 8 ký tự) + confirm → `supabase.auth.updateUser()` cập nhật password → toast success → redirect sign-in.

3. **Reset password với link hết hạn/đã dùng** — User click expired/used link → redirect `/reset-password?error=access_denied&...` → hiển thị message: "Link đã hết hạn. Vui lòng yêu cầu reset password lại." + link quay về `/forgot-password`.

4. **Change password (đã đăng nhập)** — User ở `/settings/profile` → điền `currentPassword` + `newPassword` (≥ 8 ký tự) + `confirmNewPassword` → re-auth để verify current password → `updateUser` → toast success "Đổi mật khẩu thành công".

5. **Sai current password** — Khi current password sai → inline error dưới field `currentPassword`: "Mật khẩu hiện tại không đúng". Password KHÔNG thay đổi, user không bị logout.

6. **Form validation** — Tất cả form validate và sanitize input (Zod) trước khi gọi API. Password mismatch hiển thị inline Zod error. Lỗi field-level KHÔNG dùng toast. Lỗi server dùng `toast.error()` từ `sonner`.

7. **Settings structure** — `src/routes/_app/settings/route.tsx` tồn tại như layout. `src/routes/_app/settings/profile.tsx` chứa change password form. `src/routes/_app/settings/team.tsx` tồn tại như placeholder "Cài đặt nhóm — sẽ implement trong Story 1.4".

## Tasks / Subtasks

- [x] Task 1: Extend Auth Service (AC: 1, 2, 4, 5)
  - [x] Thêm `requestPasswordReset(email: string)` vào `src/features/auth/services/auth.service.ts`
  - [x] Thêm `updatePassword(newPassword: string)` vào auth.service.ts
  - [x] Thêm `verifyAndChangePassword(email, currentPassword, newPassword)` vào auth.service.ts

- [x] Task 2: Extend Auth Schemas (AC: 6)
  - [x] Thêm `forgotPasswordSchema`, `ForgotPasswordInput` vào `src/features/auth/schemas/auth.schema.ts`
  - [x] Thêm `resetPasswordSchema`, `ResetPasswordInput`
  - [x] Thêm `changePasswordSchema`, `ChangePasswordInput`

- [x] Task 3: Tạo ForgotPasswordForm component (AC: 1, 6)
  - [x] Tạo `src/features/auth/components/ForgotPasswordForm.tsx`
  - [x] Dùng `PasswordInput` component KHÔNG áp dụng ở đây (chỉ email field)
  - [x] Sau submit thành công: hiển thị success state thay vì form

- [x] Task 4: Tạo ResetPasswordForm component (AC: 2, 6)
  - [x] Tạo `src/features/auth/components/ResetPasswordForm.tsx`
  - [x] Dùng `PasswordInput` từ `src/components/password-input.tsx` cho cả 2 password fields
  - [x] Sau submit thành công: toast success + navigate sign-in

- [x] Task 5: Tạo ChangePasswordForm component (AC: 4, 5, 6)
  - [x] Tạo `src/features/auth/components/ChangePasswordForm.tsx`
  - [x] Dùng `PasswordInput` cho tất cả 3 password fields (currentPassword, newPassword, confirmNewPassword)
  - [x] `form.setError('currentPassword', ...)` cho sai current password — KHÔNG toast

- [x] Task 6: Tạo /forgot-password route (AC: 1)
  - [x] Tạo `src/routes/forgot-password.tsx`
  - [x] Render ForgotPasswordForm trong card layout tương tự sign-in.tsx

- [x] Task 7: Tạo /reset-password route (AC: 2, 3)
  - [x] Tạo `src/routes/reset-password.tsx`
  - [x] Implement `validateSearch` để detect `error` / `error_description` từ Supabase redirect
  - [x] Nếu có `error` param → render expired message; ngược lại → render ResetPasswordForm

- [x] Task 8: Tạo Settings routes (AC: 4, 5, 7)
  - [x] Tạo `src/routes/_app/settings/route.tsx` — settings layout với navigation tabs (Profile / Nhóm)
  - [x] Tạo `src/routes/_app/settings/profile.tsx` — render ChangePasswordForm (và profile info placeholder)
  - [x] Tạo `src/routes/_app/settings/team.tsx` — placeholder "Cài đặt nhóm — sẽ implement trong Story 1.4"

- [x] Task 9: Update SignInForm — thêm "Quên mật khẩu?" link (AC: 1)
  - [x] Sửa `src/features/auth/components/SignInForm.tsx`
  - [x] Thêm `<Link to={ROUTES.forgotPassword}>Quên mật khẩu?</Link>` bên dưới password field, dùng TanStack Router `Link`

- [x] Task 10: Update ROUTES (AC: 1, 2)
  - [x] Thêm `forgotPassword: '/forgot-password'` vào `src/lib/routes.ts` (top-level, không trong `app`)
  - [x] Thêm `resetPassword: '/reset-password'` (top-level)
  - [x] Verify `ROUTES.app.settings.profile` và `ROUTES.app.settings.team` đã tồn tại (ĐÃ CÓ — không cần thêm)

## Dev Notes

### Foundation từ Story 1.1 & 1.2 — ĐÃ CÓ SẴN, KHÔNG TẠO LẠI

| File | Trạng thái | Ghi chú |
|------|-----------|---------|
| `src/lib/supabase-browser.ts` | ✅ singleton | **CHỈ dùng cái này**, KHÔNG createClient() thêm |
| `src/stores/auth-store.ts` | ✅ có user, session | Dùng `useAuthStore.getState().user?.email` để lấy email |
| `src/features/auth/services/auth.service.ts` | ✅ có signIn, signUp | THÊM VÀO, không viết lại |
| `src/features/auth/schemas/auth.schema.ts` | ✅ có signInSchema, registerSchema | THÊM VÀO, không viết lại |
| `src/features/auth/components/SignInForm.tsx` | ✅ cần sửa nhỏ | Chỉ thêm "Quên mật khẩu?" link |
| `src/lib/routes.ts` | ✅ có settings.profile & team | THÊM forgotPassword, resetPassword |
| `src/components/password-input.tsx` | ✅ đã có sẵn | Dùng cho tất cả password input fields! |

### Supabase Password Reset Flow — Bắt buộc nắm rõ

```
1. Client gọi: supabase.auth.resetPasswordForEmail(email, { redirectTo: `${VITE_APP_URL}/reset-password` })
   → Supabase gửi email (qua Resend SMTP được config ở Supabase Dashboard)
   → Email chứa link dạng: https://<project>.supabase.co/auth/v1/verify?...&redirect_to=.../reset-password

2. User click link hợp lệ:
   → Browser redirect đến: /reset-password#access_token=xxx&token_type=bearer&type=recovery
   → Supabase JS client (singleton từ supabase-browser.ts) tự parse URL hash
   → Thiết lập recovery session

3. User click link hết hạn/đã dùng:
   → Browser redirect đến: /reset-password?error=access_denied&error_code=otp_expired&error_description=...
   → KHÔNG có hash, CÓ query params

4. App nhận diện case expired qua URL search params (không phải hash)
   → TanStack Router validateSearch để parse error param

5. Cập nhật password khi có recovery session:
   → supabase.auth.updateUser({ password: newPassword })
```

### Auth Service — Các function cần thêm

```typescript
// THÊM VÀO src/features/auth/services/auth.service.ts (KHÔNG xóa code cũ)

export const requestPasswordReset = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${import.meta.env.VITE_APP_URL}/reset-password`,
  })
  if (error) throw error
}

export const updatePassword = async (newPassword: string) => {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}

// Verify current password rồi đổi sang password mới
// Pattern: re-auth với signInWithPassword để verify, rồi updateUser
// Throw 'INVALID_CURRENT_PASSWORD' nếu current password sai
export const verifyAndChangePassword = async (
  email: string,
  currentPassword: string,
  newPassword: string,
) => {
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  })
  if (signInError) {
    // Ném lỗi có code để component phân biệt case
    throw Object.assign(new Error('Mật khẩu hiện tại không đúng'), {
      code: 'INVALID_CURRENT_PASSWORD',
    })
  }
  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
  if (updateError) throw updateError
}
```

### Auth Schemas — Thêm vào auth.schema.ts

```typescript
// THÊM VÀO src/features/auth/schemas/auth.schema.ts (KHÔNG xóa code cũ)

export const forgotPasswordSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
})

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  })

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
    newPassword: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự'),
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmNewPassword'],
  })

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
```

### PasswordInput Component — BẮT BUỘC dùng

Component `src/components/password-input.tsx` đã có sẵn với show/hide toggle. Dùng thay vì `<Input type="password">` cho tất cả password fields trong story này:

```typescript
import { PasswordInput } from '@/components/password-input'

// Trong FormField render:
<FormControl>
  <PasswordInput placeholder='••••••••' autoComplete='new-password' {...field} />
</FormControl>
```

### ForgotPasswordForm Pattern

```typescript
// src/features/auth/components/ForgotPasswordForm.tsx
export function ForgotPasswordForm() {
  const [isPending, setIsPending] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  })

  const onSubmit = async (data: ForgotPasswordInput) => {
    setIsPending(true)
    try {
      await requestPasswordReset(data.email)
      setIsSuccess(true)  // Hiển thị success state
    } catch {
      // KHÔNG tiết lộ lỗi cụ thể — bảo mật
      // Vẫn show success để tránh user enumeration
      setIsSuccess(true)
    } finally {
      setIsPending(false)
    }
  }

  if (isSuccess) {
    return (
      <div>Nếu email tồn tại trong hệ thống, bạn sẽ nhận được email đặt lại mật khẩu.</div>
      // + Link quay về sign-in
    )
  }

  // Render email form + submit button
}
```

**Lý do show success kể cả khi lỗi:** Tránh user enumeration attack (không để attacker biết email nào tồn tại).

### ResetPasswordForm Pattern

```typescript
// src/features/auth/components/ResetPasswordForm.tsx
export function ResetPasswordForm() {
  const [isPending, setIsPending] = useState(false)
  const navigate = useNavigate()
  const form = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema), ... })

  const onSubmit = async (data: ResetPasswordInput) => {
    setIsPending(true)
    try {
      await updatePassword(data.password)
      toast.success('Đặt lại mật khẩu thành công. Vui lòng đăng nhập.')
      await navigate({ to: ROUTES.signIn })
    } catch {
      toast.error('Đã có lỗi xảy ra. Vui lòng yêu cầu reset password lại.')
    } finally {
      setIsPending(false)
    }
  }
  // Render 2 PasswordInput fields (password, confirmPassword)
}
```

### /reset-password Route — validateSearch cho expired link

```typescript
// src/routes/reset-password.tsx
export const Route = createFileRoute('/reset-password')({
  validateSearch: (search: Record<string, unknown>) => ({
    error: typeof search['error'] === 'string' ? search['error'] : undefined,
    error_description:
      typeof search['error_description'] === 'string' ? search['error_description'] : undefined,
  }),
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const { error } = Route.useSearch()

  if (error) {
    return (
      // Layout tương tự forgot-password page (card, centered)
      // Message: "Link đã hết hạn. Vui lòng yêu cầu reset password lại."
      // Link: <Link to={ROUTES.forgotPassword}>Yêu cầu lại</Link>
    )
  }

  return <ResetPasswordForm />
}
```

### ChangePasswordForm Pattern

```typescript
// src/features/auth/components/ChangePasswordForm.tsx
export function ChangePasswordForm() {
  const [isPending, setIsPending] = useState(false)
  const form = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema), ... })

  const onSubmit = async (data: ChangePasswordInput) => {
    const email = useAuthStore.getState().user?.email
    if (!email) return  // Should not happen in authenticated context

    setIsPending(true)
    try {
      await verifyAndChangePassword(email, data.currentPassword, data.newPassword)
      toast.success('Đổi mật khẩu thành công')
      form.reset()
    } catch (err: unknown) {
      const typedErr = err as { code?: string }
      if (typedErr?.code === 'INVALID_CURRENT_PASSWORD') {
        // Inline error — KHÔNG toast
        form.setError('currentPassword', { message: 'Mật khẩu hiện tại không đúng' })
      } else {
        toast.error('Đã có lỗi xảy ra. Vui lòng thử lại.')
      }
    } finally {
      setIsPending(false)
    }
  }
  // Render 3 PasswordInput fields (currentPassword, newPassword, confirmNewPassword)
}
```

### Thêm "Quên mật khẩu?" link vào SignInForm

```typescript
// src/features/auth/components/SignInForm.tsx
// Thêm import Link từ @tanstack/react-router
import { useNavigate, Link } from '@tanstack/react-router'

// Sau password FormField và trước Submit button:
<div className='text-right'>
  <Link to={ROUTES.forgotPassword} className='text-sm text-muted-foreground hover:underline'>
    Quên mật khẩu?
  </Link>
</div>
```

### Settings Route Layout

```typescript
// src/routes/_app/settings/route.tsx
// Layout đơn giản với 2 tab: Profile và Nhóm
// Dùng <Link> đến ROUTES.app.settings.profile và ROUTES.app.settings.team
// Kế thừa auth guard từ _app/route.tsx (không cần thêm guard riêng)
```

**Lưu ý:** ROUTES.app.settings.profile = '/settings/profile' và .team = '/settings/team' đã tồn tại trong routes.ts hiện tại — không cần thêm.

### ROUTES Update

```typescript
// src/lib/routes.ts — chỉ THÊM 2 keys này, giữ nguyên phần còn lại
export const ROUTES = {
  signIn: '/sign-in',
  forgotPassword: '/forgot-password',   // THÊM
  resetPassword: '/reset-password',     // THÊM
  acceptInvite: '/accept-invite',
  app: {
    // ... (giữ nguyên)
  },
} as const
```

### Page Layout Pattern — Tham chiếu từ sign-in.tsx

Tất cả public pages (forgot-password, reset-password) dùng layout tương tự sign-in.tsx:

```tsx
<div className='flex min-h-svh items-center justify-center bg-muted/40 p-4'>
  <div className='w-full max-w-sm'>
    <div className='mb-8 text-center'>
      <h1 className='text-3xl font-bold tracking-tight'>TekSpace</h1>
      {/* subtitle */}
    </div>
    <Card>
      <CardHeader><CardTitle>...</CardTitle></CardHeader>
      <CardContent>...</CardContent>
    </Card>
  </div>
</div>
```

### Error Messages (UX)

| Tình huống | Loại | Message |
|---|---|---|
| Email không đúng định dạng | Inline Zod | `"Email không hợp lệ"` |
| Password quá ngắn | Inline Zod | `"Mật khẩu tối thiểu 8 ký tự"` |
| Password không khớp | Inline Zod | `"Mật khẩu xác nhận không khớp"` |
| Quên password — submit thành công | Success state | `"Nếu email tồn tại trong hệ thống, bạn sẽ nhận được email đặt lại mật khẩu."` |
| Link hết hạn | Trang thông báo | `"Link đã hết hạn. Vui lòng yêu cầu reset password lại."` |
| Reset password thành công | Toast success | `"Đặt lại mật khẩu thành công. Vui lòng đăng nhập."` |
| Sai current password | Inline (form.setError) | `"Mật khẩu hiện tại không đúng"` |
| Đổi password thành công | Toast success | `"Đổi mật khẩu thành công"` |
| Lỗi mạng / lỗi khác | Toast error | `"Đã có lỗi xảy ra. Vui lòng thử lại."` |

**Bảo mật:** KHÔNG tiết lộ liệu email có tồn tại trong hệ thống hay không khi request reset password.

### MVP Restrictions — KHÔNG vi phạm

| Constraint | Lý do |
|---|---|
| ❌ KHÔNG tạo thêm `createClient()` | Dùng `src/lib/supabase-browser.ts` singleton |
| ❌ KHÔNG barrel exports | Import trực tiếp từ file |
| ❌ KHÔNG hardcode paths | Dùng `ROUTES.*` constant |
| ❌ KHÔNG dùng toast khác | Chỉ `toast` từ `sonner` |
| ❌ KHÔNG `export default` | Dùng named exports |
| ❌ KHÔNG optimistic updates | `isPending` state |
| ❌ KHÔNG dùng `<Input type="password">` | Dùng `<PasswordInput>` từ `src/components/password-input.tsx` |
| ❌ KHÔNG dùng `clsx`/`twMerge` trực tiếp | Dùng `cn()` từ `@/lib/utils` |
| ❌ KHÔNG tự ý tạo Edge Function cho reset email | Supabase Auth built-in + Resend SMTP (config Dashboard) |

### Project Structure — Files cần tạo/sửa

```
src/
├── features/auth/
│   ├── services/
│   │   └── auth.service.ts       ← SỬA (thêm 3 functions)
│   ├── components/
│   │   ├── SignInForm.tsx         ← SỬA (thêm "Quên mật khẩu?" link)
│   │   ├── ForgotPasswordForm.tsx ← TẠO MỚI
│   │   ├── ResetPasswordForm.tsx  ← TẠO MỚI
│   │   └── ChangePasswordForm.tsx ← TẠO MỚI
│   └── schemas/
│       └── auth.schema.ts        ← SỬA (thêm 3 schemas)
├── routes/
│   ├── sign-in.tsx               ← GIỮ NGUYÊN (SignInForm đã sửa)
│   ├── forgot-password.tsx       ← TẠO MỚI
│   ├── reset-password.tsx        ← TẠO MỚI
│   └── _app/
│       └── settings/
│           ├── route.tsx         ← TẠO MỚI (settings layout)
│           ├── profile.tsx       ← TẠO MỚI (change password)
│           └── team.tsx          ← TẠO MỚI (placeholder)
└── lib/
    └── routes.ts                 ← SỬA (thêm forgotPassword, resetPassword)
```

### Lưu ý Debug từ Story 1.2 — Vẫn áp dụng

- `@hookform/resolvers v5.2.2` auto-detects Zod v4 — KHÔNG dùng `/zod/v4` import path
- `ROUTES` có nested structure — dùng `ROUTES.app.settings.profile` (KHÔNG phải `ROUTES.settings.profile`)
- `useNavigate()` từ `@tanstack/react-router` cho navigation trong component
- `Link` component từ `@tanstack/react-router` cho static links
- `context.supabase` chỉ có trong `beforeLoad` của route — trong component/service, dùng `supabase` singleton trực tiếp
- 2 pre-existing ESLint errors từ Story 1.1 (`__root.tsx` duplicate import, `supabase/functions`) — không thuộc scope story này

### References

- FR50, FR51: `_bmad-output/planning-artifacts/prd.md` — Account & Identity Management
- NFR8 (password min 8): `_bmad-output/planning-artifacts/prd.md` → Non-Functional Requirements
- Auth service patterns & store interfaces: `_bmad-output/planning-artifacts/architecture.md` → Authentication & Security
- Settings feature structure: `_bmad-output/planning-artifacts/architecture.md` → Frontend Architecture (settings/ feature folder)
- Routes structure: `_bmad-output/planning-artifacts/architecture.md` → `src/lib/routes.ts` section
- MVP restrictions: `_bmad-output/planning-artifacts/architecture.md` → MVP Restrictions
- Foundation patterns: `_bmad-output/implementation-artifacts/1-2-user-registration-login.md` → Dev Notes

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (1M context)

### Debug Log References

- `initTenantAndGetRoute` — Story 1.2 đổi tên từ `getPostAuthRoute`; import đã đúng, không cần thay đổi
- Task 10 (ROUTES) thực hiện trước Task 6 để tránh type error khi dùng `ROUTES.forgotPassword` trong ForgotPasswordForm (compiled together)
- `settings/route.tsx` dùng `useRouterState` để detect active tab thay vì `useMatch` — phù hợp với TanStack Router v1 API
- `changePasswordSchema` dùng `max(128)` nhất quán với `registerSchema` đã có từ Story 1.2
- Chunk size warning (`index-*.js` > 500kB) là pre-existing — không thuộc scope story này

### Completion Notes List

- ✅ `auth.service.ts`: thêm `requestPasswordReset`, `updatePassword`, `verifyAndChangePassword`
- ✅ `auth.schema.ts`: thêm `forgotPasswordSchema`, `resetPasswordSchema`, `changePasswordSchema` + 3 types
- ✅ `ForgotPasswordForm.tsx`: email form + success state (anti-enumeration), link quay về sign-in
- ✅ `ResetPasswordForm.tsx`: 2x `PasswordInput`, toast success + navigate sign-in
- ✅ `ChangePasswordForm.tsx`: 3x `PasswordInput`, `form.setError` inline cho sai current password
- ✅ `forgot-password.tsx`: route + card layout nhất quán với sign-in
- ✅ `reset-password.tsx`: `validateSearch` detect `?error=` → expired message; otherwise → ResetPasswordForm
- ✅ `_app/settings/route.tsx`: layout + sidebar nav (Tài khoản / Nhóm) với active state
- ✅ `_app/settings/profile.tsx`: ChangePasswordForm trong Card
- ✅ `_app/settings/team.tsx`: placeholder "Cài đặt nhóm — sẽ implement trong Story 1.4"
- ✅ `SignInForm.tsx`: thêm Link "Quên mật khẩu?" inline với label Mật khẩu
- ✅ `routes.ts`: thêm `forgotPassword`, `resetPassword` top-level
- ✅ TypeScript: 0 errors (`tsc -b`)
- ✅ Build: success (`vite build`)
- ✅ Lint: 0 errors trên tất cả files mới/sửa
- ℹ️ Không có test framework — không có unit tests (nhất quán với Story 1.1 & 1.2)

### File List

- `src/features/auth/services/auth.service.ts` — MODIFIED (thêm 3 functions)
- `src/features/auth/schemas/auth.schema.ts` — MODIFIED (thêm 3 schemas + 3 types)
- `src/features/auth/components/ForgotPasswordForm.tsx` — CREATED
- `src/features/auth/components/ResetPasswordForm.tsx` — CREATED
- `src/features/auth/components/ChangePasswordForm.tsx` — CREATED
- `src/features/auth/components/SignInForm.tsx` — MODIFIED (thêm Link "Quên mật khẩu?")
- `src/routes/forgot-password.tsx` — CREATED
- `src/routes/reset-password.tsx` — CREATED
- `src/routes/_app/settings/route.tsx` — CREATED
- `src/routes/_app/settings/profile.tsx` — CREATED
- `src/routes/_app/settings/team.tsx` — CREATED
- `src/lib/routes.ts` — MODIFIED (thêm forgotPassword, resetPassword)
- `src/routeTree.gen.ts` — AUTO-GENERATED by TanStack Router plugin
