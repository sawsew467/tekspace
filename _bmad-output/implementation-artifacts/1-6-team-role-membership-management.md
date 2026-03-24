# Story 1.6: Team Role & Membership Management

Status: done

## Story

As an Owner,
I want to manage team membership and roles — including removing members, promoting roles, and transferring ownership,
So that the team structure always reflects current organizational reality.

## Acceptance Criteria

1. **Remove member** — Owner/Manager ở Members tab (`/settings/team`) → click "Xóa" bên cạnh member → confirm dialog "Bạn có chắc muốn xóa [name] khỏi team?" → confirm → Edge Function `remove-member` được gọi → `auth.admin.signOut(userId)` executed ngay lập tức → `tenant_members.status = 'inactive'` → INSERT notification type='member_removed' cho member bị xóa → action được INSERT vào `member_audit_logs` (actor_id, target_id, action='remove', timestamp) → UI cập nhật: member biến mất khỏi list → toast.success("Đã xóa [name] khỏi team.").

2. **Promote Member → Manager** — Owner ở Members tab → click "Phân quyền" bên cạnh một Member → confirm dialog "Nâng [name] lên Manager?" → confirm → `UPDATE tenant_members SET role = 'manager'` → INSERT member_audit_logs → toast.success("Đã nâng quyền [name] lên Manager.") → UI refresh.

3. **Transfer Ownership** — Owner ở Members tab → click "Chuyển quyền Owner" bên cạnh một Manager/Member → confirm dialog "Chuyển quyền Owner cho [name]? Bạn sẽ trở thành Manager." → confirm → `UPDATE` current owner → role='manager'; target → role='owner' (hai lệnh update liên tiếp) → INSERT member_audit_logs × 2 → toast.success("Đã chuyển quyền Owner cho [name].") → UI refresh + invalidate tenant context.

4. **Invitations tab** — `/settings/team` có tab "Lời mời" (3rd tab) hiển thị tất cả invites với columns: Email, Trạng thái (pending/accepted/expired), Ngày gửi, Actions. Owner/Manager thấy nút "Gửi lại" cho invite status=pending/expired. "Gửi lại" → gọi `resendInvite()` → invalidate old invite → create new invite với token mới, expires 48h → toast.success.

5. **Resend invite** — Owner/Manager click "Gửi lại" bên cạnh invite → UPDATE old invite `status = 'revoked'` → INSERT new invite (new token, new expires_at) → Edge Function `send-invite` gửi email mới → toast.success("Đã gửi lại lời mời đến [email].").

6. **Block sole owner account deletion** — Owner truy cập trang xóa tài khoản (nút "Xóa tài khoản" trong `/settings/profile`) → hệ thống check: `isSoleOwner()` → nếu là sole owner của bất kỳ tenant nào → hiện alert: "Bạn cần transfer ownership hoặc xóa tenant trước khi xóa tài khoản." → không cho proceed. Nếu không phải sole owner → hiện confirm dialog (stub/placeholder — actual deletion deferred to post-MVP).

7. **usePermissions hook** — Implement `src/hooks/use-permissions.ts` semantic hook để các components dùng pattern `const { canManageMembers } = usePermissions()` thay vì check `activeRole === 'owner'` trực tiếp.

8. **Can component** — Implement `src/components/can.tsx` — `<Can do="manageMembers"><InviteButton /></Can>` để guard UI elements theo permission.

## Tasks / Subtasks

- [x] Task 1: Tạo migration member_audit_logs (AC: 1, 2, 3)
  - [x] Tạo `supabase/migrations/20260324000006_create_member_audit_logs.sql`
  - [x] Columns: id (uuid pk), tenant_id (fk tenants), actor_id (fk users), target_id (fk users), action (text, e.g. 'remove'/'promote'/'transfer_ownership'), details (jsonb nullable), created_at (timestamptz)
  - [x] Thêm RLS: chỉ manager/owner mới SELECT được, INSERT qua Edge Function (service role bypass)

- [x] Task 2: Implement `remove-member` Edge Function (AC: 1)
  - [x] Sửa `supabase/functions/remove-member/index.ts`
  - [x] Parse body: `{ userId, tenantId }` — verify caller là owner/manager
  - [x] UPDATE `tenant_members` SET status='inactive' WHERE user_id=? AND tenant_id=?
  - [x] Gọi `supabaseAdmin.auth.admin.signOut(userId)` để invalidate session ngay lập tức
  - [x] INSERT vào `notifications`: type='member_removed', message="Bạn đã bị xóa khỏi [Team Name].", user_id=removedUserId, tenant_id
  - [x] INSERT vào `member_audit_logs`: actor=callerId, target=userId, action='remove'
  - [x] Return `{ ok: true }`

- [x] Task 3: Extend tenant.service.ts (AC: 1, 2, 3, 5, 6)
  - [x] Thêm `removeMember(userId: string)` → `supabase.functions.invoke('remove-member', { body: { userId, tenantId } })`
  - [x] Thêm `promoteToManager(userId: string, tenantId: string)` → UPDATE tenant_members SET role='manager'
  - [x] Thêm `transferOwnership(newOwnerId: string, tenantId: string)` → 2 UPDATE trong sequence
  - [x] Thêm `getInvites(tenantId: string)` → SELECT tenant_invites WHERE tenant_id=?
  - [x] Thêm `resendInvite(inviteId: string, tenantId: string, email: string)` → UPDATE old status='revoked' + invoke send-invite
  - [x] Thêm `isSoleOwner(userId: string)` → check xem user có là sole owner của bất kỳ tenant nào không

- [x] Task 4: Tạo use-permissions.ts hook (AC: 7)
  - [x] Tạo `src/hooks/use-permissions.ts`
  - [x] Dùng `useTenantStore` lấy `activeRole`
  - [x] Dùng `hasPermission()` từ `@/lib/permissions`
  - [x] Return object: `{ canManageMembers, canManageTenant, canManageSchedule, canCreateIncident, canViewAnalytics, ... }`

- [x] Task 5: Tạo can.tsx component (AC: 8)
  - [x] Tạo `src/components/can.tsx`
  - [x] Props: `do: Permission`, `children: ReactNode`, `fallback?: ReactNode`
  - [x] Dùng `usePermissions()` để check

- [x] Task 6: Tạo hooks (AC: 1, 2, 3, 4, 5)
  - [x] Tạo `src/features/tenant/hooks/use-remove-member.ts` → useMutation wrap removeMember()
  - [x] Tạo `src/features/tenant/hooks/use-promote-member.ts` → useMutation wrap promoteToManager()
  - [x] Tạo `src/features/tenant/hooks/use-transfer-ownership.ts` → useMutation wrap transferOwnership()
  - [x] Tạo `src/features/tenant/hooks/use-tenant-invites.ts` → useQuery wrap getInvites()
  - [x] Tạo `src/features/tenant/hooks/use-resend-invite.ts` → useMutation wrap resendInvite()

- [x] Task 7: Tạo components (AC: 1, 2, 3, 4)
  - [x] Tạo `src/features/tenant/components/RemoveMemberDialog.tsx` — confirm dialog
  - [x] Tạo `src/features/tenant/components/RoleActionDropdown.tsx` — dropdown với "Nâng lên Manager", "Chuyển quyền Owner", "Xóa"
  - [x] Tạo `src/features/tenant/components/InviteListSection.tsx` — table với invite history + resend action
  - [x] Tạo `src/features/tenant/components/TransferOwnershipDialog.tsx` — confirm dialog

- [x] Task 8: Cập nhật settings/team.tsx (AC: 1, 2, 3, 4, 5)
  - [x] Thêm Tab "Lời mời" (tab thứ 3 sau "Cài đặt nhóm" và "Thành viên")
  - [x] Thêm role management actions vào Members tab: `RoleActionDropdown` bên cạnh mỗi member (chỉ hiện cho Owner)
  - [x] Integrate `InviteListSection` vào tab "Lời mời"
  - [x] Dùng `<Can do="manageMembers">` để guard invite button và role actions

- [x] Task 9: Cập nhật settings/profile.tsx (AC: 6)
  - [x] Thêm section "Xóa tài khoản" với nút "Xóa tài khoản"
  - [x] Check `isSoleOwner()` trước khi hiện confirm dialog
  - [x] Nếu sole owner → hiện alert message, không cho proceed
  - [x] Nếu không sole owner → hiện confirm dialog (stub — chỉ UI, không gọi API thật)

## Dev Notes

### Foundation từ Các Story Trước — ĐÃ CÓ SẴN, KHÔNG TẠO LẠI

| File | Trạng thái | Ghi chú |
|------|-----------|---------|
| `src/lib/supabase-browser.ts` | ✅ singleton | **CHỈ dùng cái này** |
| `src/stores/auth-store.ts` | ✅ | Có user.id cần cho removeMember |
| `src/stores/tenant-store.ts` | ✅ có activeTenantId, activeRole | Dùng để check permissions |
| `src/lib/permissions.ts` | ✅ đầy đủ | `manageMembers` = Owner only; `manageMembers` covers invite, remove, promote |
| `src/lib/query-keys.ts` | ✅ có tenantMembers, tenantInvites | Keys đã sẵn |
| `src/components/confirm-dialog.tsx` | ✅ có sẵn | Dùng cho confirm dialogs |
| `src/features/tenant/services/tenant.service.ts` | ✅ từ Story 1.4 + 1.5 | **THÊM** functions mới |
| `src/features/tenant/hooks/use-tenant-members.ts` | ✅ từ Story 1.5 | Dùng lại |
| `src/features/tenant/components/InviteMemberDialog.tsx` | ✅ từ Story 1.5 | Dùng lại |
| `supabase/functions/_shared/supabase-admin.ts` | ✅ | Dùng trong remove-member |
| `supabase/functions/_shared/resend.ts` | ✅ | Dùng cho notification email |

### Database Schema — member_audit_logs (MỚI)

```sql
-- supabase/migrations/20260323000014_create_member_audit_logs.sql
CREATE TABLE public.member_audit_logs (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid    NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_id    uuid    REFERENCES public.users(id) ON DELETE SET NULL,
  target_id   uuid    REFERENCES public.users(id) ON DELETE SET NULL,
  action      text    NOT NULL,  -- 'remove' | 'promote_manager' | 'transfer_ownership_from' | 'transfer_ownership_to'
  details     jsonb,             -- Optional: { previousRole: 'member', newRole: 'manager' }
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_member_audit_logs_tenant_id ON public.member_audit_logs(tenant_id);
ALTER TABLE public.member_audit_logs ENABLE ROW LEVEL SECURITY;

-- Chỉ manager/owner mới SELECT được
CREATE POLICY member_audit_logs_select_policy ON public.member_audit_logs
  FOR SELECT USING (
    tenant_id = public.current_tenant_id()
    AND public.is_tenant_manager()
  );

-- INSERT chỉ qua Edge Functions (service role bypass) — KHÔNG có client INSERT policy
```

⚠️ **Lưu ý quan trọng**: `member_audit_logs` được INSERT qua Edge Functions dùng `supabaseAdmin` (service role). Không cần client-side INSERT policy.

### remove-member Edge Function — Full Implementation

```typescript
// supabase/functions/remove-member/index.ts
import { corsHeaders } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })

  const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(
    authHeader.replace('Bearer ', '')
  )
  if (authError || !caller) return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })

  const { userId, tenantId } = await req.json()

  // Verify caller is owner/manager
  const { data: callerMembership } = await supabaseAdmin
    .from('tenant_members')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', caller.id)
    .eq('status', 'active')
    .single()

  if (!callerMembership || !['owner', 'manager'].includes(callerMembership.role)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Không cho phép xóa chính mình
  if (userId === caller.id) {
    return new Response(JSON.stringify({ error: 'Không thể xóa chính bạn khỏi team.' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Get tenant name for notification
  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('name')
    .eq('id', tenantId)
    .single()

  // 1. UPDATE tenant_members → inactive
  const { error: updateError } = await supabaseAdmin
    .from('tenant_members')
    .update({ status: 'inactive' })
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
  if (updateError) throw updateError

  // 2. Invalidate session ngay lập tức
  await supabaseAdmin.auth.admin.signOut(userId)
  // Note: signOut có thể fail nếu user đã sign out trước — ignore error

  // 3. INSERT in-app notification cho user bị xóa
  await supabaseAdmin.from('notifications').insert({
    tenant_id: tenantId,
    user_id: userId,
    type: 'member_removed',
    message: `Bạn đã bị xóa khỏi ${tenant?.name ?? 'team'}.`,
    link_to: null,
  })

  // 4. INSERT audit log
  await supabaseAdmin.from('member_audit_logs').insert({
    tenant_id: tenantId,
    actor_id: caller.id,
    target_id: userId,
    action: 'remove',
    details: { tenantName: tenant?.name },
  })

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})
```

### promoteToManager và transferOwnership — Service Pattern

```typescript
// src/features/tenant/services/tenant.service.ts — Thêm vào

export const promoteToManager = async (userId: string, tenantId: string): Promise<void> => {
  // RLS: chỉ owner/manager mới update được tenant_members
  const { data, error } = await supabase
    .from('tenant_members')
    .update({ role: 'manager' })
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .select('id')
    .single()
  if (error) throw error
  if (!data) throw new Error('Update failed — check RLS policies')
  // NOTE: Audit log insert cần service role → thực hiện qua Edge Function
  // Cho MVP, skip audit log cho promote (hoặc thêm Edge Function nhỏ riêng)
}

export const transferOwnership = async (newOwnerId: string, tenantId: string, currentOwnerId: string): Promise<void> => {
  // Step 1: Demote current owner → manager
  const { error: demoteError } = await supabase
    .from('tenant_members')
    .update({ role: 'manager' })
    .eq('user_id', currentOwnerId)
    .eq('tenant_id', tenantId)
  if (demoteError) throw demoteError

  // Step 2: Promote new owner
  const { error: promoteError } = await supabase
    .from('tenant_members')
    .update({ role: 'owner' })
    .eq('user_id', newOwnerId)
    .eq('tenant_id', tenantId)
  if (promoteError) throw promoteError
  // NOTE: 2 updates không atomic → nếu step 2 fail → current owner đã bị demote
  // Cho MVP: acceptable risk. Post-MVP: dùng DB function hoặc RPC.
}

export const isSoleOwner = async (userId: string): Promise<boolean> => {
  // Check xem user có là sole owner của bất kỳ tenant nào không
  // Lấy tất cả tenants user là owner
  const { data: ownerships, error } = await supabase
    .from('tenant_members')
    .select('tenant_id')
    .eq('user_id', userId)
    .eq('role', 'owner')
    .eq('status', 'active')
  if (error) throw error
  if (!ownerships || ownerships.length === 0) return false

  // Với mỗi tenant user là owner, check có owner khác không
  for (const { tenant_id } of ownerships) {
    const { count, error: countError } = await supabase
      .from('tenant_members')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant_id)
      .eq('role', 'owner')
      .eq('status', 'active')
    if (countError) throw countError
    if (count !== null && count <= 1) return true  // sole owner!
  }
  return false
}
```

⚠️ **Lưu ý RLS khi promoteToManager và transferOwnership:**
- `tenant_members_update_policy`: `tenant_id = current_tenant_id() AND is_tenant_manager()`
- Owner và Manager đều có thể UPDATE `tenant_members` nếu `tenant_id` match JWT `active_tenant_id`
- Điều này nghĩa là story 1.7 cần hoàn thành để JWT có đúng `active_tenant_id`
- Tuy nhiên, cho user chỉ có 1 tenant (typical sau story 1.4): JWT đã có đúng `active_tenant_id` → OK
- Cho multi-tenant users: cần Story 1.7 tenant switcher

### use-permissions.ts — Semantic Hook Pattern

```typescript
// src/hooks/use-permissions.ts
import { useTenantStore } from '@/stores/tenant-store'
import { hasPermission } from '@/lib/permissions'
import type { Permission } from '@/lib/permissions'

export function usePermissions() {
  const { activeRole } = useTenantStore()

  const can = (permission: Permission): boolean => {
    if (!activeRole) return false
    return hasPermission(activeRole, permission)
  }

  return {
    canManageSchedule:    can('manageSchedule'),
    canViewTeamSchedule:  can('viewTeamSchedule'),
    canApproveSchedule:   can('approveSchedule'),
    canSubmitDailyReport: can('submitDailyReport'),
    canViewTeamDashboard: can('viewTeamDashboard'),
    canManageMembers:     can('manageMembers'),     // Owner only
    canManageTenant:      can('manageTenant'),      // Owner only
    canCreateIncident:    can('createIncident'),    // Manager + Owner
    canViewAnalytics:     can('viewAnalytics'),     // All roles
    activeRole,           // Expose raw role khi cần
  }
}
```

### can.tsx — Permission Component

```typescript
// src/components/can.tsx
import type { ReactNode } from 'react'
import { usePermissions } from '@/hooks/use-permissions'
import type { Permission } from '@/lib/permissions'

interface CanProps {
  do: Permission
  children: ReactNode
  fallback?: ReactNode
}

export function Can({ do: permission, children, fallback = null }: CanProps) {
  const permissions = usePermissions()
  const key = `can${permission.charAt(0).toUpperCase()}${permission.slice(1)}` as keyof typeof permissions
  const allowed = permissions[key] as boolean
  return allowed ? <>{children}</> : <>{fallback}</>
}
```

### Settings/team.tsx — Full Tab Structure (sau Stories 1.5 + 1.6)

```
Tabs:
├── "Cài đặt nhóm" → TeamSettingsForm (từ Story 1.4)
├── "Thành viên"   → MemberList + InviteMemberDialog (từ Story 1.5)
│                    + RoleActionDropdown cho Owner (Story 1.6)
└── "Lời mời"      → InviteListSection (Story 1.6)
```

### InviteListSection — Pattern

```typescript
// src/features/tenant/components/InviteListSection.tsx
// Hiển thị table với columns: Email, Trạng thái, Ngày gửi, Actions
// Status badge: pending=yellow, accepted=green, expired=red, revoked=gray

const statusLabel = {
  pending: 'Đang chờ',
  accepted: 'Đã chấp nhận',
  expired: 'Hết hạn',
  revoked: 'Đã thu hồi',
  declined: 'Đã từ chối',
}
```

### Error Messages (UX)

| Tình huống | Loại | Message |
|---|---|---|
| Remove member thành công | Toast success | `"Đã xóa [name] khỏi team."` |
| Không thể remove | Toast error | `"Không thể xóa thành viên. Vui lòng thử lại."` |
| Không thể tự xóa mình | Toast error | `"Không thể xóa chính bạn khỏi team."` |
| Promote thành công | Toast success | `"Đã nâng quyền [name] lên Manager."` |
| Transfer ownership thành công | Toast success | `"Đã chuyển quyền Owner cho [name]."` |
| Resend invite thành công | Toast success | `"Đã gửi lại lời mời đến [email]."` |
| Sole owner block | Alert inline | `"Bạn cần transfer ownership hoặc xóa tenant trước khi xóa tài khoản."` |

### MVP Restrictions — KHÔNG vi phạm

| Constraint | Lý do |
|---|---|
| ❌ KHÔNG dùng raw role check | Dùng `usePermissions()` hoặc `<Can do="...">` |
| ❌ KHÔNG gọi auth.admin.signOut() client-side | Chỉ trong Edge Function với service role |
| ❌ KHÔNG INSERT audit_log trực tiếp | INSERT qua Edge Function với service role |
| ❌ KHÔNG optimistic updates | Dùng isPending + invalidateQueries |
| ✅ transferOwnership: 2 sequential UPDATEs | Atomic post-MVP via DB function |
| ✅ Sau bất kỳ role change nào → invalidate tenantMembers query | Đảm bảo UI sync |

### Project Structure — Files cần tạo/sửa

```
src/
├── hooks/
│   └── use-permissions.ts                          ← TẠO MỚI
├── components/
│   └── can.tsx                                     ← TẠO MỚI
├── features/tenant/
│   ├── services/
│   │   └── tenant.service.ts                       ← SỬA (thêm removeMember, promoteToManager, transferOwnership, getInvites, resendInvite, isSoleOwner)
│   ├── hooks/
│   │   ├── use-remove-member.ts                    ← TẠO MỚI
│   │   ├── use-promote-member.ts                   ← TẠO MỚI
│   │   ├── use-transfer-ownership.ts               ← TẠO MỚI
│   │   ├── use-tenant-invites.ts                   ← TẠO MỚI
│   │   └── use-resend-invite.ts                    ← TẠO MỚI
│   └── components/
│       ├── RemoveMemberDialog.tsx                  ← TẠO MỚI
│       ├── TransferOwnershipDialog.tsx             ← TẠO MỚI
│       ├── RoleActionDropdown.tsx                  ← TẠO MỚI
│       └── InviteListSection.tsx                   ← TẠO MỚI
├── routes/
│   └── _app/settings/
│       ├── team.tsx                                ← SỬA (thêm Tab "Lời mời" + role actions)
│       └── profile.tsx                             ← SỬA (thêm Delete Account section)
supabase/
├── migrations/
│   └── 20260323000014_create_member_audit_logs.sql ← TẠO MỚI
└── functions/
    └── remove-member/
        └── index.ts                                ← SỬA (implement thực sự)
```

### Thứ tự Implementation được khuyến nghị

1. **Task 1** (migration) — DB trước
2. **Task 4** (use-permissions hook) — cần cho UI guards
3. **Task 5** (can.tsx component) — cần cho settings/team
4. **Task 2** (remove-member Edge Function) — server-side logic
5. **Task 3** (service functions) — data layer
6. **Task 6** (hooks) — wrap services
7. **Task 7** (components) — UI components
8. **Task 8** (settings/team.tsx update) — integrate
9. **Task 9** (settings/profile.tsx update) — sole owner guard

### Learnings từ Stories 1.4 + 1.5 — Vẫn áp dụng

- Edge Function: luôn verify caller với `supabaseAdmin.auth.getUser()` trước khi xử lý
- Edge Function errors cần phân biệt: business logic error (4xx) vs technical error (5xx)
- `select('id').single()` sau UPDATE để detect silent RLS-blocked updates
- `confirm-dialog.tsx` có sẵn trong `src/components/` — dùng thay vì tạo mới
- `<Can>` component chỉ là UX layer — RLS là security source of truth
- `@hookform/resolvers v5.2.2` auto-detects Zod v4
- Named exports only — không `export default`

### References

- FR9: `epics.md` — Remove member khỏi tenant
- FR10: `epics.md` — Promote Member lên Manager
- FR11: `epics.md` — Transfer ownership
- FR12: `epics.md` — Block delete nếu là sole Owner
- FR49: `epics.md` — View pending invitations + resend invite
- NFR13: `prd.md` — Admin actions phải được log với actor và timestamp
- DB Schema: `supabase/migrations/20260323000003_create_tenant_members.sql`
- RLS Policies: `supabase/migrations/20260323000011_rls_policies.sql`
- Edge Function stub: `supabase/functions/remove-member/index.ts`
- Permissions: `src/lib/permissions.ts` — `manageMembers` = Owner only

## Dev Agent Record

### Agent Model Used
Claude Sonnet 4.5

### Debug Log References
- Không có lỗi runtime. TypeScript pass clean (zero errors).
- Supabase DB tests: 17/17 PASS sau khi apply migration 20260324000006.
- RLS `member_audit_logs`: chỉ có SELECT policy (is_tenant_manager) — không có client INSERT policy vì INSERT thực hiện qua Edge Function service role.

### Completion Notes List
- ✅ Task 1: Migration `member_audit_logs` đã apply thành công, RLS enabled, SELECT policy đúng.
- ✅ Task 2: `remove-member` Edge Function implement đầy đủ: verify caller → update inactive → signOut → notify → audit log.
- ✅ Task 3: Thêm 6 functions vào tenant.service.ts: `removeMember`, `promoteToManager`, `transferOwnership`, `getInvites`, `resendInvite`, `isSoleOwner`.
- ✅ Task 4: `use-permissions.ts` hook với semantic API, không dùng raw role check.
- ✅ Task 5: `can.tsx` component với `do` prop và optional fallback.
- ✅ Task 6: 5 hooks (useMutation/useQuery) với invalidateQueries sau success.
- ✅ Task 7: 4 components — RemoveMemberDialog, TransferOwnershipDialog, RoleActionDropdown, InviteListSection.
- ✅ Task 8: settings/team.tsx — thêm tab "Lời mời", RoleActionDropdown vào Members tab, dùng `<Can>` guards, dùng `usePermissions()` thay vì raw role.
- ✅ Task 9: settings/profile.tsx — "Xóa tài khoản" section với isSoleOwner check + alert + stub confirm dialog.

### Implementation Plan
Thứ tự implement theo Dev Notes: Migration → usePermissions → Can → Edge Function → Service → Hooks → Components → Team page → Profile page. Đã follow đúng thứ tự.

### File List
**Tạo mới:**
- `supabase/migrations/20260324000006_create_member_audit_logs.sql`
- `src/hooks/use-permissions.ts`
- `src/components/can.tsx`
- `src/features/tenant/hooks/use-remove-member.ts`
- `src/features/tenant/hooks/use-promote-member.ts`
- `src/features/tenant/hooks/use-transfer-ownership.ts`
- `src/features/tenant/hooks/use-tenant-invites.ts`
- `src/features/tenant/hooks/use-resend-invite.ts`
- `src/features/tenant/components/RemoveMemberDialog.tsx`
- `src/features/tenant/components/TransferOwnershipDialog.tsx`
- `src/features/tenant/components/RoleActionDropdown.tsx`
- `src/features/tenant/components/InviteListSection.tsx`

**Sửa đổi:**
- `supabase/functions/remove-member/index.ts` (implement thực sự từ stub)
- `src/features/tenant/services/tenant.service.ts` (thêm 6 functions mới)
- `src/features/tenant/components/MemberList.tsx` (thêm RoleActionDropdown, currentUserId prop)
- `src/routes/_app/settings/team.tsx` (thêm tab Lời mời, usePermissions, Can guards)
- `src/routes/_app/settings/profile.tsx` (thêm Delete Account section)

## Change Log

- 2026-03-24: Story 1.6 created — Team Role & Membership Management
- 2026-03-24: Story 1.6 implemented — All 9 tasks complete, status → review
