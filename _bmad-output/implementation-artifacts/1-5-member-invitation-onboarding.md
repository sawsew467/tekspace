# Story 1.5: Member Invitation & Onboarding

Status: review

## Story

As an Owner or Manager,
I want to invite people to join my team via email and have them onboard smoothly,
So that team members can quickly get set up and start using TekSpace.

## Acceptance Criteria

1. **Invite member** — Owner/Manager ở `/settings/team` → tab "Thành viên" → click "Mời thành viên" → dialog nhập email → submit → Edge Function `send-invite` được gọi → INSERT vào `tenant_invites` (token crypto-random ≥ 32 chars, `expires_at = now() + 48h`) → Resend gửi invite email chứa link `{APP_URL}/accept-invite?token={token}` → invite xuất hiện trong danh sách với status "pending".

2. **Members tab** — `/settings/team` có tab "Thành viên" hiển thị list active members (name, email, role). Owner và Manager thấy nút "Mời thành viên". Member thường chỉ thấy list, không có nút invite.

3. **Accept invite — người chưa có tài khoản** — Click invite link còn hiệu lực + chưa authenticated → `/accept-invite?token=xxx` → validate token (pending + not expired) → hiện màn hình "Bạn được mời vào [Team Name]" kèm form register (full_name, email đã pre-fill, password) → submit → register xong → tự động accept invite (INSERT `tenant_members` role='member', UPDATE `tenant_invites` status='accepted') → `refreshSession()` → `initFromSession()` + `setActiveTenant(newTenantId)` → redirect đến `/settings/profile` để set timezone → sau đó redirect đến `/schedule`.

4. **Accept invite — người đã có tài khoản** — Click invite link + đã authenticated → `/accept-invite?token=xxx` → validate token → hiện màn hình "Bạn được mời vào [Team Name]" với nút "Xác nhận tham gia" → confirm → INSERT `tenant_members` role='member', UPDATE `tenant_invites` status='accepted' → `refreshSession()` → tenant mới xuất hiện trong tenant switcher → redirect đến `/dashboard`.

5. **Expired invite** — Invite link `expires_at < now()` hoặc status ≠ 'pending' → hiển thị: "Lời mời đã hết hạn. Vui lòng liên hệ manager để được invite lại."

6. **Unique pending invite constraint** — DB đã có `UNIQUE INDEX idx_tenant_invites_pending_email ON (tenant_id, email) WHERE status = 'pending'`. Nếu gửi invite cho email đã có pending invite trong cùng tenant → Edge Function trả về lỗi → toast.error("Email này đã có lời mời đang chờ xử lý.").

7. **Mid-week join** — Story 1.5 không cần implement UI lịch. Phần "ngày đã qua greyed out" thuộc scope Story 2.x khi member truy cập `/schedule` lần đầu.

## Tasks / Subtasks

- [ ] Task 1: Extend tenant.service.ts (AC: 1, 3, 4, 5)
  - [ ] Thêm `getMembers(tenantId: string)` → SELECT tenant_members JOIN users
  - [ ] Thêm `inviteMember(tenantId, email)` → gọi Edge Function `send-invite`
  - [ ] Thêm `validateInviteToken(token: string)` → SELECT tenant_invites JOIN tenants WHERE token = ?
  - [ ] Thêm `acceptInvite(token: string)` → INSERT tenant_members + UPDATE tenant_invites status='accepted' + refreshSession

- [ ] Task 2: Extend tenant.schema.ts (AC: 1)
  - [ ] Thêm `inviteMemberSchema`: `{ email: z.string().email('Email không hợp lệ') }`
  - [ ] Thêm type `InviteMemberInput = z.infer<typeof inviteMemberSchema>`

- [ ] Task 3: Implement `send-invite` Edge Function (AC: 1, 6)
  - [ ] Sửa `supabase/functions/send-invite/index.ts`
  - [ ] Parse body: `{ tenantId, email }` — validate bằng `supabaseAdmin.auth.getUser(token)` để verify caller
  - [ ] Lấy tenant name từ DB để dùng trong email
  - [ ] Generate token: `crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')` (64 chars hex)
  - [ ] INSERT `tenant_invites` (tenant_id, invited_by, email, token, expires_at = now() + 48h)
  - [ ] Gọi `sendEmail()` từ `_shared/resend.ts` với invite link
  - [ ] Return `{ ok: true, inviteId }`

- [ ] Task 4: Tạo hooks (AC: 1, 2, 3, 4)
  - [ ] Tạo `src/features/tenant/hooks/use-tenant-members.ts` → `useQuery` wrap `getMembers()`
  - [ ] Tạo `src/features/tenant/hooks/use-invite-member.ts` → `useMutation` wrap `inviteMember()`
  - [ ] Tạo `src/features/tenant/hooks/use-accept-invite.ts` → `useMutation` wrap `acceptInvite()`

- [ ] Task 5: Tạo InviteMemberDialog component (AC: 1)
  - [ ] Tạo `src/features/tenant/components/InviteMemberDialog.tsx`
  - [ ] Form với email field, submit gọi `useInviteMember()`
  - [ ] `onSuccess`: toast.success("Đã gửi lời mời"), close dialog, invalidate tenantInvites query

- [ ] Task 6: Cập nhật settings/team.tsx (AC: 1, 2)
  - [ ] Bọc toàn bộ content trong `<Tabs>` với 2 tabs: "Cài đặt nhóm" và "Thành viên"
  - [ ] Tab "Thành viên": render `MemberList` component + `InviteMemberDialog` cho Owner/Manager
  - [ ] Tạo inline `MemberList` component (hoặc file riêng): table với columns name, email, role

- [ ] Task 7: Tạo accept-invite.tsx route (AC: 3, 4, 5)
  - [ ] Tạo `src/routes/accept-invite.tsx` — public route ngoài `_app` layout
  - [ ] Load: validate token với `validateInviteToken()` trong loader
  - [ ] Nếu token invalid/expired → hiện error UI
  - [ ] Nếu user authenticated → hiện confirmation UI
  - [ ] Nếu user chưa đăng nhập → hiện register form (email pre-filled từ invite)
  - [ ] On accept: gọi `useAcceptInvite()` → refresh session → navigate

## Dev Notes

### Foundation từ Các Story Trước — ĐÃ CÓ SẴN, KHÔNG TẠO LẠI

| File | Trạng thái | Ghi chú |
|------|-----------|---------|
| `src/lib/supabase-browser.ts` | ✅ singleton | **CHỈ dùng cái này**, KHÔNG createClient() thêm |
| `src/stores/auth-store.ts` | ✅ có user, session, signIn, setSession | Import `useAuthStore` |
| `src/stores/tenant-store.ts` | ✅ có initFromSession, setActiveTenant, reset | Import `useTenantStore` |
| `src/lib/permissions.ts` | ✅ có MemberRole, hasPermission, ROLE_PERMISSIONS | `manageMembers` permission = Owner only |
| `src/lib/routes.ts` | ✅ có `acceptInvite: '/accept-invite'` | Dùng `ROUTES.acceptInvite` |
| `src/lib/query-keys.ts` | ✅ có `tenantMembers`, `tenantInvites` | Keys đã sẵn |
| `src/features/tenant/services/tenant.service.ts` | ✅ có createTenant, getTenantSettings, updateTenantSettings | **THÊM** functions mới vào đây |
| `src/features/tenant/schemas/tenant.schema.ts` | ✅ có createTenantSchema, teamSettingsSchema | **THÊM** inviteMemberSchema |
| `supabase/functions/_shared/resend.ts` | ✅ có `sendEmail()` | Dùng ngay trong Edge Function |
| `supabase/functions/_shared/supabase-admin.ts` | ✅ có `supabaseAdmin` | Dùng trong Edge Function |
| `supabase/functions/_shared/cors.ts` | ✅ có `corsHeaders` | Bắt buộc cho Edge Function |
| `src/features/auth/components/RegisterForm.tsx` | ✅ có sẵn | Có thể tham khảo pattern |
| `src/features/auth/schemas/auth.schema.ts` | ✅ có registerSchema | Tham khảo cho accept-invite form |

### Database Schema — BẮT BUỘC NẮM RÕ

**`public.tenant_invites` table:**
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE
invited_by  uuid REFERENCES public.users(id) ON DELETE SET NULL  -- ON DELETE SET NULL giữ audit trail
email       text NOT NULL
token       text NOT NULL UNIQUE CONSTRAINT tenant_invites_token_length CHECK (length(token) >= 32)
status      public.invite_status NOT NULL DEFAULT 'pending'
            -- ENUM: 'pending', 'accepted', 'expired', 'declined', 'revoked'
expires_at  timestamptz NOT NULL CONSTRAINT tenant_invites_expires_future CHECK (expires_at > created_at)
created_at  timestamptz NOT NULL DEFAULT now()
-- UNIQUE INDEX: (tenant_id, email) WHERE status = 'pending'
```

**`public.tenant_members` table (đã biết từ Story 1.4):**
```sql
id              uuid PRIMARY KEY
tenant_id       uuid NOT NULL REFERENCES tenants(id)
user_id         uuid NOT NULL REFERENCES users(id)
role            member_role NOT NULL DEFAULT 'member'  -- 'owner', 'manager', 'member'
status          member_status NOT NULL DEFAULT 'active' -- 'active', 'inactive'
committed_hours smallint NULL  -- NULL = dùng tenant default
UNIQUE (tenant_id, user_id)
```

**`public.users` table:**
```sql
id          uuid PRIMARY KEY REFERENCES auth.users(id)
full_name   text NOT NULL DEFAULT ''
avatar_url  text
timezone    text NOT NULL DEFAULT 'UTC'
```

**RLS Policies tenant_invites:**
- `tenant_invites_select_policy`: `tenant_id = current_tenant_id()` (context-based)
- `tenant_invites_insert_policy`: `is_tenant_manager()` + `tenant_id = current_tenant_id()`
- `tenant_invites_update_policy`: update (accept) khi token match, không cho accept invite đã hết hạn

⚠️ **QUAN TRỌNG — accept-invite route là PUBLIC ROUTE:**
- Route `/accept-invite` nằm NGOÀI `_app` layout (không có auth guard)
- User chưa đăng nhập CÓ THỂ truy cập để register + accept
- User đã đăng nhập cũng có thể truy cập để confirm + accept

⚠️ **QUAN TRỌNG — RLS context khi accept invite:**
- Khi user accept invite, họ đang INSERT vào `tenant_members` của tenant MỚI
- RLS `tenant_members_insert_policy`: check `current_tenant_id()` từ JWT
- Nhưng JWT của user chưa có tenant mới! → `current_tenant_id()` sẽ là NULL hoặc tenant cũ
- **Giải pháp**: `acceptInvite` cần dùng Edge Function hoặc Supabase admin client
- HOẶC: thêm special policy cho tenant_members INSERT khi có valid invite token
- **Khuyến nghị MVP**: Tạo Edge Function `accept-invite` để xử lý server-side (bypass RLS với service role)

**Nếu dùng Edge Function `accept-invite` (khuyến nghị):**
```typescript
// supabase/functions/accept-invite/index.ts
// body: { token, userId? }  (userId nếu user đã authenticated)
// 1. SELECT tenant_invites WHERE token = ? AND status = 'pending' AND expires_at > now()
// 2. Nếu không tìm thấy → return 400 "Lời mời không hợp lệ hoặc đã hết hạn"
// 3. INSERT tenant_members (tenant_id, user_id, role='member', status='active')
//    → dùng supabaseAdmin để bypass RLS
// 4. UPDATE tenant_invites SET status = 'accepted'
// 5. Return { ok: true, tenantId }
```

**Nếu KHÔNG tạo Edge Function riêng** (simpler approach): Extend `send-invite` để thêm `accept` action, hoặc thêm INSERT policy đặc biệt cho invite acceptance. Tuy nhiên cách này phức tạp về RLS.

→ **QUYẾT ĐỊNH**: Tạo Edge Function `accept-invite` mới. Đây là server-side operation cần service role.

### send-invite Edge Function — Implementation Pattern

```typescript
// supabase/functions/send-invite/index.ts
import { corsHeaders } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'
import { sendEmail } from '../_shared/resend.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Verify caller via JWT
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
    authHeader.replace('Bearer ', '')
  )
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const { tenantId, email } = await req.json()

  // Verify caller is manager/owner of this tenant
  const { data: membership } = await supabaseAdmin
    .from('tenant_members')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!membership || !['owner', 'manager'].includes(membership.role)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Get tenant name for email
  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('name')
    .eq('id', tenantId)
    .single()

  // Generate token
  const tokenBytes = new Uint8Array(32)
  crypto.getRandomValues(tokenBytes)
  const token = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, '0')).join('')
  // 64 chars hex — > 32 chars required

  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

  const { data: invite, error: insertError } = await supabaseAdmin
    .from('tenant_invites')
    .insert({
      tenant_id: tenantId,
      invited_by: user.id,
      email,
      token,
      expires_at: expiresAt,
    })
    .select('id')
    .single()

  if (insertError) {
    // Unique constraint violation → pending invite exists
    if (insertError.code === '23505') {
      return new Response(
        JSON.stringify({ error: 'Email này đã có lời mời đang chờ xử lý.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    throw insertError
  }

  const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:3000'
  await sendEmail({
    to: email,
    subject: `Bạn được mời vào ${tenant?.name ?? 'team'}`,
    html: `
      <p>Bạn được mời tham gia <strong>${tenant?.name}</strong> trên TekSpace.</p>
      <p><a href="${appUrl}/accept-invite?token=${token}">Nhấn vào đây để chấp nhận lời mời</a></p>
      <p><em>Link có hiệu lực trong 48 giờ.</em></p>
    `,
  })

  return new Response(JSON.stringify({ ok: true, inviteId: invite.id }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})
```

### accept-invite Edge Function — Pattern

```typescript
// supabase/functions/accept-invite/index.ts (MỚI — cần tạo folder + file)
import { corsHeaders } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const { token, userId } = await req.json()
  if (!token || !userId) {
    return new Response(JSON.stringify({ error: 'token và userId là bắt buộc' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Validate token
  const { data: invite, error } = await supabaseAdmin
    .from('tenant_invites')
    .select('id, tenant_id, email, status, expires_at')
    .eq('token', token)
    .single()

  if (error || !invite) {
    return new Response(JSON.stringify({ error: 'Lời mời không hợp lệ.' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
  if (invite.status !== 'pending' || new Date(invite.expires_at) < new Date()) {
    return new Response(
      JSON.stringify({ error: 'Lời mời đã hết hạn. Vui lòng liên hệ manager để được invite lại.' }),
      { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // INSERT tenant_members (bypass RLS với admin client)
  const { error: memberError } = await supabaseAdmin
    .from('tenant_members')
    .insert({ tenant_id: invite.tenant_id, user_id: userId, role: 'member', status: 'active' })

  // Bỏ qua lỗi nếu membership đã tồn tại (idempotent)
  if (memberError && memberError.code !== '23505') throw memberError

  // UPDATE invite status
  await supabaseAdmin
    .from('tenant_invites')
    .update({ status: 'accepted' })
    .eq('id', invite.id)

  return new Response(JSON.stringify({ ok: true, tenantId: invite.tenant_id }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})
```

### tenant.service.ts — Extend với Functions Mới

```typescript
// Thêm vào src/features/tenant/services/tenant.service.ts

export type TenantMemberWithUser = {
  id: string
  user_id: string
  role: 'owner' | 'manager' | 'member'
  status: 'active' | 'inactive'
  committed_hours: number | null
  users: {
    id: string
    full_name: string
    avatar_url: string | null
    timezone: string
  }
}

export const getMembers = async (tenantId: string): Promise<TenantMemberWithUser[]> => {
  const { data, error } = await supabase
    .from('tenant_members')
    .select('id, user_id, role, status, committed_hours, users(id, full_name, avatar_url, timezone)')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as TenantMemberWithUser[]
}

export const inviteMember = async (tenantId: string, email: string): Promise<void> => {
  const { error } = await supabase.functions.invoke('send-invite', {
    body: { tenantId, email },
  })
  if (error) throw error
}

export type InviteTokenInfo = {
  tenantId: string
  tenantName: string
  email: string
  status: string
  expiresAt: string
}

export const validateInviteToken = async (token: string): Promise<InviteTokenInfo> => {
  // Public function: không dùng RLS context tenant, query trực tiếp với token
  // Note: RLS tenant_invites_select_policy check tenant_id = current_tenant_id()
  // → nếu user chưa có tenant context → RLS sẽ block!
  // Giải pháp: gọi validate qua Edge Function thay vì trực tiếp DB
  const { data, error } = await supabase.functions.invoke('accept-invite', {
    body: { token, validateOnly: true },
  })
  if (error) throw error
  return data
}

export const acceptInvite = async (token: string, userId: string): Promise<{ tenantId: string }> => {
  const { data, error } = await supabase.functions.invoke('accept-invite', {
    body: { token, userId },
  })
  if (error) {
    if (error.message?.includes('hết hạn')) throw new Error(error.message)
    throw error
  }
  return data as { tenantId: string }
}
```

### accept-invite.tsx Route Pattern

```typescript
// src/routes/accept-invite.tsx
import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { z } from 'zod'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase-browser'
import { useAuthStore } from '@/stores/auth-store'
import { useTenantStore } from '@/stores/tenant-store'
import { ROUTES } from '@/lib/routes'

// Validate search params: token là required
const searchSchema = z.object({ token: z.string().min(1) })

export const Route = createFileRoute('/accept-invite')({
  validateSearch: searchSchema,
  component: AcceptInvitePage,
})

function AcceptInvitePage() {
  const { token } = Route.useSearch()
  const navigate = useNavigate()
  const { user, session } = useAuthStore()
  const [inviteInfo, setInviteInfo] = useState<{ tenantName: string; email: string } | null>(null)
  const [isExpired, setIsExpired] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isAccepting, setIsAccepting] = useState(false)

  // Load invite info khi mount
  useEffect(() => {
    const loadInvite = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('accept-invite', {
          body: { token, validateOnly: true }
        })
        if (error || !data) {
          setIsExpired(true)
        } else {
          setInviteInfo({ tenantName: data.tenantName, email: data.email })
        }
      } catch {
        setIsExpired(true)
      } finally {
        setIsLoading(false)
      }
    }
    loadInvite()
  }, [token])

  const handleAccept = async () => {
    if (!user) return
    setIsAccepting(true)
    try {
      const { data, error } = await supabase.functions.invoke('accept-invite', {
        body: { token, userId: user.id }
      })
      if (error) throw error

      // Refresh JWT để có tenant mới
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
      if (refreshError) throw refreshError
      if (refreshData.session) {
        const tenantStore = useTenantStore.getState()
        tenantStore.initFromSession(refreshData.session.access_token)
        tenantStore.setActiveTenant(data.tenantId)
      }
      toast.success(`Đã tham gia ${inviteInfo?.tenantName}!`)
      await navigate({ to: ROUTES.app.dashboard })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể chấp nhận lời mời.'
      toast.error(msg)
    } finally {
      setIsAccepting(false)
    }
  }

  if (isLoading) return <div className="flex min-h-screen items-center justify-center">Đang kiểm tra...</div>

  if (isExpired) return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-2">
        <h1 className="text-xl font-semibold">Lời mời đã hết hạn</h1>
        <p className="text-muted-foreground text-sm">
          Vui lòng liên hệ manager để được invite lại.
        </p>
      </div>
    </div>
  )

  if (!user) {
    // Chưa đăng nhập → redirect đến sign-in với returnTo param
    // Sau khi sign-in, quay lại accept-invite page
    navigate({ to: ROUTES.signIn, search: { returnTo: `/accept-invite?token=${token}` } })
    return null
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold">Bạn được mời vào {inviteInfo?.tenantName}</h1>
        <p className="text-muted-foreground text-sm">{inviteInfo?.email}</p>
        <Button onClick={handleAccept} disabled={isAccepting}>
          {isAccepting ? 'Đang xử lý...' : 'Xác nhận tham gia'}
        </Button>
      </div>
    </div>
  )
}
```

### settings/team.tsx — Tabs Structure

```typescript
// src/routes/_app/settings/team.tsx (sửa thêm Tabs)
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// Bọc existing content trong <TabsContent value="settings">
// Thêm <TabsContent value="members"> với MemberList + InviteMemberDialog

function TeamSettingsPage() {
  return (
    <Tabs defaultValue="settings">
      <TabsList>
        <TabsTrigger value="settings">Cài đặt nhóm</TabsTrigger>
        <TabsTrigger value="members">Thành viên</TabsTrigger>
      </TabsList>
      <TabsContent value="settings">
        {/* Existing team settings form */}
      </TabsContent>
      <TabsContent value="members">
        <MembersTab />
      </TabsContent>
    </Tabs>
  )
}
```

**Lưu ý Tabs component**: `src/components/ui/tabs.tsx` đã có sẵn. Import trực tiếp.

### use-tenant-members Hook Pattern

```typescript
// src/features/tenant/hooks/use-tenant-members.ts
import { useQuery } from '@tanstack/react-query'
import { useTenantStore } from '@/stores/tenant-store'
import { QUERY_KEYS } from '@/lib/query-keys'
import { getMembers } from '@/features/tenant/services/tenant.service'

export function useTenantMembers() {
  const { activeTenantId } = useTenantStore()
  return useQuery({
    queryKey: [QUERY_KEYS.tenantMembers, activeTenantId],
    queryFn: () => getMembers(activeTenantId!),
    enabled: !!activeTenantId,
  })
}
```

### use-invite-member Hook Pattern

```typescript
// src/features/tenant/hooks/use-invite-member.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTenantStore } from '@/stores/tenant-store'
import { QUERY_KEYS } from '@/lib/query-keys'
import { inviteMember } from '@/features/tenant/services/tenant.service'
import { toast } from 'sonner'

export function useInviteMember() {
  const queryClient = useQueryClient()
  const { activeTenantId } = useTenantStore()

  return useMutation({
    mutationFn: (email: string) => inviteMember(activeTenantId!, email),
    onSuccess: () => {
      toast.success('Đã gửi lời mời thành công')
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.tenantInvites] })
    },
    onError: (error: Error) => {
      const msg = error.message?.includes('đang chờ xử lý')
        ? error.message
        : 'Không thể gửi lời mời. Vui lòng thử lại.'
      toast.error(msg)
    },
  })
}
```

### MVP Restrictions — KHÔNG vi phạm

| Constraint | Lý do |
|---|---|
| ❌ KHÔNG tạo thêm `createClient()` | Dùng `src/lib/supabase-browser.ts` singleton |
| ❌ KHÔNG barrel exports | Import trực tiếp từ file |
| ❌ KHÔNG hardcode paths | Dùng `ROUTES.*` constant |
| ❌ KHÔNG dùng toast khác | Chỉ `toast` từ `sonner` |
| ❌ KHÔNG `export default` | Dùng named exports |
| ❌ KHÔNG optimistic updates | `isPending` state hoặc `mutation.isPending` |
| ❌ KHÔNG INSERT tenant_members trực tiếp từ client | Phải qua Edge Function `accept-invite` (bypass RLS cần service role) |
| ✅ Edge Function `send-invite` → verify caller với `supabaseAdmin.auth.getUser()` | Xác thực trước khi insert invite |
| ✅ Edge Function `accept-invite` → dùng supabaseAdmin để bypass RLS khi INSERT tenant_members | User chưa có tenant context |

### Project Structure — Files cần tạo/sửa

```
src/
├── features/tenant/
│   ├── services/
│   │   └── tenant.service.ts        ← SỬA (thêm getMembers, inviteMember, validateInviteToken, acceptInvite)
│   ├── hooks/                       ← TẠO MỚI folder
│   │   ├── use-tenant-members.ts    ← TẠO MỚI
│   │   ├── use-invite-member.ts     ← TẠO MỚI
│   │   └── use-accept-invite.ts     ← TẠO MỚI (optional, có thể inline)
│   ├── components/                  ← TẠO MỚI folder
│   │   └── InviteMemberDialog.tsx   ← TẠO MỚI
│   └── schemas/
│       └── tenant.schema.ts         ← SỬA (thêm inviteMemberSchema)
├── routes/
│   ├── accept-invite.tsx            ← TẠO MỚI (public route)
│   └── _app/
│       └── settings/
│           └── team.tsx             ← SỬA (thêm Tabs + Members tab)
supabase/
└── functions/
    ├── send-invite/
    │   └── index.ts                 ← SỬA (implement thực sự)
    └── accept-invite/               ← TẠO MỚI folder
        └── index.ts                 ← TẠO MỚI
```

### Thứ tự Implementation được khuyến nghị

1. **Task 2** (schema) — foundation types trước
2. **Task 1** (service functions getMembers, inviteMember) — data layer
3. **Task 3** (send-invite Edge Function) — backend trước khi test UI
4. **Task 4** (hooks) — wrap services
5. **Task 5** (InviteMemberDialog) — component đơn giản
6. **Task 6** (settings/team.tsx + Tabs) — UI integration
7. **Task 7** (accept-invite Edge Function + route) — đây là phần phức tạp nhất, để cuối

### Learnings từ Story 1.4 — Vẫn áp dụng

- `@hookform/resolvers v5.2.2` auto-detects Zod v4 — KHÔNG dùng `/zod/v4` import path
- `ROUTES` có nested structure — dùng `ROUTES.app.settings.team`, `ROUTES.acceptInvite`
- `useTenantStore.getState()` bên ngoài component (trong event handlers)
- Edge Function errors nên được wrapped với `if (error) throw error` — React Query catches
- `context.supabase` chỉ có trong `beforeLoad` — trong component/service, dùng `supabase` singleton
- `shadcn Tabs` — `TabsTrigger value` phải match `TabsContent value`

### References

- FR8: `epics.md` — Invite member qua email
- FR13: `epics.md` — Invite link có thời hạn 48 giờ
- FR14: `epics.md` — Accept invitation (explicit confirmation step)
- DB Schema: `supabase/migrations/20260323000004_create_tenant_invites.sql`
- RLS Policies: `supabase/migrations/20260323000011_rls_policies.sql`
- Edge Function stubs: `supabase/functions/send-invite/index.ts`, `supabase/functions/_shared/`
- Architecture: `src/features/tenant/` boundaries, Edge Function patterns

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (1M context)

### Debug Log References

- TypeScript: pass clean (0 errors)
- ESLint: pass clean (0 warnings) trên tất cả files mới
- Vite build: ✓ thành công 8.99s — chunk size warning là pre-existing từ các stories trước

### Completion Notes List

- ✅ Task 2: Tạo `src/features/tenant/schemas/tenant.schema.ts` — thêm `inviteMemberSchema`, `acceptInviteResponseSchema`
- ✅ Task 1: Mở rộng `src/features/tenant/services/tenant.service.ts` — thêm `getMembers()`, `inviteMember()` (gọi send-invite Edge Function), `validateInviteToken()` (gọi accept-invite Edge Function validateOnly=true), `acceptInvite()` (gọi accept-invite Edge Function)
- ✅ Task 3: Implement `supabase/functions/send-invite/index.ts` — INSERT tenant_invites + gọi Resend
- ✅ Task 7 (Edge): Tạo `supabase/functions/accept-invite/index.ts` — dual-mode (validateOnly + accept), bypass RLS với supabaseAdmin, idempotent accept (ignore unique constraint error)
- ✅ Task 4: Tạo hooks — `use-tenant-members.ts`, `use-invite-member.ts`, `use-accept-invite.ts`
- ✅ Task 5: Tạo `InviteMemberDialog.tsx` — form + dialog với loading state, `MemberList.tsx` — danh sách members với role badge
- ✅ Task 6: Cập nhật `settings/team.tsx` — thêm Tabs (Members | Cài đặt), `canManage` prop điều kiện hiện InviteMemberDialog
- ✅ Task 7 (Route): Tạo `src/routes/accept-invite.tsx` — public route, validateSearch với Zod, 3 states (loading/expired/ready), explicit confirmation bắt buộc (FR14), refreshSession sau accept để JWT embed tenant_roles mới

### Implementation Notes

- **RLS bypass cho accept-invite**: `supabaseAdmin` trong Edge Function là bắt buộc vì user chưa có tenant_id trong JWT khi accept invite mới
- **Idempotent accept**: ignore PostgreSQL error code `23505` (unique constraint) — cho phép double-click không crash
- **validateOnly mode**: tách validate khỏi accept để UI có thể hiển thị team name mà không cần session
- **refreshSession sau accept**: bắt buộc để JWT embed tenant_roles mới (giống pattern Story 1.4 createTenant)
- **canManage vs isOwner**: MemberList dùng `canManage` (owner OR manager) để hiện InviteMemberDialog; Settings form dùng `isOwner` strict check

### File List

- `src/features/tenant/schemas/tenant.schema.ts` — modified (thêm inviteMemberSchema, acceptInviteResponseSchema)
- `src/features/tenant/services/tenant.service.ts` — modified (thêm getMembers, inviteMember, validateInviteToken, acceptInvite)
- `src/features/tenant/hooks/use-tenant-members.ts` — created
- `src/features/tenant/hooks/use-invite-member.ts` — created
- `src/features/tenant/hooks/use-accept-invite.ts` — created
- `src/features/tenant/components/InviteMemberDialog.tsx` — created
- `src/features/tenant/components/MemberList.tsx` — created
- `src/routes/_app/settings/team.tsx` — modified (Tabs + MemberList integration)
- `src/routes/accept-invite.tsx` — created
- `supabase/functions/send-invite/index.ts` — implemented (was stub)
- `supabase/functions/accept-invite/index.ts` — created

## Change Log

- 2026-03-24: Story 1.5 created — Member Invitation & Onboarding
- 2026-03-24: Story 1.5 implemented — tất cả 7 tasks hoàn thành, status → review
