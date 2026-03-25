# Story 8.1: Bug Fix — Remove Member & Role Change

Status: done
Epic: 8 — UX Polish & Feature Completeness
Story ID: 8.1
Story Key: 8-1-bug-remove-member-role-fix
Created: 2026-03-25

---

## Story

As an Owner or Manager,
I want remove member, promote, and demote actions to apply immediately and reliably,
So that team access control works correctly without requiring manual page reload or re-login.

---

## Acceptance Criteria

**Given** Owner/Manager click "Xóa khỏi team" cho một member
**When** Edge Function `remove-member` hoàn thành
**Then** member bị xóa thành công khỏi tenant (status = `inactive`)
**And** session của member bị invalidate ngay lập tức (`signOut` hoạt động)
**And** Owner/Manager thấy toast "Đã xóa [tên] khỏi team"
**And** action được ghi vào `member_audit_logs` với `actor_id` và `timestamp`

**Given** Owner click "Nâng lên Manager" cho một member
**When** Edge Function `promote-member` hoàn thành thành công
**Then** role được cập nhật thành `manager` trong DB (`tenant_members.role`)
**And** JWT của caller được refresh ngay (`supabase.auth.refreshSession()`)
**And** `tenant_roles` trong JWT mới phản ánh role mới của member được promote
**And** toast "Đã nâng [tên] lên Manager" xuất hiện
**And** action được ghi vào `member_audit_logs`

**Given** Owner click "Hạ xuống Member" cho một manager
**When** action hoàn thành thành công
**Then** role được cập nhật thành `member` trong DB
**And** JWT của caller được refresh ngay
**And** toast "Đã hạ [tên] xuống Member" xuất hiện
**And** action được ghi vào `member_audit_logs` với actor_id

**Given** Owner thực hiện Transfer Ownership
**When** transfer hoàn thành
**Then** ownership được chuyển đúng
**And** cả caller lẫn target đều nhận được JWT refresh khi cần

---

## Tasks / Subtasks

- [x] Task 1: Fix `remove-member` Edge Function — thay `signOut(userId)` bằng REST API đúng
  - [x] 1a. Sửa `supabase/functions/remove-member/index.ts` — dùng fetch tới `/auth/v1/admin/users/{userId}/logout`
  - [x] 1b. Wrap trong try/catch để không crash nếu user đã sign out

- [x] Task 2: Tạo `demote-member` Edge Function
  - [x] 2a. Tạo file `supabase/functions/demote-member/index.ts`
  - [x] 2b. Validate: caller là owner, target đang là active manager
  - [x] 2c. UPDATE role → member, INSERT audit_log với action='demote_manager'

- [x] Task 3: Fix `demoteToMember()` service — dùng Edge Function + JWT refresh
  - [x] 3a. Sửa `src/features/tenant/services/tenant.service.ts` hàm `demoteToMember()`
  - [x] 3b. Route qua Edge Function 'demote-member'
  - [x] 3c. Thêm `supabase.auth.refreshSession()` sau khi thành công

- [x] Task 4: Thêm JWT refresh vào `promoteToManager()` service
  - [x] 4a. Sửa `promoteToManager()` thêm `await supabase.auth.refreshSession()` sau Edge Function call

- [x] Task 5: Thêm JWT refresh vào `transferOwnership()` service
  - [x] 5a. Sửa `transferOwnership()` thêm `await supabase.auth.refreshSession()` sau Edge Function call

---

## Dev Agent Record

### Implementation Plan

1. Fix remove-member Edge Function signOut bug (userId vs JWT issue)
2. Create demote-member Edge Function (mirror promote-member)
3. Refactor demoteToMember service to use Edge Function
4. Add JWT refresh after promote/demote/transfer

### Debug Log

**Root Cause Analysis:**
- `remove-member`: `supabaseAdmin.auth.admin.signOut(userId)` nhận JWT string, không phải UUID → function crash sau DB update → 500 response dù member đã bị set inactive
- `demoteToMember`: Direct DB client call, thiếu audit log + không detect silent RLS block
- Tất cả role-change operations thiếu `refreshSession()` → JWT cũ → RLS dùng role cũ sau change

**Fix:**
- Task 1: Dùng REST endpoint `/auth/v1/admin/users/{id}/logout` (DELETE) để revoke tất cả sessions theo userId
- Task 2: Tạo `demote-member` Edge Function — mirror `promote-member`, validates caller=owner, target=manager
- Task 3: `demoteToMember()` route qua Edge Function + `refreshSession()` sau thành công
- Task 4: `promoteToManager()` thêm `refreshSession()` sau Edge Function
- Task 5: `transferOwnership()` thêm `refreshSession()` sau Edge Function

### Completion Notes

Implemented 5 tasks covering all 4 ACs:
- AC1 (remove member): Fixed signOut → REST API `/auth/v1/admin/users/{id}/logout`, wrapped in try/catch, DB update + audit log intact
- AC2 (promote): Added `refreshSession()` → JWT updates immediately after role change
- AC3 (demote): Created `demote-member` Edge Function + refactored service to use it + `refreshSession()`
- AC4 (transfer): Added `refreshSession()` after ownership transfer
- All existing 269 tests pass, `tsc --noEmit` = 0 errors

---

## File List

- `supabase/functions/remove-member/index.ts` — modified: replaced `auth.admin.signOut(userId)` with REST API call
- `supabase/functions/demote-member/index.ts` — created: new Edge Function for demote-manager action with audit log
- `src/features/tenant/services/tenant.service.ts` — modified: demoteToMember() uses Edge Function, promoteToManager/demoteToMember/transferOwnership all add refreshSession()

---

## Change Log

- 2026-03-25: Fix remove-member Edge Function signOut bug (userId vs JWT API mismatch)
- 2026-03-25: Create demote-member Edge Function with server-side validation + audit log
- 2026-03-25: Refactor demoteToMember() to use Edge Function instead of direct DB call
- 2026-03-25: Add refreshSession() after promote/demote/transfer to sync JWT claims

---

## ⚠️ CRITICAL CONTEXT — Đọc trước khi implement

### Root Cause Analysis

Dựa trên code review hiện tại, có **3 vấn đề** cần fix:

#### Vấn đề 1: `demoteToMember()` — Thiếu audit log + JWT refresh

**File hiện tại:** `src/features/tenant/services/tenant.service.ts`

```typescript
// CURRENT (broken — thiếu audit log, thiếu JWT refresh, không qua Edge Function)
export const demoteToMember = async (userId: string, tenantId: string) => {
  const { error } = await supabase
    .from('tenant_members')
    .update({ role: 'member' })
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
  if (error) throw error
}
```

**Vấn đề:**
- Không có audit log → vi phạm "tất cả log actor + timestamp" AC
- Không có JWT refresh sau khi thay đổi role → RLS context cũ, UI không update đúng
- Không có validation server-side (chỉ dựa vào RLS)

#### Vấn đề 2: Thiếu JWT refresh sau promote/demote

Sau khi `promoteToManager()` hoặc `demoteToMember()` thành công:
- JWT vẫn chứa `tenant_roles` cũ → RLS operations tiếp theo dùng role cũ
- Phải gọi `supabase.auth.refreshSession()` để lấy JWT mới có claims đúng
- Pattern này đã có trong `createTenant()` — dùng lại

#### Vấn đề 3: `remove-member` Edge Function

Cần **điều tra Edge Function logs** trước khi fix. Kiểm tra:
- CORS headers đầy đủ chưa?
- Service role key được truyền đúng không?
- `auth.admin.signOut(userId)` đang dùng Supabase Admin API format đúng chưa?

---

### Kiến trúc hiện tại: Edge Functions + JWT flow

```
Frontend
  ↓ (client anon key)
Supabase Edge Function
  ↓ (service role key — an toàn server-side)
DB + auth.admin.signOut()

JWT Custom Claims (via custom_access_token_hook):
  {
    "active_tenant_id": "<uuid>",
    "tenant_roles": { "<tenant_id>": "owner|manager|member" }
  }
```

**JWT là source of truth cho RLS** — sau khi thay đổi role, phải refresh JWT để RLS nhận đúng role mới.

---

### Files cần sửa

#### 1. Tạo Edge Function mới: `supabase/functions/demote-member/index.ts`

Pattern 100% giống `promote-member/index.ts`, chỉ khác logic:

```typescript
// Validate: chỉ Owner mới được demote (nhất quán với promote)
// Target phải đang là 'manager'
// UPDATE tenant_members SET role = 'member'
// INSERT member_audit_logs với action = 'role_changed', details = { from: 'manager', to: 'member' }
// INSERT notification cho target user
```

Hoặc nếu muốn dùng trực tiếp (không tạo Edge Function mới):
→ Fix `demoteToMember()` trong `tenant.service.ts` để thêm audit log và dùng pattern RLS detection (`.select('id').single()`).

**Khuyến nghị:** Tạo Edge Function để nhất quán với `promote-member` và đảm bảo audit log server-side.

#### 2. Fix `src/features/tenant/services/tenant.service.ts`

Thêm JWT refresh sau `promoteToManager()`:
```typescript
export const promoteToManager = async (userId: string, tenantId: string): Promise<void> => {
  const { data, error } = await supabase.functions.invoke('promote-member', {
    body: { userId, tenantId },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)

  // THÊM: Refresh JWT để tenant_roles claim được cập nhật
  await supabase.auth.refreshSession()
}
```

Tương tự cho `demoteToMember()`.

#### 3. Fix `src/features/tenant/hooks/use-promote-member.ts`

Sau khi mutation succeed, invalidate thêm tenantStore nếu cần:
```typescript
onSuccess: () => {
  toast.success(`Đã nâng ${memberName} lên Manager`)
  queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.tenantMembers, activeTenantId] })
  // JWT đã được refresh trong service — tenantStore sẽ cập nhật qua session listener
}
```

#### 4. Tương tự `src/features/tenant/hooks/use-demote-member.ts`

#### 5. Điều tra `supabase/functions/remove-member/index.ts`

**Bước 1:** Kiểm tra Edge Function logs trong Supabase Dashboard (Local: `supabase functions serve`)

**Bước 2:** Verify các điểm dễ lỗi:
```typescript
// ✅ Verify Deno import đúng version
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ✅ Verify service role key được đọc đúng
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// ✅ Verify signOut format đúng (v2 API)
await supabaseAdmin.auth.admin.signOut(userId)
// KHÔNG phải: supabaseAdmin.auth.admin.signOut({ userId })
```

**Bước 3:** Verify auth header truyền đúng từ frontend:
```typescript
// src/features/tenant/services/tenant.service.ts
const { data, error } = await supabase.functions.invoke('remove-member', {
  body: { userId, tenantId },
  // Không cần headers — Supabase client tự đính JWT
})
```

---

### Patterns bắt buộc tuân theo

| Pattern | Mô tả |
|---------|-------|
| **P-02** | `.select('id').single()` sau mọi UPDATE client-side để detect RLS block |
| **Named exports** | Không dùng `export default` |
| **Không tạo Supabase client mới** | Dùng singleton `supabase-browser.ts` |
| **Edge Functions** | Chỉ dùng Service Role Key trong Edge Functions, không bao giờ expose client |
| **Audit log** | Mọi role change phải INSERT `member_audit_logs` với `actor_id` |

---

### Không làm

- ❌ KHÔNG sửa RLS policies (đã đúng rồi — RLS không phải nguyên nhân chính)
- ❌ KHÔNG xóa `remove-member` Edge Function — fix bugs bên trong
- ❌ KHÔNG bỏ qua JWT refresh — đây là root cause khiến role change không "apply ngay"
- ❌ KHÔNG tạo thêm Supabase client instances

---

### Test thủ công sau fix

```
1. Owner remove member:
   - member được redirect về sign-in (session invalidated)
   - member_audit_logs có record mới

2. Owner promote member → manager:
   - member list refresh, role hiện "Manager"
   - Không cần F5 page
   - member_audit_logs có record

3. Owner demote manager → member:
   - Tương tự promote
   - member_audit_logs có record

4. Transfer ownership:
   - Cả 2 users nhận role mới đúng
```

---

### Git recent context

- Story 7-3 (done): incident management với audit trail — tham khảo pattern `member_audit_logs` INSERT nếu cần
- Epic 1 (done): toàn bộ auth flows đã stable — đừng break session management
