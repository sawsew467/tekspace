# Story 9.1: Fix Login Redirect Bug — `[object Object]` trong URL

Status: done
Epic: 9 — Product Quality & Feature Completion
Story ID: 9.1
Story Key: 9-1-login-redirect-fix
Created: 2026-03-26

---

## Story

Là một user,
tôi muốn được redirect đúng trang sau khi đăng nhập,
để không bị lỗi 404 với URL kiểu `/dashboard[object Object]`.

---

## Acceptance Criteria

**Given** user chưa login và truy cập một protected route (vd: `/daily-report`)
**When** user hoàn tất đăng nhập
**Then** user được redirect đến đúng URL trước đó (không phải `/dashboard[object Object]`)

**Given** user login từ sign-in page trực tiếp (không có redirect param)
**When** login thành công
**Then** user được redirect đến `/dashboard` (default)

**Given** redirect-back param tồn tại trong URL
**When** param được parse và dùng
**Then** param luôn là string hợp lệ — không bao giờ stringify object thành `[object Object]`

**Given** protected route có query string (vd: `/incidents?status=pending`)
**When** session expire và user redirect về sign-in
**Then** redirect param bao gồm cả query string: `/sign-in?redirect=%2Fincidents%3Fstatus%3Dpending`
**And** sau khi login thành công, user landing đúng `/incidents?status=pending`

---

## Tasks / Subtasks

- [x] Fix `src/routes/_app/route.tsx` — thay `location.search` bằng `location.searchStr` (AC: #1, #3, #4)
  - [x] Tìm 3 nơi trong file có `location.pathname + location.search` (lines ~33, ~42, ~55)
  - [x] Thay từng chỗ: `location.pathname + location.search` → `location.pathname + location.searchStr`
  - [x] Verify TypeScript không báo lỗi (`searchStr: string` trong `ParsedLocation`)
  - [x] Không thay đổi bất kỳ logic nào khác trong file

---

## Dev Notes

### Root Cause — Tại sao xảy ra `[object Object]`

Story 8-18 implement redirect-back bằng cách pass `search: { redirect: location.pathname + location.search }`. Nhưng trong TanStack Router, `location.search` là **parsed object** (không phải string):

```typescript
// ParsedLocation type từ @tanstack/router-core:
interface ParsedLocation<TSearchObj extends AnySchema = {}> {
  pathname: string
  search: TSearchObj        // ← OBJECT (parsed từ query string)
  searchStr: string         // ← STRING (raw query string, có dấu ?)
  href: string
  hash: string
  // ...
}
```

Kết quả:
```typescript
// BUG: location.search là object {}
location.pathname + location.search
// => '/daily-report' + {}
// => '/daily-report[object Object]'    ← BUG!

// FIX: location.searchStr là string
location.pathname + location.searchStr
// => '/daily-report' + ''
// => '/daily-report'                   ← CORRECT (khi không có query)

// => '/incidents' + '?status=pending'
// => '/incidents?status=pending'       ← CORRECT (khi có query)
```

**`searchStr` luôn là string** — empty string `''` khi không có query params, hoặc `'?foo=bar'` (bao gồm dấu `?`) khi có query params.

### Chỉ cần sửa 1 file — `src/routes/_app/route.tsx`

Bug xảy ra ở **đúng 3 dòng** trong file này:

```typescript
// TRƯỚC (BUG) — 3 chỗ giống nhau:
search: { redirect: location.pathname + location.search },

// SAU (FIX) — thay cả 3:
search: { redirect: location.pathname + location.searchStr },
```

**Vị trí chính xác trong file hiện tại:**

```typescript
// Line ~33 (trong if userError.status === 401 || isNoSession):
throw redirect({
  to: ROUTES.signIn,
  search: { redirect: location.pathname + location.searchStr },  // FIX
})

// Line ~42 (trong if !user):
throw redirect({
  to: ROUTES.signIn,
  search: { redirect: location.pathname + location.searchStr },  // FIX
})

// Line ~55 (trong if !session):
throw redirect({
  to: ROUTES.signIn,
  search: { redirect: location.pathname + location.searchStr },  // FIX
})
```

### Các file KHÔNG cần thay đổi

Story 8-18 đã implement đúng các phần sau — **không chạm vào**:

- `src/routes/sign-in.tsx` — `validateSearch: z.object({ redirect: z.string().max(2000).optional() })` ✓
- `src/features/auth/components/SignInForm.tsx` — đọc redirect param đúng, validate `isValidRedirectPath()`, navigate logic đúng ✓
- `src/lib/utils.ts` — `isInternalUrl()` helper đã hardened, chống open redirect ✓

### Không làm

- ❌ KHÔNG thay đổi logic khác trong `_app/route.tsx` (getUser, getSession, tenant check...)
- ❌ KHÔNG thay đổi `sign-in.tsx`, `SignInForm.tsx`, `utils.ts`
- ❌ KHÔNG thêm test file mới — bug fix đơn giản, test thủ công là đủ
- ❌ KHÔNG thêm migration DB hay thay đổi stores

### Test thủ công sau khi fix

```
1. Redirect-back không có query string:
   - Logout (hoặc xóa localStorage sb-*)
   - Navigate thẳng vào /incidents
   - URL thành /sign-in?redirect=%2Fincidents (encoded)
   - Đăng nhập → navigate về /incidents ✓ (không phải /dashboard hoặc /incidents[object Object])

2. Redirect-back có query string:
   - Xóa localStorage sb-*
   - Navigate vào /incidents?status=pending
   - URL thành /sign-in?redirect=%2Fincidents%3Fstatus%3Dpending
   - Đăng nhập → navigate về /incidents?status=pending ✓

3. Login bình thường (không có redirect param):
   - Vào /sign-in trực tiếp → đăng nhập → về /dashboard ✓

4. Kiểm tra 3 redirect paths:
   - Xóa session → vào protected route → 401 path → redirect đúng ✓
   - Xóa localStorage → vào protected route → no user path → redirect đúng ✓
   - Thêm network disconnect test (session null path) nếu có thể ✓
```

### Project Structure Notes

File duy nhất thay đổi:
- `src/routes/_app/route.tsx` — fix 3 dòng `location.search` → `location.searchStr`

Không có:
- DB migration
- Store changes
- New components
- Test files
- Environment variables

### References

- `src/routes/_app/route.tsx` — 3 dòng có bug: `location.pathname + location.search`
- `node_modules/@tanstack/router-core/dist/esm/location.d.ts` — `ParsedLocation.searchStr: string` (confirmed)
- Story 8-18 (`_bmad-output/implementation-artifacts/8-18-auth-hardening.md`) — context của implementation gốc
- `sprint-change-proposal-2026-03-26.md#Story-9-1` — yêu cầu gốc
- TanStack Router v1.141.2 — version đang dùng

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (2026-03-26)

### Debug Log References

_Không có blocking issue — root cause đã phân tích rõ trước khi implement (ParsedLocation type verified từ node_modules)._

### Completion Notes List

- ✅ Fix `_app/route.tsx`: Thay `location.search` → `location.searchStr` ở 3 nơi (lines 33, 42, 55). `location.search` là parsed object trong TanStack Router → stringify thành `[object Object]`. `location.searchStr` là raw string (vd: `'?status=pending'` hoặc `''`). TypeScript và ESLint pass clean.

### File List

- `src/routes/_app/route.tsx`

### Change Log

- 2026-03-26: Fix Story 9-1 — thay `location.search` (object) bằng `location.searchStr` (string) ở 3 dòng redirect trong `_app/route.tsx`, ngăn URL thành `/dashboard[object Object]`
